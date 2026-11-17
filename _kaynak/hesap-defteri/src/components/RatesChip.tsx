import { Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { fmtRate } from '../lib/format';

export function RatesChip() {
  const { data, refreshRates, ratesLoading } = useStore();
  const { toast, go } = useUI();
  const r = data.settings.rates;
  const upd = data.settings.ratesUpdatedAt ? new Date(data.settings.ratesUpdatedAt) : null;

  return (
    <div className="flex items-center gap-1 rounded-xl bg-panel py-1 pl-3 pr-1 ring-1 ring-inset ring-white/[0.06]">
      <button onClick={() => go({ tab: 'settings' })} className="num text-left text-xs leading-tight" title="Kurları düzenle">
        <span className="text-zinc-500">$</span> <span className="font-semibold text-zinc-200">{fmtRate(r.USD)}</span>
        <span className="mx-1.5 text-zinc-700">|</span>
        <span className="text-zinc-500">€</span> <span className="font-semibold text-zinc-200">{fmtRate(r.EUR)}</span>
        {upd && <span className="block text-[10px] text-zinc-600">{upd.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
      </button>
      <button
        onClick={async () => { const ok = await refreshRates(); toast(ok ? 'Kurlar güncellendi' : 'Kur alınamadı – çevrimdışı olabilirsiniz', ok ? 'ok' : 'err'); }}
        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
        aria-label="Kurları güncelle"
      >
        {ratesLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      </button>
    </div>
  );
}
