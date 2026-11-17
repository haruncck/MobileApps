import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { fmt } from '../lib/format';
import { rateOf } from '../lib/money';
import type { Average } from '../lib/money';
import { JobRow, PaymentRow } from './common';
import { EmptyState, IconButton, Ledger, Segmented, Sheet } from './ui';

export type MonthView = 'jobs' | 'pays';

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

const shift = (key: string, d: number) => {
  const [y, m] = key.split('-').map(Number);
  const t = new Date(y, m - 1 + d, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
};

export const currentMonthKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

/** Seçilen ayın işleri ve tahsilatları; oklarla aylar arasında gezilir */
export function MonthDetail({ month: initialMonth, view: initialView, onClose }: { month: string; view: MonthView; onClose: () => void }) {
  const { data } = useStore();
  const { open } = useUI();
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<MonthView>(initialView);
  const custName = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);
  const r = data.settings.rates;

  const jobs = data.jobs.filter((j) => j.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const pays = data.payments.filter((p) => p.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const jobsTRY = jobs.reduce((s, j) => s + j.amount * rateOf(j.currency, r), 0);
  const paysTRY = pays.reduce((s, p) => s + p.amountTRY, 0);

  // Müşteri bazında kısa özet
  const byCustomer = useMemo(() => {
    const m = new Map<string, number>();
    if (view === 'jobs') for (const j of jobs) m.set(j.customerId, (m.get(j.customerId) ?? 0) + j.amount * rateOf(j.currency, r));
    else for (const p of pays) m.set(p.customerId, (m.get(p.customerId) ?? 0) + p.amountTRY);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [view, jobs, pays, r]);

  const isFuture = month >= currentMonthKey();

  return (
    <Sheet open onClose={onClose} title="Ay ay kayıtlar">
      <div className="mb-3 flex items-center justify-between rounded-lg border border-line px-1 py-0.5">
        <IconButton onClick={() => setMonth(shift(month, -1))} aria-label="Önceki ay">
          <ChevronLeft size={20} />
        </IconButton>
        <span className="text-[18px] font-bold capitalize text-graphite">{monthLabel(month)}</span>
        <IconButton onClick={() => setMonth(shift(month, 1))} aria-label="Sonraki ay" disabled={isFuture} className="disabled:opacity-30">
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        label="Liste"
        options={[
          { value: 'jobs', label: `Yapılan iş (${jobs.length})` },
          { value: 'pays', label: `Alınan ödeme (${pays.length})` },
        ]}
      />

      <div className="my-4 text-center">
        <div className={`figure text-[34px] font-bold leading-tight ${view === 'jobs' ? 'text-graphite' : 'text-paid'}`}>
          {fmt(Math.round(view === 'jobs' ? jobsTRY : paysTRY), 'TRY')}
        </div>
        <div className="text-[14px] text-pencil">{view === 'jobs' ? 'Bu ayda yapılan işlerin toplamı ($ ve € bugünkü kurla)' : 'Bu ayda alınan ödemelerin toplamı'}</div>
      </div>

      {byCustomer.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {byCustomer.map(([cid, v]) => (
            <span key={cid} className="num rounded border border-line px-2 py-0.5 text-[14px] text-pencil">
              {custName.get(cid)} <span className="font-semibold text-graphite">{fmt(Math.round(v), 'TRY')}</span>
            </span>
          ))}
        </div>
      )}

      <Ledger>
        <div className="rows">
        {view === 'jobs' ? (
          jobs.length ? (
            jobs.map((j) => <JobRow key={j.id} job={j} customerName={custName.get(j.customerId)} onClick={() => open({ kind: 'job', id: j.id })} />)
          ) : (
            <EmptyState icon={<Inbox size={24} />} title="Bu ay iş kaydı yok" />
          )
        ) : pays.length ? (
          pays.map((p) => <PaymentRow key={p.id} p={p} customerName={custName.get(p.customerId)} onClick={() => open({ kind: 'payment', id: p.id })} />)
        ) : (
          <EmptyState icon={<Inbox size={24} />} title="Bu ay ödeme alınmadı" />
        )}
        </div>
      </Ledger>
      <p className="mt-2 px-1 text-[13px] text-faint">Dövizli işler bugünkü kurla, ödemeler alındığı günün kuruyla TL'ye çevrildi.</p>
    </Sheet>
  );
}

/** Aylık ortalamanın hangi aylardan oluştuğu (kartla aynı seri) */
export function AverageDetail({ avg, onClose, onPick }: { avg: Average; onClose: () => void; onPick: (month: string) => void }) {
  const series = avg.series.slice().reverse();
  const totIs = series.reduce((s, x) => s + x.isTRY, 0);
  const totTa = series.reduce((s, x) => s + x.tahsilatTRY, 0);
  const n = series.length || 1;

  return (
    <Sheet open onClose={onClose} title="Aylık ortalama nasıl çıktı?">
      <p className="mb-3 text-[15px] text-pencil">
        {avg.includesCurrent ? (
          <>Henüz tamamlanmış bir ay yok; yalnızca bu ay gösteriliyor.</>
        ) : (
          <>
            İlk kaydınızın olduğu aydan geçen aya kadar <b className="text-graphite">{n} ayın</b> toplamı ay sayısına bölünür. Bu ay bitmediği için ortalamaya
            katılmaz.
          </>
        )}{' '}
        Bir aya dokunarak o ayın kayıtlarını görebilirsiniz.
        {avg.futureCount > 0 && <span className="mt-1 block text-due">İleri tarihli {avg.futureCount} kayıt ortalamaya katılmadı; tarihlerini kontrol edin.</span>}
      </p>
      <Ledger>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-rule px-3 py-2 text-[14px] font-semibold text-pencil">
          <span>Ay</span>
          <span className="w-24 text-right">İş</span>
          <span className="w-24 text-right">Alınan</span>
        </div>
        <div className="rows">
          {series.map((m) => (
            <button key={m.key} onClick={() => onPick(m.key)} className="num grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2.5 text-left text-[15px] hover:bg-ink-soft/40">
              <span className="whitespace-nowrap capitalize text-graphite">{monthLabel(m.key)}</span>
              <span className={`w-24 text-right ${m.isTRY ? 'font-semibold text-graphite' : 'text-faint'}`}>{fmt(Math.round(m.isTRY), 'TRY')}</span>
              <span className={`w-24 text-right ${m.tahsilatTRY ? 'font-semibold text-paid' : 'text-faint'}`}>{fmt(Math.round(m.tahsilatTRY), 'TRY')}</span>
            </button>
          ))}
        </div>
        <div className="num grid grid-cols-[1fr_auto_auto] gap-x-3 border-t-2 border-graphite/80 px-3 py-2.5 text-[15px]">
          <span className="font-bold text-graphite">Toplam</span>
          <span className="w-24 text-right font-bold text-graphite">{fmt(Math.round(totIs), 'TRY')}</span>
          <span className="w-24 text-right font-bold text-paid">{fmt(Math.round(totTa), 'TRY')}</span>
        </div>
        <div className="num grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 pb-3 pt-1 text-[15px]">
          <span className="font-bold text-ink">Aylık ortalama</span>
          <span className="w-24 text-right font-bold text-ink total-rule">{fmt(Math.round(totIs / n), 'TRY')}</span>
          <span className="w-24 text-right font-bold text-paid total-rule">{fmt(Math.round(totTa / n), 'TRY')}</span>
        </div>
      </Ledger>
    </Sheet>
  );
}
