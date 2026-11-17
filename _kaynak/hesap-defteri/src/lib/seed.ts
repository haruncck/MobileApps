import type { AppData, Rates } from '../types';

/** Varsayılan kurlar (ilk açılışta internet varsa otomatik güncellenir) */
export const DEFAULT_RATES: Rates = { USD: 42.5, EUR: 49.5 };

export function emptyData(): AppData {
  return {
    version: 1,
    customers: [],
    jobs: [],
    payments: [],
    settings: { rates: { ...DEFAULT_RATES } },
  };
}
