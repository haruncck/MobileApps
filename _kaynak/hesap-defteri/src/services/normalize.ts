import type { Allocation, AppData, Currency, Customer, Job, JobStatus, Payment, PaymentType } from '../types';
import { CURRENCIES } from '../types';
import { computePayment, round2 } from '../lib/money';
import { DEFAULT_RATES } from '../lib/seed';
import { parseNum } from '../lib/format';

/**
 * Kayıtlı veya içe aktarılan veriyi doğrular.
 * Hiçbir kaydı sessizce silmez ya da uydurmaz: her sorun `issues` listesine yazılır.
 * İçe aktarmada `issues` boş değilse yükleme durdurulur.
 */
export interface NormalizeResult {
  data: AppData;
  issues: string[];
}

const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export function normalizeData(raw: Raw): NormalizeResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Dosya bu uygulamanın yedeği değil.');
  const issues: string[] = [];
  const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? parseNum(v) : NaN);
  const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const opt = (v: unknown) => (str(v).trim() ? str(v) : undefined);
  const cur = (v: unknown): Currency | null => (CURRENCIES.includes(str(v).toUpperCase() as Currency) ? (str(v).toUpperCase() as Currency) : null);

  const rateOk = (v: unknown, fb: number) => {
    const n = num(v);
    return Number.isFinite(n) && n > 0 ? n : fb;
  };
  const rates = { USD: rateOk(raw.settings?.rates?.USD, DEFAULT_RATES.USD), EUR: rateOk(raw.settings?.rates?.EUR, DEFAULT_RATES.EUR) };

  /* Müşteriler */
  const seen = new Set<string>();
  const customers: Customer[] = [];
  for (const [i, c] of (Array.isArray(raw.customers) ? raw.customers : []).entries()) {
    const id = str(c?.id);
    const name = str(c?.name).trim();
    if (!id || seen.has(id)) {
      issues.push(`${i + 1}. müşterinin kimliği eksik veya tekrarlı (${name || 'isimsiz'}).`);
      continue;
    }
    if (!name) issues.push(`Bir müşterinin adı boş (kimlik ${id}).`);
    seen.add(id);
    customers.push({ id, name: name || 'İsimsiz müşteri', phone: opt(c.phone), note: opt(c.note), createdAt: str(c.createdAt) || new Date().toISOString() });
  }
  const custName = new Map(customers.map((c) => [c.id, c.name]));

  /* İşler */
  const jobIds = new Set<string>();
  const jobs: Job[] = [];
  for (const [i, j] of (Array.isArray(raw.jobs) ? raw.jobs : []).entries()) {
    const label = `${i + 1}. iş (${str(j?.title) || 'adsız'})`;
    const id = str(j?.id);
    const amount = num(j?.amount);
    const currency = cur(j?.currency);
    const date = str(j?.date).slice(0, 10);
    const problems: string[] = [];
    if (!id || jobIds.has(id)) problems.push('kimliği eksik veya tekrarlı');
    if (!custName.has(str(j?.customerId))) problems.push('müşterisi bulunamadı');
    if (!Number.isFinite(amount) || amount < 0) problems.push(`tutarı geçersiz (${str(j?.amount)})`);
    if (!currency) problems.push(`para birimi geçersiz (${str(j?.currency)})`);
    if (!isDate(date)) problems.push(`tarihi geçersiz (${str(j?.date) || 'boş'})`);
    if (problems.length) {
      issues.push(`${label}: ${problems.join(', ')}.`);
      continue;
    }
    jobIds.add(id);
    jobs.push({
      id,
      customerId: str(j.customerId),
      title: str(j.title).trim() || 'İş',
      date,
      amount: round2(amount),
      currency: currency!,
      status: (['devam', 'tamamlandi', 'faturalandi'].includes(j.status) ? j.status : 'tamamlandi') as JobStatus,
      note: opt(j.note),
    });
  }

  /* Ödemeler */
  const payIds = new Set<string>();
  const payments: Payment[] = [];
  for (const [i, p] of (Array.isArray(raw.payments) ? raw.payments : []).entries()) {
    const label = `${i + 1}. ödeme (${custName.get(str(p?.customerId)) ?? 'müşterisi yok'}, ${str(p?.amount)} ${str(p?.currency)})`;
    const id = str(p?.id);
    const amount = num(p?.amount);
    const currency = cur(p?.currency);
    const date = str(p?.date).slice(0, 10);
    const pr = { USD: num(p?.rates?.USD), EUR: num(p?.rates?.EUR) };
    const problems: string[] = [];
    if (!id || payIds.has(id)) problems.push('kimliği eksik veya tekrarlı');
    if (!custName.has(str(p?.customerId))) problems.push('müşterisi bulunamadı');
    if (!Number.isFinite(amount) || amount <= 0) problems.push('tutarı geçersiz');
    if (!currency) problems.push('para birimi geçersiz');
    if (!isDate(date)) problems.push(`tarihi geçersiz (${str(p?.date) || 'boş'})`);
    if (!(pr.USD > 0) || !(pr.EUR > 0)) problems.push('kur bilgisi eksik');

    let allocations: Allocation[] | null = null;
    if (Array.isArray(p?.allocations) && p.allocations.length) {
      allocations = [];
      for (const a of p.allocations) {
        const ac = cur(a?.currency);
        const am = num(a?.amount);
        if (!ac || !Number.isFinite(am) || am < 0) {
          problems.push('borçtan düşülen tutar bilgisi bozuk');
          break;
        }
        allocations.push({ currency: ac, amount: round2(am) });
      }
    }
    if (problems.length) {
      issues.push(`${label}: ${problems.join(', ')}.`);
      continue;
    }
    payIds.add(id);
    const base = {
      id,
      customerId: str(p.customerId),
      date,
      type: (['nakit', 'havale', 'cek', 'urun'].includes(p.type) ? p.type : 'havale') as PaymentType,
      amount: round2(amount),
      currency: currency!,
      mode: (p.mode === 'auto' ? 'auto' : 'single') as 'auto' | 'single',
      targetCurrency: cur(p.targetCurrency) ?? currency!,
      rates: pr,
      jobId: opt(p.jobId) && jobIds.has(str(p.jobId)) ? str(p.jobId) : undefined,
      description: opt(p.description),
      note: opt(p.note),
    };
    if (allocations) {
      const tl = num(p.amountTRY);
      payments.push({ ...base, allocations, amountTRY: round2(Number.isFinite(tl) ? tl : base.amount * (currency === 'TRY' ? 1 : pr[currency as 'USD' | 'EUR'])) });
    } else {
      // Eski biçim: dağılım yok → tamamı hedef dövize, kayıtlı kurla
      payments.push(computePayment({ ...base, mode: 'single' }));
    }
  }

  return {
    data: {
      version: 1,
      rev: Number.isFinite(Number(raw.rev)) ? Number(raw.rev) : 0,
      savedAt: opt(raw.savedAt),
      customers,
      jobs,
      payments,
      settings: {
        rates,
        ratesUpdatedAt: opt(raw.settings?.ratesUpdatedAt),
        ratesSource: opt(raw.settings?.ratesSource),
        lastBackupAt: opt(raw.settings?.lastBackupAt),
        templates: Array.isArray(raw.settings?.templates)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            raw.settings.templates
              .map((t: any) => ({ id: str(t?.id) || `t-${Math.random().toString(36).slice(2)}`, title: str(t?.title).trim(), amount: round2(num(t?.amount)), currency: cur(t?.currency) ?? 'TRY' }))
              .filter((t: { title: string; amount: number }) => t.title && Number.isFinite(t.amount) && t.amount > 0)
          : undefined,
        business: raw.settings?.business && typeof raw.settings.business === 'object' ? { name: opt(raw.settings.business.name), phone: opt(raw.settings.business.phone), iban: opt(raw.settings.business.iban) } : undefined,
      },
    },
    issues,
  };
}
