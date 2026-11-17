import type { AppData, Currency, JobTemplate } from '../types';

/** "Tek Piston Pano 24/10" → "Tek Piston Pano" (sondaki tarih notları ve fazla boşluklar atılır) */
export function baseTitle(title: string) {
  return title
    .replace(/\s+\d{1,2}[./]\d{1,2}([./]\d{2,4})?\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const key = (t: string) => baseTitle(t).toLocaleLowerCase('tr');

export interface Suggestion {
  title: string;
  amount: number;
  currency: Currency;
  count: number;
  saved: boolean; // kayıtlı hazır iş mi
  templateId?: string;
}

/**
 * İş formundaki hızlı seçimler: önce kayıtlı hazır işler, sonra en az 2 kez yazılmış işler
 * (bu müşteride yazılanlar öne alınır). Tutar olarak son yazılan tutar önerilir.
 */
export function jobSuggestions(data: AppData, customerId?: string, limit = 8): Suggestion[] {
  const saved: Suggestion[] = (data.settings.templates ?? []).map((t) => ({ title: t.title, amount: t.amount, currency: t.currency, count: 0, saved: true, templateId: t.id }));
  const savedKeys = new Set(saved.map((s) => key(s.title)));

  const groups = new Map<string, { title: string; amount: number; currency: Currency; count: number; mine: number; last: string }>();
  data.jobs.forEach((j) => {
    const k = key(j.title);
    if (!k || savedKeys.has(k)) return;
    const g = groups.get(k);
    const mine = j.customerId === customerId ? 1 : 0;
    if (!g) groups.set(k, { title: baseTitle(j.title), amount: j.amount, currency: j.currency, count: 1, mine, last: j.date });
    else {
      g.count++;
      g.mine += mine;
      if (j.date >= g.last) {
        g.last = j.date;
        g.amount = j.amount;
        g.currency = j.currency;
      }
    }
  });
  const frequent = [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.mine - a.mine || b.count - a.count || b.last.localeCompare(a.last))
    .map((g) => ({ title: g.title, amount: g.amount, currency: g.currency, count: g.count, saved: false }));

  return [...saved, ...frequent].slice(0, limit);
}

export function newTemplate(title: string, amount: number, currency: Currency): JobTemplate {
  return { id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: title.trim(), amount, currency };
}
