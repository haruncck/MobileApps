import type { AppData, Currency } from '../types';
import { CURRENCIES } from '../types';
import type { PaymentType } from '../types';

const PAY_TEXT: Record<PaymentType, string> = { nakit: 'Nakit ödeme', havale: 'Havale ödemesi', cek: 'Çek / senet ile ödeme', urun: 'Ürün olarak ödeme' };
import { EPS, rateOf, round2 } from './money';
import { fmt, fmtDate, fmtRate, SYMBOL } from './format';

/**
 * Cari hesap özeti (ekstre).
 * Her para birimi ayrı bir hesap olarak gösterilir: işler borç, ödemelerin o dövize düşen kısmı alacak.
 * TL ile alınıp dövizli borçtan düşülen ödemelerde kur, açıklamada yazılır.
 */
export interface StatementRow {
  date: string;
  text: string;
  sub?: string;
  paidAs?: string; // farklı dövizle ödendiyse ödenen tutar (ör. ₺40.000)
  debit: number; // borç (yapılan iş)
  credit: number; // alacak (alınan ödeme)
  balance: number; // yürüyen bakiye
}

export interface StatementSection {
  currency: Currency;
  opening: number; // devreden bakiye (dönem başı)
  rows: StatementRow[];
  debit: number;
  credit: number;
  closing: number;
}

export interface Statement {
  customerName: string;
  date: string; // hazırlanma tarihi
  from: string | null; // dönem başı (null = tümü)
  sections: StatementSection[];
  closingTRY: number; // bugünkü kurla toplam TL karşılığı
  hasForeign: boolean;
}

export type Period = 'all' | 'year' | 'q' | 'custom';

export function periodStart(p: Period, custom: string, today: string): string | null {
  if (p === 'all') return null;
  if (p === 'year') return `${today.slice(0, 4)}-01-01`;
  if (p === 'q') {
    const [y, m, d] = today.split('-').map(Number);
    const t = new Date(y, m - 1 - 3, d);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(custom) ? custom : null;
}

export function buildStatement(data: AppData, customerId: string, from: string | null, today: string, opts: { notes?: boolean } = {}): Statement {
  const customer = data.customers.find((c) => c.id === customerId);
  type Raw = { date: string; order: number; text: string; sub?: string; paidAs?: string; debit: number; credit: number; currency: Currency };
  const raw: Raw[] = [];

  data.jobs.forEach((j, i) => {
    if (j.customerId !== customerId) return;
    raw.push({ date: j.date, order: i, text: j.title, sub: opts.notes ? j.note : undefined, debit: j.amount, credit: 0, currency: j.currency });
  });
  data.payments.forEach((p, i) => {
    if (p.customerId !== customerId) return;
    const what = p.type === 'urun' ? `${p.description ?? 'Ürün'} (ürün olarak)` : PAY_TEXT[p.type];
    for (const a of p.allocations) {
      const converted = a.currency !== p.currency;
      const sub = converted
        ? `${fmt(p.amount, p.currency)} alındı, kur ${SYMBOL[a.currency === 'TRY' ? (p.currency as 'USD' | 'EUR') : (a.currency as 'USD' | 'EUR')]}1 = ₺${fmtRate(
            p.rates[a.currency === 'TRY' ? (p.currency as 'USD' | 'EUR') : (a.currency as 'USD' | 'EUR')],
          )}`
        : opts.notes
          ? p.note
          : undefined;
      raw.push({ date: p.date, order: 100000 + i, text: what, sub, paidAs: converted ? fmt(p.amount, p.currency) : undefined, debit: 0, credit: a.amount, currency: a.currency });
    }
  });

  const sections: StatementSection[] = [];
  for (const cur of CURRENCIES) {
    const list = raw.filter((r) => r.currency === cur).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    if (!list.length) continue;
    let opening = 0;
    const inPeriod: Raw[] = [];
    for (const r of list) {
      if (from && r.date < from) opening += r.debit - r.credit;
      else inPeriod.push(r);
    }
    opening = round2(opening);
    let bal = opening;
    const rows = inPeriod.map((r) => {
      bal = round2(bal + r.debit - r.credit);
      return { date: r.date, text: r.text, sub: r.sub, paidAs: r.paidAs, debit: r.debit, credit: r.credit, balance: bal };
    });
    const debit = round2(inPeriod.reduce((s, r) => s + r.debit, 0));
    const credit = round2(inPeriod.reduce((s, r) => s + r.credit, 0));
    // Dönemde hareket yoksa ve devreden bakiye sıfırsa bu döviz gösterilmez
    if (!rows.length && Math.abs(opening) <= EPS) continue;
    sections.push({ currency: cur, opening, rows, debit, credit, closing: round2(opening + debit - credit) });
  }

  const closingTRY = round2(sections.reduce((s, x) => s + x.closing * rateOf(x.currency, data.settings.rates), 0));
  return {
    customerName: customer?.name ?? '',
    date: today,
    from,
    sections,
    closingTRY,
    hasForeign: sections.some((s) => s.currency !== 'TRY' && Math.abs(s.closing) > EPS),
  };
}

/** WhatsApp / SMS için düz metin özet */
export function statementText(st: Statement, business: { name?: string; phone?: string; iban?: string }, opts: { showTRY: boolean; rates: { USD: number; EUR: number } }) {
  const L: string[] = [];
  L.push(`Sayın ${st.customerName},`);
  L.push(`${fmtDate(st.date)} itibarıyla cari hesap özetiniz${st.from ? ` (${fmtDate(st.from)} sonrası)` : ''}:`);
  L.push('');
  for (const s of st.sections) {
    const c = s.currency;
    if (st.sections.length > 1) L.push(`${c === 'TRY' ? 'TL' : c === 'USD' ? 'Dolar' : 'Euro'} hesabı`);
    if (st.from && Math.abs(s.opening) > EPS) L.push(`Devreden bakiye: ${fmt(s.opening, c)}`);
    for (const r of s.rows) {
      L.push(`${fmtDate(r.date)}  ${r.text}  ${r.debit ? fmt(r.debit, c) : `-${fmt(r.credit, c)}${r.paidAs ? ` (${r.paidAs} olarak)` : ''}`}`);
    }
    L.push(`Yapılan işler: ${fmt(s.debit, c)}`);
    L.push(`Ödemeleriniz: ${fmt(s.credit, c)}`);
    L.push(`*Kalan bakiye: ${fmt(s.closing, c)}*`);
    L.push('');
  }
  if (opts.showTRY && st.hasForeign) {
    L.push(`Toplam kalan, bugünkü kurla: ${fmt(Math.round(st.closingTRY), 'TRY')} ($1 = ₺${fmtRate(opts.rates.USD)}, €1 = ₺${fmtRate(opts.rates.EUR)})`);
    L.push('');
  }
  if (business.iban) L.push(`IBAN: ${business.iban}${business.name ? ` (${business.name})` : ''}`);
  if (business.name || business.phone) L.push([business.name, business.phone].filter(Boolean).join(', '));
  return L.join('\n').trim();
}
