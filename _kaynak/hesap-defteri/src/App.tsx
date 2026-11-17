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
import { Button, cx } from './components/ui';
import { CloudBadge, CloudChoiceSheet } from './components/CloudUI';

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
  const { loadState, loadError, reload, saving, saveError, notice, clearNotice } = useStore();
  const { route, go, modal, open, toastMsg, dismissToast } = useUI();
  const online = useOnline();
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const h = () => setUpdateReady(true);
    window.addEventListener('hd:update-ready', h);
    return () => window.removeEventListener('hd:update-ready', h);
  }, []);

  if (loadState === 'loading')
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-faint" />
      </div>
    );

  if (loadState === 'error')
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-sm rounded-[10px] border border-due/40 bg-paper p-5">
          <h1 className="text-[20px] font-bold text-due">Kayıtlar okunamadı</h1>
          <p className="mt-2 text-[16px] text-graphite">
            Telefonun hafızasındaki defter açılamadı. Kayıtlarınız silinmedi; uygulama hiçbir şeyin üzerine yazmadı.
          </p>
          <p className="mt-2 text-[14px] text-pencil">Teknik ayrıntı: {loadError}</p>
          <Button variant="primary" className="mt-4 w-full" onClick={reload}>
            Tekrar dene
          </Button>
          <p className="mt-3 text-[14px] text-pencil">Sorun sürerse uygulamayı kapatıp açın. Elinizde Excel yedeği varsa Ayarlar'dan geri yükleyebilirsiniz.</p>
        </div>
      </div>
    );

  const page = { dashboard: <Dashboard />, customers: <Customers />, movements: <Movements />, settings: <Settings /> }[route.tab];
  const status = (
    <div className="flex items-center gap-2 text-[13px] text-pencil">
      {!online && (
        <span className="inline-flex items-center gap-1 rounded bg-graphite px-1.5 py-px font-semibold text-white">
          <CloudOff size={13} /> Çevrimdışı
        </span>
      )}
      <CloudBadge />
      {saveError ? (
        <span className="inline-flex items-center gap-1 font-semibold text-due">
          <CircleAlert size={13} /> Kaydedilemedi
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CircleCheck size={13} className="text-paid" />}
          {saving ? 'Kaydediliyor' : 'Kaydedildi'}
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Masaüstü yan menü */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Brand />
        <button
          onClick={() => open({ kind: 'quick' })}
          className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink font-semibold text-white transition hover:bg-[#182f78]"
        >
          <Plus size={20} /> Yeni kayıt
        </button>
        <nav className="mt-5 space-y-0.5">
          {NAV.map((n) => (
            <button
              key={n.tab}
              onClick={() => go({ tab: n.tab })}
              aria-current={route.tab === n.tab ? 'page' : undefined}
              className={cx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[16px] font-semibold transition',
                route.tab === n.tab ? 'bg-ink-soft text-ink' : 'text-pencil hover:bg-desk hover:text-graphite',
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
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <Brand compact />
          {status}
        </div>

        <main className="pb-nav mx-auto max-w-5xl px-4 pt-4 lg:px-8 lg:pb-12 lg:pt-8">
          {saveError && (
            <div role="alert" className="mb-4 rounded-lg border border-due bg-due-soft px-3 py-2.5 text-[15px] text-due">
              <b>Son değişiklik kaydedilemedi.</b> Telefonun hafızası dolu olabilir. Hemen Ayarlar'dan Excel yedeği alın. ({saveError})
            </div>
          )}
          {notice && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-ink/40 bg-ink-soft px-3 py-2.5 text-[15px] text-graphite">
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={clearNotice} className="font-semibold text-ink">
                Tamam
              </button>
            </div>
          )}
          {updateReady && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2.5 text-[15px]">
              <span className="flex-1 text-graphite">Uygulamanın yeni sürümü hazır.</span>
              <Button variant="primary" className="min-h-10" onClick={() => (window as unknown as { __hdUpdate: () => void }).__hdUpdate()}>
                Güncelle
              </Button>
            </div>
          )}
          {page}
        </main>
      </div>

      {/* Mobil alt menü */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-1">
          {NAV.slice(0, 2).map((n) => (
            <NavBtn key={n.tab} {...n} active={route.tab === n.tab} onClick={() => go({ tab: n.tab })} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => open({ kind: 'quick' })}
              aria-label="Yeni kayıt"
              className="grid h-13 w-13 place-items-center rounded-xl bg-ink text-white shadow-[0_2px_0_#142a6e] transition active:translate-y-px active:shadow-none"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          </div>
          {NAV.slice(2).map((n) => (
            <NavBtn key={n.tab} {...n} active={route.tab === n.tab} onClick={() => go({ tab: n.tab })} />
          ))}
        </div>
      </nav>

      {/* Pencereler */}
      <CloudChoiceSheet />
      {modal?.kind === 'quick' && <QuickAddSheet />}
      {modal?.kind === 'customer' && <CustomerForm key={modal.id ?? 'new'} id={modal.id} />}
      {modal?.kind === 'job' && <JobForm key={modal.id ?? 'new'} id={modal.id} customerId={modal.customerId} />}
      {modal?.kind === 'payment' && <PaymentForm key={modal.id ?? 'new'} id={modal.id} customerId={modal.customerId} jobId={modal.jobId} />}

      {/* Bildirim */}
      {toastMsg && (
        <div key={toastMsg.key} role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
          <div
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-3 rounded-lg py-2 pl-4 pr-2 text-[15px] font-semibold shadow-lg animate-up',
              toastMsg.tone === 'ok' ? 'bg-graphite text-white' : 'bg-due text-white',
            )}
          >
            {toastMsg.tone === 'ok' ? <CircleCheck size={18} className="shrink-0 text-[#7fd4a6]" /> : <CircleAlert size={18} className="shrink-0" />}
            <span className="py-1">{toastMsg.msg}</span>
            {toastMsg.action && (
              <button
                type="button"
                onClick={() => {
                  toastMsg.action!.run();
                  dismissToast();
                }}
                className="min-h-10 shrink-0 rounded-md bg-white/15 px-3 text-[15px] font-bold text-white hover:bg-white/25"
              >
                {toastMsg.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx('flex min-h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-semibold transition', active ? 'text-ink' : 'text-faint active:text-pencil')}
    >
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
        <div className={cx('font-bold text-ink', compact ? 'text-[18px]' : 'text-[20px]')}>Hesap Defteri</div>
        {!compact && <div className="text-[13px] text-pencil">İş ve tahsilat takibi</div>}
      </div>
    </div>
  );
}
