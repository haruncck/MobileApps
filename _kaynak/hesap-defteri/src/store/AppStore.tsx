import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Customer, Job, Payment, Rates } from '../types';
import { storage } from '../services/storage';
import { emptyData } from '../lib/seed';
import { fetchRates } from '../lib/rates';

type Action =
  | { type: 'replace'; data: AppData }
  | { type: 'upsertCustomer'; customer: Customer }
  | { type: 'deleteCustomer'; id: string }
  | { type: 'upsertJob'; job: Job }
  | { type: 'deleteJob'; id: string }
  | { type: 'upsertPayment'; payment: Payment }
  | { type: 'deletePayment'; id: string }
  | { type: 'setRates'; rates: Rates; source?: string };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

function reducer(s: AppData, a: Action): AppData {
  switch (a.type) {
    case 'replace':
      return a.data;
    case 'upsertCustomer':
      return { ...s, customers: upsert(s.customers, a.customer) };
    case 'deleteCustomer':
      return {
        ...s,
        customers: s.customers.filter((c) => c.id !== a.id),
        jobs: s.jobs.filter((j) => j.customerId !== a.id),
        payments: s.payments.filter((p) => p.customerId !== a.id),
      };
    case 'upsertJob':
      return { ...s, jobs: upsert(s.jobs, a.job) };
    case 'deleteJob':
      return {
        ...s,
        jobs: s.jobs.filter((j) => j.id !== a.id),
        payments: s.payments.map((p) => (p.jobId === a.id ? { ...p, jobId: undefined } : p)),
      };
    case 'upsertPayment':
      return { ...s, payments: upsert(s.payments, a.payment) };
    case 'deletePayment':
      return { ...s, payments: s.payments.filter((p) => p.id !== a.id) };
    case 'setRates':
      return {
        ...s,
        settings: { ...s.settings, rates: a.rates, ratesUpdatedAt: new Date().toISOString(), ratesSource: a.source ?? 'Manuel' },
      };
  }
}

interface Store {
  data: AppData;
  ready: boolean;
  saving: boolean;
  dispatch: React.Dispatch<Action>;
  refreshRates: () => Promise<boolean>;
  ratesLoading: boolean;
}

const Ctx = createContext<Store | null>(null);

const EMPTY: AppData = { version: 1, customers: [], jobs: [], payments: [], settings: { rates: { USD: 0, EUR: 0 } } };

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, EMPTY);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const loaded = useRef(false);

  const refreshRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await fetchRates();
      dispatch({ type: 'setRates', rates: res.rates, source: `${res.source} · ${res.date}` });
      return true;
    } catch {
      return false;
    } finally {
      setRatesLoading(false);
    }
  }, []);

  // İlk yükleme: yerel veri yoksa boş hesap defteriyle başla
  useEffect(() => {
    (async () => {
      const stored = await storage.load();
      const initial = stored ?? emptyData();
      dispatch({ type: 'replace', data: initial });
      loaded.current = true;
      setReady(true);
      if (!stored) await storage.save(initial);
      // Kurlar 6 saatten eskiyse ve çevrimiçiyse arka planda güncelle
      const age = initial.settings.ratesUpdatedAt ? Date.now() - Date.parse(initial.settings.ratesUpdatedAt) : Infinity;
      if (navigator.onLine && age > 6 * 3600 * 1000) refreshRates();
    })();
  }, [refreshRates]);

  // Her değişiklikte anında kaydet
  useEffect(() => {
    if (!loaded.current) return;
    setSaving(true);
    const t = setTimeout(() => {
      storage
        .save(data)
        .catch((e) => console.error(e))
        .finally(() => setSaving(false));
    }, 150);
    return () => clearTimeout(t);
  }, [data]);

  const value = useMemo(() => ({ data, ready, saving, dispatch, refreshRates, ratesLoading }), [data, ready, saving, refreshRates, ratesLoading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}
