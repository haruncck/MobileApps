import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftRight, CircleCheck, CircleAlert, CloudOff, LayoutDashboard, Loader2, Plus, Settings as SettingsIcon, Users } from 'lucide-react';
import { useStore } from './store/AppStore';
import { UIProvider, useUI } from './ui-context';
import type { Tab } from './ui-context';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Movements } from './pages/Movements';
import { Settings } from './pages/Settings';
import { CustomerForm } from './components/forms/CustomerForm';
import { JobForm } from './components/forms/JobForm';
import { PaymentForm } from './components/forms/PaymentForm';
import { QuickAddSheet } from './components/common';
import { cx } from './components/ui';

export default function App() {
  return (
    <UIProvider>
      <Shell />
    </UIProvider>
  );
}

const NAV: Array<{ tab: Tab; label: string; icon: ReactNode }> = [
  { tab: 'dashboard', label: 'Özet', icon: <LayoutDashboard size={22} /> },
  { tab: 'customers', label: 'Müşteriler', icon: <Users size={22} /> },
  { tab: 'movements', label: 'Hareketler', icon: <ArrowLeftRight size={22} /> },
  { tab: 'settings', label: 'Ayarlar', icon: <SettingsIcon size={22} /> },
];

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

function Shell() {
  const { ready, saving } = useStore();
  const { route, go, modal, open, toastMsg } = useUI();
  const online = useOnline();

  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-zinc-500" />
      </div>
    );

  const page = { dashboard: <Dashboard />, customers: <Customers />, movements: <Movements />, settings: <Settings /> }[route.tab];
  const status = (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
      {!online && (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          <CloudOff size={12} /> Çevrimdışı
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CircleCheck size={12} className="text-emerald-500/70" />}
        {saving ? 'Kaydediliyor' : 'Kaydedildi'}
      </span>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Masaüstü yan menü */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-zinc-950/40 p-4 lg:flex">
        <Brand />
        <button
          onClick={() => open({ kind: 'quick' })}
          className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
        >
          <Plus size={20} /> Hızlı Ekle
        </button>
        <nav className="mt-6 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.tab}
              onClick={() => go({ tab: n.tab })}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                route.tab === n.tab ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200',
              )}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto">{status}</div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobil üst bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-app/85 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <Brand compact />
          {status}
        </div>

        <main className="pb-nav mx-auto max-w-6xl px-4 pt-4 lg:px-8 lg:pb-12 lg:pt-8">{page}</main>
      </div>

      {/* Mobil alt menü */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {NAV.slice(0, 2).map((n) => (
            <NavBtn key={n.tab} {...n} active={route.tab === n.tab} onClick={() => go({ tab: n.tab })} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => open({ kind: 'quick' })}
              aria-label="Hızlı Ekle"
              className="-mt-6 mb-1 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500 text-zinc-950 shadow-xl shadow-amber-500/25 ring-4 ring-app transition active:scale-95"
            >
              <Plus size={30} strokeWidth={2.5} />
            </button>
          </div>
          {NAV.slice(2).map((n) => (
            <NavBtn key={n.tab} {...n} active={route.tab === n.tab} onClick={() => go({ tab: n.tab })} />
          ))}
        </div>
      </nav>

      {/* Modallar */}
      {modal?.kind === 'quick' && <QuickAddSheet />}
      {modal?.kind === 'customer' && <CustomerForm key={modal.id ?? 'new'} id={modal.id} />}
      {modal?.kind === 'job' && <JobForm key={modal.id ?? 'new'} id={modal.id} customerId={modal.customerId} />}
      {modal?.kind === 'payment' && <PaymentForm key={modal.id ?? 'new'} id={modal.id} customerId={modal.customerId} jobId={modal.jobId} />}

      {/* Bildirim */}
      {toastMsg && (
        <div key={toastMsg.key} className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 lg:bottom-8">
          <div
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl ring-1 animate-up',
              toastMsg.tone === 'ok' ? 'bg-zinc-800 text-zinc-100 ring-white/10' : 'bg-rose-950 text-rose-100 ring-rose-500/30',
            )}
          >
            {toastMsg.tone === 'ok' ? <CircleCheck size={18} className="text-emerald-400" /> : <CircleAlert size={18} className="text-rose-400" />}
            {toastMsg.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition', active ? 'text-amber-400' : 'text-zinc-500 active:text-zinc-300')}>
      {icon}
      {label}
    </button>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="./icon.svg" alt="" className={compact ? 'h-7 w-7' : 'h-9 w-9'} />
      <div className="leading-tight">
        <div className={cx('font-bold tracking-tight text-white', compact ? 'text-sm' : 'text-base')}>Hesap Defteri</div>
        {!compact && <div className="text-[11px] text-zinc-500">İş & Tahsilat Takibi</div>}
      </div>
    </div>
  );
}
