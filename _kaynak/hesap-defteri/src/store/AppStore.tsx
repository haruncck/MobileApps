import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Business, Customer, Job, Payment, Rates } from '../types';
import { loadData, loadSnapshot, requestPersistence, saveData, saveSnapshot, storedRev } from '../services/storage';
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
  | { type: 'setRates'; rates: Rates; source?: string }
  | { type: 'markBackup' }
  | { type: 'setBusiness'; business: Business };

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
        settings: { ...s.settings, rates: a.rates, ratesUpdatedAt: new Date().toISOString(), ratesSource: a.source ?? 'Elle girildi' },
      };
    case 'setBusiness':
      return { ...s, settings: { ...s.settings, business: a.business } };
    case 'markBackup':
      return { ...s, settings: { ...s.settings, lastBackupAt: new Date().toISOString() } };
  }
}

type LoadState = 'loading' | 'ready' | 'error';

interface Store {
  data: AppData;
  loadState: LoadState;
  loadError: string;
  saving: boolean;
  saveError: string;
  persisted: boolean | null;
  dispatch: React.Dispatch<Action>;
  /** Toplu değişiklik: önce geri dönüş noktası alır */
  replaceAll: (next: AppData, reason: string) => Promise<boolean>;
  restoreSnapshot: () => Promise<boolean>;
  refreshRates: () => Promise<boolean>;
  ratesLoading: boolean;
  reload: () => void;
  notice: string;
  clearNotice: () => void;
}

const Ctx = createContext<Store | null>(null);

const EMPTY: AppData = { version: 1, customers: [], jobs: [], payments: [], settings: { rates: { USD: 0, EUR: 0 } } };

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hesap-defteri') : null;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, EMPTY);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  const revRef = useRef(0); // bu sekmenin bildiği son sürüm
  const pending = useRef<Action[]>([]); // henüz diske yazılmamış işlemler (çakışmada yeniden uygulanır)
  const rawDispatch = dispatch;
  const logDispatch = useCallback((a: Action) => {
    pending.current.push(a);
    rawDispatch(a);
  }, [rawDispatch]);
  const skipSave = useRef(true); // yükleme / eşitleme kaynaklı değişiklikleri kaydetme

  const refreshRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await fetchRates();
      dispatch({ type: 'setRates', rates: res.rates, source: `${res.source}, ${res.date}` });
      return true;
    } catch {
      return false;
    } finally {
      setRatesLoading(false);
    }
  }, []);

  /** Diskteki son hâli yükler (kaydetmeden) */
  const pullFromDisk = useCallback(async () => {
    const r = await loadData();
    if (r.status === 'ok') {
      revRef.current = r.data.rev ?? 0;
      skipSave.current = true;
      dispatch({ type: 'replace', data: r.data });
    }
    return r;
  }, []);

  // İlk yükleme
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadState('loading');
      const r = await loadData();
      if (!alive) return;
      if (r.status === 'error') {
        // Okunamadı: boş veriyle ÜZERİNE YAZMA
        setLoadError(r.message);
        setLoadState('error');
        return;
      }
      const initial = r.status === 'ok' ? r.data : { ...emptyData(), rev: 0 };
      revRef.current = initial.rev ?? 0;
      skipSave.current = true;
      dispatch({ type: 'replace', data: initial });
      setLoadState('ready');
      setPersisted(await requestPersistence());
      const age = initial.settings.ratesUpdatedAt ? Date.now() - Date.parse(initial.settings.ratesUpdatedAt) : Infinity;
      if (navigator.onLine && age > 6 * 3600 * 1000) refreshRates();
    })();
    return () => {
      alive = false;
    };
  }, [refreshRates, attempt]);

  // Her değişiklikte HEMEN kaydet (bekleme yok)
  useEffect(() => {
    if (loadState !== 'ready') return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    // Başka bir sekme/pencere bizden sonra yazmış mı? Öyleyse üzerine yazma.
    const disk = storedRev();
    if (disk > revRef.current) {
      // Başka bir pencere bizden sonra yazmış: diskteki hâli al, bu penceredeki işlemleri üzerine yeniden uygula
      const actions = pending.current.slice();
      (async () => {
        const r = await loadData();
        if (r.status !== 'ok') return;
        const merged = actions.reduce(reducer, r.data);
        revRef.current = r.data.rev ?? disk;
        rawDispatch({ type: 'replace', data: merged }); // bu değişiklik normal yoldan kaydedilir
        setNotice('Uygulama başka bir pencerede de açıktı. Oradaki değişiklikler ile buradaki son işleminiz birleştirildi.');
      })();
      return;
    }
    const next: AppData = { ...data, rev: revRef.current + 1, savedAt: new Date().toISOString() };
    revRef.current = next.rev!;
    setSaving(true);
    const saved = pending.current.length;
    saveData(next)
      .then(() => {
        pending.current.splice(0, saved);
        setSaveError('');
        channel?.postMessage({ rev: next.rev });
      })
      .catch((e) => setSaveError((e as Error).message || 'Kayıt yapılamadı'))
      .finally(() => setSaving(false));
  }, [data, loadState, rawDispatch]);

  // Diğer sekmelerdeki değişiklikleri al
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data?.rev === 'number' && e.data.rev > revRef.current) pullFromDisk();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'saha-cari:rev' && Number(e.newValue) > revRef.current) pullFromDisk();
    };
    channel?.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    return () => {
      channel?.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
    };
  }, [pullFromDisk]);

  const replaceAll = useCallback(
    async (next: AppData, reason: string) => {
      // Boş defterin geri dönüş noktası anlamsız: yalnızca kayıt varsa saklanır.
      // Geri dönüş noktası yazılamazsa toplu değişiklik YAPILMAZ.
      if (data.customers.length || data.jobs.length || data.payments.length) {
        try {
          await saveSnapshot(data, reason);
        } catch {
          return false;
        }
      }
      logDispatch({ type: 'replace', data: { ...next, settings: { ...next.settings } } });
      return true;
    },
    [data, logDispatch],
  );

  const restoreSnapshot = useCallback(async () => {
    const s = await loadSnapshot();
    if (!s) return false;
    try {
      await saveSnapshot(data, 'Geri alma öncesi');
    } catch {
      /* geri alma yine de yapılır */
    }
    logDispatch({ type: 'replace', data: s.data });
    return true;
  }, [data, logDispatch]);

  const value = useMemo(
    () => ({
      data,
      loadState,
      loadError,
      saving,
      saveError,
      persisted,
      dispatch: logDispatch,
      replaceAll,
      restoreSnapshot,
      refreshRates,
      ratesLoading,
      reload: () => setAttempt((x) => x + 1),
      notice,
      clearNotice: () => setNotice(''),
    }),
    [data, loadState, loadError, saving, saveError, persisted, logDispatch, replaceAll, restoreSnapshot, refreshRates, ratesLoading, notice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}
