import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Business, Customer, Job, JobTemplate, Payment, Rates } from '../types';
import { loadData, loadSnapshot, requestPersistence, saveData, saveSnapshot, storedRev, trustOwn } from '../services/storage';
import * as cloudApi from '../services/cloud';
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
  | { type: 'setBusiness'; business: Business }
  | { type: 'setTemplates'; templates: JobTemplate[] };

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
    case 'setTemplates':
      return { ...s, settings: { ...s.settings, templates: a.templates } };
    case 'setBusiness':
      return { ...s, settings: { ...s.settings, business: a.business } };
    case 'markBackup':
      return { ...s, settings: { ...s.settings, lastBackupAt: new Date().toISOString() } };
  }
}

type LoadState = 'loading' | 'ready' | 'error';

export type CloudStatus = 'off' | 'needs-auth' | 'syncing' | 'synced' | 'offline' | 'error' | 'choose';
export interface CloudChoice {
  remote: AppData;
  remoteRev: number;
  email: string;
  remoteAt: string;
}
export interface Cloud {
  configured: boolean;
  status: CloudStatus;
  email?: string;
  lastSyncAt?: string;
  error?: string;
  choice?: CloudChoice;
}

const counts = (d: AppData) => ({ c: d.customers.length, j: d.jobs.length, p: d.payments.length });
const isEmpty = (d: AppData) => !d.customers.length && !d.jobs.length && !d.payments.length;
const sameContent = (a: AppData, b: AppData) => {
  const k = (d: AppData) =>
    JSON.stringify([d.customers, d.jobs, d.payments].map((l) => (l as Array<{ id: string }>).slice().sort((x, y) => x.id.localeCompare(y.id))));
  return k(a) === k(b);
};
export { counts as dataCounts };

interface Store {
  cloud: Cloud;
  cloudConnect: (email: string, password: string, mode: 'signin' | 'signup') => Promise<void>;
  cloudReauth: () => Promise<void>;
  cloudSyncNow: () => Promise<void>;
  cloudChoose: (which: 'remote' | 'local') => Promise<void>;
  cloudDisconnect: () => void;
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
  const cloudPending = useRef<Action[]>([]); // henüz buluta gönderilmemiş işlemler
  const logDispatch = useCallback((a: Action) => {
    pending.current.push(a);
    if (cloudApi.readCloudState().email) cloudPending.current.push(a);
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

  /* ------------------------- Bulut eşitleme (Supabase) ------------------------- */
  const [cloud, setCloud] = useState<Cloud>(() => {
    const st = cloudApi.readCloudState();
    return { configured: cloudApi.cloudConfigured(), status: st.email ? 'syncing' : 'off', email: st.email, lastSyncAt: st.lastSyncAt };
  });
  const dataRef = useRef(data);
  dataRef.current = data;
  const syncing = useRef(false);
  const again = useRef(false);

  const patchCloud = useCallback((p: Partial<Cloud>) => setCloud((c) => ({ ...c, ...p })), []);

  const cloudSyncNow = useCallback(async () => {
    const st = cloudApi.readCloudState();
    if (!st.email || !cloudApi.cloudConfigured()) return patchCloud({ status: 'off' });
    if (!navigator.onLine) return patchCloud({ status: 'offline' });
    if (syncing.current) {
      again.current = true;
      return;
    }
    syncing.current = true;
    patchCloud({ status: 'syncing', error: undefined });
    try {
      // Çakışma olursa (başka cihaz araya yazdıysa) birleştirip en fazla 3 kez dene
      for (let attempt = 0; attempt < 3; attempt++) {
        const rRev = await cloudApi.remoteRev();
        if (rRev === null) {
          // Bulutta satır yok (silinmiş): bu cihazdaki defterle oluştur
          st.remoteRev = await cloudApi.insertRemote(dataRef.current);
          cloudPending.current = [];
          break;
        }
        const n = cloudPending.current.length;
        if (rRev > (st.remoteRev ?? 0)) {
          // Başka bir cihaz yazmış: buluttakini al, bu cihazdaki gönderilmemiş işlemleri üzerine uygula
          const remote = await cloudApi.fetchRemote();
          if (!remote) continue;
          const base = trustOwn(remote.data);
          const actions = cloudPending.current.slice(0, n);
          const merged = actions.reduce(reducer, { ...base, rev: Math.max(base.rev ?? 0, revRef.current) });
          rawDispatch({ type: 'replace', data: merged });
          dataRef.current = merged;
          st.remoteRev = remote.rev;
          if (!actions.length) break;
          const res = await cloudApi.updateRemote(merged, remote.rev);
          if (res === 'conflict') continue;
          st.remoteRev = res;
          cloudPending.current.splice(0, n);
          break;
        }
        if (!n) break; // gönderilecek bir şey yok
        const res = await cloudApi.updateRemote(dataRef.current, rRev);
        if (res === 'conflict') continue;
        st.remoteRev = res;
        cloudPending.current.splice(0, n);
        break;
      }
      st.lastSyncAt = new Date().toISOString();
      cloudApi.writeCloudState(st);
      patchCloud({ status: 'synced', lastSyncAt: st.lastSyncAt, email: st.email });
    } catch (e) {
      if (e instanceof cloudApi.AuthNeeded) patchCloud({ status: 'needs-auth' });
      else patchCloud({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof TypeError || /fetch|network|load failed/i.test(String(e)) ? cloudApi.PAUSED_MSG : e instanceof Error ? e.message : String(e) });
    } finally {
      syncing.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(() => void cloudSyncNow(), 300);
      }
    }
  }, [patchCloud, rawDispatch]);

  const cloudConnect = useCallback(
    async (email: string, password: string, mode: 'signin' | 'signup') => {
      patchCloud({ status: 'syncing', error: undefined });
      try {
        const em = mode === 'signup' ? await cloudApi.signUp(email, password) : await cloudApi.signIn(email, password);
        const remote = await cloudApi.fetchRemote();
        const local = dataRef.current;
        const now = new Date().toISOString();
        if (!remote) {
          const rev = await cloudApi.insertRemote(local);
          cloudApi.writeCloudState({ email: em, remoteRev: rev, lastSyncAt: now });
          cloudPending.current = [];
          patchCloud({ status: 'synced', email: em, lastSyncAt: now });
          return;
        }
        const rdata = trustOwn(remote.data);
        if (isEmpty(local) || sameContent(local, rdata)) {
          if (!sameContent(local, rdata)) rawDispatch({ type: 'replace', data: { ...rdata, rev: Math.max(rdata.rev ?? 0, revRef.current) } });
          cloudApi.writeCloudState({ email: em, remoteRev: remote.rev, lastSyncAt: now });
          cloudPending.current = [];
          patchCloud({ status: 'synced', email: em, lastSyncAt: now });
          return;
        }
        // İki tarafta da farklı kayıt var: kullanıcı seçsin
        patchCloud({ status: 'choose', choice: { remote: rdata, remoteRev: remote.rev, email: em, remoteAt: remote.updatedAt } });
      } catch (e) {
        patchCloud({ status: cloudApi.readCloudState().email ? 'needs-auth' : 'off', error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },
    [patchCloud, rawDispatch],
  );

  const cloudChoose = useCallback(
    async (which: 'remote' | 'local') => {
      const ch = cloud.choice;
      if (!ch) return;
      patchCloud({ status: 'syncing' });
      try {
        const now = new Date().toISOString();
        if (which === 'remote') {
          await saveSnapshot(dataRef.current, 'Buluttaki defteri yükleme').catch(() => undefined);
          rawDispatch({ type: 'replace', data: { ...ch.remote, rev: Math.max(ch.remote.rev ?? 0, revRef.current) } });
          cloudApi.writeCloudState({ email: ch.email, remoteRev: ch.remoteRev, lastSyncAt: now });
        } else {
          await saveSnapshot(ch.remote, 'Buluttaki eski defter').catch(() => undefined);
          const res = await cloudApi.updateRemote(dataRef.current, ch.remoteRev);
          if (res === 'conflict') throw new Error('Bulut bu arada değişti, tekrar bağlanın.');
          cloudApi.writeCloudState({ email: ch.email, remoteRev: res, lastSyncAt: now });
        }
        cloudPending.current = [];
        patchCloud({ status: 'synced', email: ch.email, lastSyncAt: now, choice: undefined });
      } catch (e) {
        patchCloud({ status: 'error', error: e instanceof Error ? e.message : String(e), choice: undefined });
      }
    },
    [cloud.choice, patchCloud, rawDispatch],
  );

  const cloudReauth = useCallback(async () => {
    patchCloud({ status: 'off' });
  }, [patchCloud]);

  const cloudDisconnect = useCallback(() => {
    void cloudApi.signOut();
    cloudApi.clearCloudState();
    cloudPending.current = [];
    patchCloud({ status: 'off', email: undefined, lastSyncAt: undefined, choice: undefined, error: undefined });
  }, [patchCloud]);

  // Yerel kayıttan sonra buluta gönder (kısa bekleme ile toplu)
  useEffect(() => {
    if (loadState !== 'ready' || !cloudPending.current.length || !cloudApi.readCloudState().email) return;
    const t = setTimeout(() => void cloudSyncNow(), 1200);
    return () => clearTimeout(t);
  }, [data, loadState, cloudSyncNow]);

  // Açılışta, uygulamaya dönünce, internet gelince ve arada bir buluttakini kontrol et
  useEffect(() => {
    if (loadState !== 'ready') return;
    const tick = () => {
      if (document.visibilityState === 'visible') void cloudSyncNow();
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    const iv = setInterval(tick, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
      clearInterval(iv);
    };
  }, [loadState, cloudSyncNow]);

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
      cloud,
      cloudConnect,
      cloudReauth,
      cloudSyncNow,
      cloudChoose,
      cloudDisconnect,
    }),
    [cloud, cloudConnect, cloudReauth, cloudSyncNow, cloudChoose, cloudDisconnect, data, loadState, loadError, saving, saveError, persisted, logDispatch, replaceAll, restoreSnapshot, refreshRates, ratesLoading, notice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}
