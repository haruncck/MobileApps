import type { Rates } from '../types';

export interface RateResult {
  rates: Rates;
  source: string;
  date: string;
}

/**
 * Güncel piyasa kurunu çeker (TL karşılığı).
 * Not: TCMB today.xml tarayıcıdan CORS nedeniyle doğrudan okunamaz; bu yüzden
 * CORS destekli açık API'ler kullanılır. Kullanıcı her zaman kuru elle düzenleyebilir.
 */
export async function fetchRates(signal?: AbortSignal): Promise<RateResult> {
  const providers: Array<() => Promise<RateResult>> = [
    async () => {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?base=TRY&symbols=USD,EUR', { signal });
      if (!r.ok) throw new Error('frankfurter');
      const j = await r.json();
      return { rates: { USD: 1 / j.rates.USD, EUR: 1 / j.rates.EUR }, source: 'ECB (Frankfurter)', date: j.date };
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/TRY', { signal });
      if (!r.ok) throw new Error('er-api');
      const j = await r.json();
      if (j.result !== 'success') throw new Error('er-api');
      return {
        rates: { USD: 1 / j.rates.USD, EUR: 1 / j.rates.EUR },
        source: 'ExchangeRate-API',
        date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10),
      };
    },
  ];
  let lastErr: unknown;
  for (const p of providers) {
    try {
      const res = await p();
      return {
        ...res,
        rates: { USD: Math.round(res.rates.USD * 10000) / 10000, EUR: Math.round(res.rates.EUR * 10000) / 10000 },
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Kur alınamadı');
}
