import { Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { fmtRate } from '../lib/format';

/** Güncel kur bilgisi (yalnızca TL karşılıklarını göstermek için kullanılır) */
export function RatesChip() {
  const { data, refreshRates, ratesLoading } = useStore();
  const { toast, go } = useUI();
  const r = data.settings.rates;
  const upd = data.settings.ratesUpdatedAt ? new Date(data.settings.ratesUpdatedAt) : null;

  return (
    <div className="flex items-center rounded-lg border border-line bg-paper">
      <button type="button" onClick={() => go({ tab: 'settings' })} className="px-3 py-1.5 text-left leading-tight" title="Kurları düzenle">
        <span className="num block text-[14px] text-graphite">
          $ <b className="font-semibold">{fmtRate(r.USD)}</b>
          <span className="mx-2 text-line">|</span>€ <b className="font-semibold">{fmtRate(r.EUR)}</b>
        </span>
        <span className="block text-[12px] text-faint">
          {upd ? `Kur: ${upd.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Kur elle girildi'}
        </span>
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await refreshRates();
          toast(ok ? 'Kurlar güncellendi' : 'Kur alınamadı. İnternet bağlantınızı kontrol edin.', ok ? 'ok' : 'err');
        }}
        className="grid h-11 w-11 place-items-center border-l border-line text-pencil hover:text-ink"
        aria-label="Kurları güncelle"
      >
        {ratesLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
      </button>
    </div>
  );
}
