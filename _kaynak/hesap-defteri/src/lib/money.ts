import type { Allocation, AppData, Currency, Job, Money, Payment, Rates } from '../types';
import { CURRENCIES } from '../types';

export const EPS = 0.005;

export const emptyMoney = (): Money => ({ TRY: 0, USD: 0, EUR: 0 });

/** Kuruş hassasiyetinde yuvarlama (kayan nokta hatalarını önler) */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const rateOf = (c: Currency, rates: Rates) => (c === 'TRY' ? 1 : rates[c]);

/** a para biriminden b para birimine kur üzerinden çevirir */
export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return amount;
  const tl = amount * rateOf(from, rates);
  return tl / rateOf(to, rates);
}

export function toTRY(m: Money, rates: Rates): number {
  return round2(CURRENCIES.reduce((s, c) => s + m[c] * rateOf(c, rates), 0));
}

export type PaymentInput = Omit<Payment, 'allocations' | 'amountTRY'>;

/**
 * Ödemenin mahsup dağılımını işlem kurlarıyla hesaplar.
 * @param openBalance auto mod için müşterinin (bu ödeme hariç) açık bakiyesi
 */
export function computePayment(p: PaymentInput, openBalance?: Money): Payment {
  const amountTRY = round2(p.amount * rateOf(p.currency, p.rates));
  let allocations: Allocation[];
  if (p.mode === 'auto' && openBalance) {
    const open = CURRENCIES.filter((c) => openBalance[c] > EPS).sort((a, b) => {
      if (a === p.currency) return -1;
      if (b === p.currency) return 1;
      return openBalance[b] * rateOf(b, p.rates) - openBalance[a] * rateOf(a, p.rates);
    });
    let remainingTL = p.amount * rateOf(p.currency, p.rates);
    const acc = emptyMoney();
    for (const c of open) {
      if (remainingTL <= EPS) break;
      const capTL = openBalance[c] * rateOf(c, p.rates);
      const takeTL = Math.min(capTL, remainingTL);
      acc[c] += takeTL / rateOf(c, p.rates);
      remainingTL -= takeTL;
    }
    if (remainingTL > EPS) acc[p.targetCurrency] += remainingTL / rateOf(p.targetCurrency, p.rates);
    allocations = CURRENCIES.filter((c) => acc[c] > EPS).map((c) => ({ currency: c, amount: round2(acc[c]) }));
  } else {
    allocations = [{ currency: p.targetCurrency, amount: round2(convert(p.amount, p.currency, p.targetCurrency, p.rates)) }];
  }
  return { ...p, allocations, amountTRY };
}

export function creditedMoney(p: Payment): Money {
  const m = emptyMoney();
  for (const a of p.allocations) m[a.currency] += a.amount;
  return m;
}

export function sumJobs(jobs: Job[]): Money {
  const m = emptyMoney();
  for (const j of jobs) m[j.currency] += j.amount;
  return roundMoney(m);
}

/** Ödemelerin bakiyeden düştüğü (mahsup edilen) tutarlar, hedef döviz bazında */
export function sumCredited(payments: Payment[]): Money {
  const m = emptyMoney();
  for (const p of payments) for (const a of p.allocations) m[a.currency] += a.amount;
  return roundMoney(m);
}

export function roundMoney(m: Money): Money {
  return { TRY: round2(m.TRY), USD: round2(m.USD), EUR: round2(m.EUR) };
}

export function subMoney(a: Money, b: Money): Money {
  return roundMoney({ TRY: a.TRY - b.TRY, USD: a.USD - b.USD, EUR: a.EUR - b.EUR });
}

export interface Ledger {
  jobs: Money; // iş toplamı (saf döviz)
  credited: Money; // mahsup edilen (saf döviz)
  balance: Money; // kalan = iş - mahsup (saf döviz)
  jobsTRY: number; // güncel kurla TL
  creditedTRY: number; // güncel kurla TL  (jobsTRY - creditedTRY = balanceTRY birebir)
  balanceTRY: number;
  receivedTRY: number; // işlem kurlarıyla fiili alınan TL karşılığı
}

export function ledger(jobs: Job[], payments: Payment[], rates: Rates): Ledger {
  const j = sumJobs(jobs);
  const c = sumCredited(payments);
  const balance = subMoney(j, c);
  const jobsTRY = toTRY(j, rates);
  const balanceTRY = toTRY(balance, rates);
  return {
    jobs: j,
    credited: c,
    balance,
    jobsTRY,
    balanceTRY,
    creditedTRY: round2(jobsTRY - balanceTRY),
    receivedTRY: round2(payments.reduce((s, p) => s + p.amountTRY, 0)),
  };
}

export function customerLedger(data: AppData, customerId: string): Ledger {
  return ledger(
    data.jobs.filter((j) => j.customerId === customerId),
    data.payments.filter((p) => p.customerId === customerId),
    data.settings.rates,
  );
}

export type BalanceState = 'alacak' | 'kapandi' | 'fazla';

export function balanceState(balance: Money): BalanceState {
  const vals = CURRENCIES.map((c) => balance[c]);
  if (vals.some((v) => v > EPS)) return 'alacak';
  if (vals.some((v) => v < -EPS)) return 'fazla';
  return 'kapandi';
}

export type JobPayState = 'alacak' | 'kismi' | 'tahsil';

/**
 * İş bazlı tahsil durumu: Aynı dövizdeki mahsuplar, tarih sırasına göre
 * en eski işten başlayarak (FIFO) dağıtılır.
 */
export function jobPayStates(
  jobs: Job[],
  payments: Payment[],
): Record<string, { state: JobPayState; covered: number }> {
  const out: Record<string, { state: JobPayState; covered: number }> = {};
  for (const cur of CURRENCIES) {
    let pool = payments.reduce(
      (s, p) => s + p.allocations.filter((a) => a.currency === cur).reduce((x, a) => x + a.amount, 0),
      0,
    );
    const list = jobs
      .filter((j) => j.currency === cur)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (const j of list) {
      const covered = Math.max(0, Math.min(j.amount, pool));
      pool -= covered;
      const state: JobPayState =
        covered >= j.amount - EPS ? 'tahsil' : covered > EPS ? 'kismi' : 'alacak';
      out[j.id] = { state, covered: round2(covered) };
    }
  }
  return out;
}

/** Bakiyesi açık olan ilk dövizi önerir (ödeme formunda varsayılan hedef) */
export function suggestTarget(balance: Money, fallback: Currency): Currency {
  const open = CURRENCIES.filter((c) => balance[c] > EPS);
  if (open.includes(fallback)) return fallback;
  return open[0] ?? fallback;
}

export interface MonthPoint {
  key: string; // 2026-03
  label: string; // Mar 26
  isTRY: number;
  tahsilatTRY: number;
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function monthlySeries(data: AppData, months = 12): MonthPoint[] {
  const now = new Date();
  const pts: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    pts.push({ key, label: `${MONTHS_TR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, isTRY: 0, tahsilatTRY: 0 });
  }
  const idx = new Map(pts.map((p, i) => [p.key, i]));
  const r = data.settings.rates;
  for (const j of data.jobs) {
    const i = idx.get(monthKey(j.date));
    if (i !== undefined) pts[i].isTRY += j.amount * rateOf(j.currency, r);
  }
  for (const p of data.payments) {
    const i = idx.get(monthKey(p.date));
    if (i !== undefined) pts[i].tahsilatTRY += p.amountTRY;
  }
  return pts.map((p) => ({ ...p, isTRY: round2(p.isTRY), tahsilatTRY: round2(p.tahsilatTRY) }));
}

/** İlk iş ayından bu aya kadar geçen ay sayısına göre aylık ortalama iş hacmi (TL) */
export function monthlyAverage(data: AppData): { avgTRY: number; months: number } {
  if (!data.jobs.length) return { avgTRY: 0, months: 0 };
  const first = data.jobs.map((j) => j.date).sort()[0];
  const [fy, fm] = first.split('-').map(Number);
  const now = new Date();
  const months = Math.max(1, (now.getFullYear() - fy) * 12 + (now.getMonth() + 1 - fm) + 1);
  const total = toTRY(sumJobs(data.jobs), data.settings.rates);
  return { avgTRY: round2(total / months), months };
}
