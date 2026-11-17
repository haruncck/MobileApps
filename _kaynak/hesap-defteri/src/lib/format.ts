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

/** "₺928.700 ve $850" – sıfır olanlar yazılmaz */
export function fmtWords(m: Money) {
  const parts = CURRENCIES.filter((c) => Math.abs(m[c]) > EPS).map((c) => fmt(m[c], c));
  if (!parts.length) return 'Hesaplar kapalı';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} ve ${parts[parts.length - 1]}`;
}

export function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function fmtRate(n: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
}

/**
 * Kullanıcının yazdığı tutarı sayıya çevirir (Türkçe yazım kuralları):
 *   "10.000" → 10000   "1.250,50" → 1250.5   "44840" → 44840   "40,76" → 40.76
 *   "₺ 25.000" → 25000   "1 250" → 1250
 * Virgül yoksa: nokta(lar)dan sonra tam 3 hane geliyorsa binlik ayırıcıdır ("10.000", "1.250.000");
 * aksi halde ondalık kabul edilir ("40.76", "42.5").
 * `rate: true` (kur alanları): virgül yoksa nokta her zaman ondalıktır ("42.245" → 42.245).
 * Anlaşılamayan girişte NaN döner (sessizce yanlış sayı üretmez).
 */
export function parseNum(input: string, opts: { rate?: boolean } = {}): number {
  if (input === undefined || input === null) return NaN;
  let t = String(input).trim().replace(/[₺$€\s\u00a0]/g, '').replace(/^(TL|TRY|USD|EUR)|(TL|TRY|USD|EUR)$/gi, '');
  if (!t) return NaN;
  if (!/^-?[\d.,]+$/.test(t)) return NaN;
  const commas = (t.match(/,/g) || []).length;
  if (commas > 1) return NaN;
  if (commas === 1) {
    const [int, dec] = t.split(',');
    // binlik noktaları doğru gruplanmış olmalı: 1.250,50
    if (int.includes('.') && !/^-?\d{1,3}(\.\d{3})+$/.test(int)) return NaN;
    t = `${int.replace(/\./g, '')}.${dec}`;
  } else if (t.includes('.')) {
    if (!opts.rate && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    else if ((t.match(/\./g) || []).length > 1) return NaN;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Yazarken okunabilirlik için: 10000 → "10.000" (ondalık kısım korunur) */
export function groupThousands(input: string): string {
  const n = parseNum(input);
  if (!Number.isFinite(n)) return input;
  const hasComma = input.includes(',');
  const [, dec = ''] = input.split(',');
  const int = Math.trunc(Math.abs(n));
  const body = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(int);
  return `${n < 0 ? '-' : ''}${body}${hasComma ? `,${dec}` : ''}`;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
