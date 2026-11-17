import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Tab = 'dashboard' | 'customers' | 'movements' | 'settings';
export interface Route {
  tab: Tab;
  customerId?: string;
}

export type Modal =
  | { kind: 'quick' }
  | { kind: 'customer'; id?: string }
  | { kind: 'job'; id?: string; customerId?: string }
  | { kind: 'payment'; id?: string; customerId?: string; jobId?: string }
  | null;

export interface ToastAction {
  label: string;
  run: () => void;
}

interface UI {
  route: Route;
  go: (r: Route) => void;
  back: () => void;
  modal: Modal;
  open: (m: Modal) => void;
  close: () => void;
  toast: (msg: string, tone?: 'ok' | 'err', action?: ToastAction) => void;
  toastMsg: { msg: string; tone: 'ok' | 'err'; key: number; action?: ToastAction } | null;
  dismissToast: () => void;
}

const Ctx = createContext<UI | null>(null);

function parseHash(): Route {
  const [, tab, id] = (location.hash.replace(/^#/, '') || '/dashboard').split('/');
  const t = (['dashboard', 'customers', 'movements', 'settings'] as Tab[]).includes(tab as Tab) ? (tab as Tab) : 'dashboard';
  return { tab: t, customerId: t === 'customers' && id ? decodeURIComponent(id) : undefined };
}

const toHash = (r: Route) => `#/${r.tab}${r.customerId ? `/${encodeURIComponent(r.customerId)}` : ''}`;

export function UIProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(parseHash);
  const [modal, setModal] = useState<Modal>(null);
  const [toastMsg, setToast] = useState<UI['toastMsg']>(null);

  useEffect(() => {
    const h = () => setRoute(parseHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const go = useCallback((r: Route) => {
    const h = toHash(r);
    if (location.hash !== h) location.hash = h;
    else setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    if (history.length > 1) history.back();
    else go({ tab: 'customers' });
  }, [go]);

  const toast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok', action?: ToastAction) => {
    setToast({ msg, tone, key: Date.now(), action });
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToast(null), toastMsg.action ? 7000 : toastMsg.tone === 'err' ? 5000 : 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  return (
    <Ctx.Provider value={{ route, go, back, modal, open: setModal, close: () => setModal(null), toast, toastMsg, dismissToast: () => setToast(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUI() {
  const u = useContext(Ctx);
  if (!u) throw new Error('useUI must be used inside UIProvider');
  return u;
}
