import type { Currency, Money } from '../types';
import { CURRENCIES } from '../types';
import { EPS } from './money';

export const SYMBOL: Record<Currency, string> = { TRY: '₺', USD: '$', EUR: '€' };

const nf = (digits: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const nf0 = nf(0);
const nf2 = nf(2);

/** ₺400.000 / $2.200 / €306,30 – küsurat varsa 2 hane gösterir */
export function fmt(amount: number, cur: Currency, opts: { signed?: boolean; decimals?: boolean } = {}) {
  const abs = Math.abs(amount);
  const hasFraction = Math.abs(abs - Math.round(abs)) > EPS;
  const body = (opts.decimals || hasFraction ? nf2 : nf0).format(abs);
  const sign = amount < -EPS ? '-' : opts.signed && amount > EPS ? '+' : '';
  return `${sign}${SYMBOL[cur]}${body}`;
}

export function fmtCompact(amount: number) {
  return new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
}

/** "₺928.700 + $850 + €0" biçiminde saf döviz kırılımı */
export function fmtBreakdown(m: Money, opts: { hideZero?: boolean } = {}) {
  const parts = CURRENCIES.filter((c) => !opts.hideZero || Math.abs(m[c]) > EPS).map((c) => fmt(m[c], c));
  return parts.length ? parts.join(' + ') : fmt(0, 'TRY');
}

export function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function fmtRate(n: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
}

/** "1.234,56" veya "1234.56" girişlerini sayıya çevirir */
export function parseNum(s: string): number {
  if (!s) return NaN;
  let t = s.trim().replace(/\s|₺|\$|€/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  return Number(t);
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
