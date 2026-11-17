import type { AppData, Currency, Job, Payment, PaymentType, JobStatus } from '../types';
import { CURRENCIES } from '../types';
import { computePayment, round2 } from '../lib/money';
import { DEFAULT_RATES } from '../lib/seed';
import { uid } from '../lib/id';

const cur = (v: unknown, fb: Currency = 'TRY'): Currency =>
  CURRENCIES.includes(String(v).toUpperCase() as Currency) ? (String(v).toUpperCase() as Currency) : fb;
const num = (v: unknown, fb = 0) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
};
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const optStr = (v: unknown) => (str(v).trim() ? str(v) : undefined);
const date = (v: unknown) => {
  const s = str(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
};

/** İçe aktarılan / eski sürüm veriyi güvenli biçime getirir */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeData(raw: any): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Geçersiz veri');
  const rates = {
    USD: num(raw.settings?.rates?.USD, DEFAULT_RATES.USD) || DEFAULT_RATES.USD,
    EUR: num(raw.settings?.rates?.EUR, DEFAULT_RATES.EUR) || DEFAULT_RATES.EUR,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customers = (Array.isArray(raw.customers) ? raw.customers : []).map((c: any) => ({
    id: str(c.id) || uid(),
    name: str(c.name).trim() || 'İsimsiz Müşteri',
    phone: optStr(c.phone),
    note: optStr(c.note),
    createdAt: str(c.createdAt) || new Date().toISOString(),
  }));
  const ids = new Set(customers.map((c: { id: string }) => c.id));

  const jobs: Job[] = (Array.isArray(raw.jobs) ? raw.jobs : [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((j: any) => ({
      id: str(j.id) || uid(),
      customerId: str(j.customerId),
      title: str(j.title).trim() || 'İş',
      date: date(j.date),
      amount: round2(num(j.amount)),
      currency: cur(j.currency),
      status: (['devam', 'tamamlandi', 'faturalandi'].includes(j.status) ? j.status : 'tamamlandi') as JobStatus,
      note: optStr(j.note),
    }))
    .filter((j: Job) => ids.has(j.customerId));

  const payments: Payment[] = (Array.isArray(raw.payments) ? raw.payments : [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const currency = cur(p.currency);
      const pr = { USD: num(p.rates?.USD, rates.USD) || rates.USD, EUR: num(p.rates?.EUR, rates.EUR) || rates.EUR };
      const base = {
        id: str(p.id) || uid(),
        customerId: str(p.customerId),
        date: date(p.date),
        type: (['nakit', 'havale', 'cek', 'urun'].includes(p.type) ? p.type : 'havale') as PaymentType,
        amount: round2(num(p.amount)),
        currency,
        mode: (p.mode === 'auto' ? 'auto' : 'single') as 'auto' | 'single',
        targetCurrency: cur(p.targetCurrency, currency),
        rates: pr,
        jobId: optStr(p.jobId),
        description: optStr(p.description),
        note: optStr(p.note),
      };
      // Kayıtlı dağılım varsa olduğu gibi korunur (işlem anında dondurulmuş mahsup)
      if (Array.isArray(p.allocations) && p.allocations.length) {
        return {
          ...base,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allocations: p.allocations.map((a: any) => ({ currency: cur(a.currency), amount: round2(num(a.amount)) })),
          amountTRY: round2(num(p.amountTRY, base.amount * (currency === 'TRY' ? 1 : pr[currency]))),
        };
      }
      return computePayment({ ...base, mode: 'single' });
    })
    .filter((p: Payment) => ids.has(p.customerId));

  return {
    version: 1,
    customers,
    jobs,
    payments,
    settings: {
      rates,
      ratesUpdatedAt: optStr(raw.settings?.ratesUpdatedAt),
      ratesSource: optStr(raw.settings?.ratesSource),
    },
  };
}
