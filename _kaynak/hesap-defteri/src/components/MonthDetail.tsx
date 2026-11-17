import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { fmt } from '../lib/format';
import { monthlySeries, rateOf } from '../lib/money';
import { JobRow, PaymentRow } from './common';
import { Card, EmptyState, IconButton, Segmented, Sheet } from './ui';

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
    <Sheet open onClose={onClose} title="Aylık Döküm">
      <div className="mb-3 flex items-center justify-between rounded-xl bg-white/[0.03] px-1 py-1">
        <IconButton onClick={() => setMonth(shift(month, -1))} aria-label="Önceki ay">
          <ChevronLeft size={20} />
        </IconButton>
        <span className="font-semibold capitalize text-white">{monthLabel(month)}</span>
        <IconButton onClick={() => setMonth(shift(month, 1))} aria-label="Sonraki ay" disabled={isFuture} className="disabled:opacity-30">
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'jobs', label: `Yapılan iş (${jobs.length})` },
          { value: 'pays', label: `Tahsilat (${pays.length})` },
        ]}
      />

      <div className="my-4 text-center">
        <div className={`num text-3xl font-bold ${view === 'jobs' ? 'text-white' : 'text-emerald-300'}`}>
          {fmt(Math.round(view === 'jobs' ? jobsTRY : paysTRY), 'TRY')}
        </div>
        <div className="text-xs text-zinc-500">{view === 'jobs' ? 'Bu ay yapılan işlerin toplamı' : 'Bu ay alınan ödemelerin toplamı'}</div>
      </div>

      {byCustomer.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {byCustomer.map(([cid, v]) => (
            <span key={cid} className="num rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
              {custName.get(cid)} <span className="font-semibold text-zinc-100">{fmt(Math.round(v), 'TRY')}</span>
            </span>
          ))}
        </div>
      )}

      <Card className="divide-y divide-white/5 overflow-hidden">
        {view === 'jobs' ? (
          jobs.length ? (
            jobs.map((j) => <JobRow key={j.id} job={j} customerName={custName.get(j.customerId)} onClick={() => open({ kind: 'job', id: j.id })} />)
          ) : (
            <EmptyState icon={<Inbox size={24} />} title="Bu ay iş kaydı yok" />
          )
        ) : pays.length ? (
          pays.map((p) => <PaymentRow key={p.id} p={p} customerName={custName.get(p.customerId)} onClick={() => open({ kind: 'payment', id: p.id })} />)
        ) : (
          <EmptyState icon={<Inbox size={24} />} title="Bu ay tahsilat yok" />
        )}
      </Card>
      <p className="mt-2 px-1 text-[11px] text-zinc-600">Dövizli işler güncel kurla, tahsilatlar ödeme günkü kurla TL'ye çevrilmiştir.</p>
    </Sheet>
  );
}

/** Aylık ortalamanın hangi aylardan oluştuğu */
export function AverageDetail({ months, onClose, onPick }: { months: number; onClose: () => void; onPick: (month: string) => void }) {
  const { data } = useStore();
  const series = useMemo(() => monthlySeries(data, Math.max(1, months)).slice().reverse(), [data, months]);
  const totIs = series.reduce((s, x) => s + x.isTRY, 0);
  const totTa = series.reduce((s, x) => s + x.tahsilatTRY, 0);
  const n = series.length || 1;

  return (
    <Sheet open onClose={onClose} title="Aylık Ortalama Nasıl Hesaplandı?">
      <p className="mb-3 text-sm text-zinc-400">
        İlk kaydınızdan bu yana geçen <b className="text-zinc-200">{n} ayın</b> toplamı ay sayısına bölünür. Bir aya dokunarak o ayın işlerini görebilirsiniz.
      </p>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-white/5 px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
          <span>Ay</span>
          <span className="w-24 text-right">İş</span>
          <span className="w-24 text-right">Tahsilat</span>
        </div>
        <div className="divide-y divide-white/5">
          {series.map((m) => (
            <button key={m.key} onClick={() => onPick(m.key)} className="num grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-2.5 text-left text-[13px] hover:bg-white/[0.03]">
              <span className="whitespace-nowrap capitalize text-zinc-300">{monthLabel(m.key)}</span>
              <span className={`w-24 text-right ${m.isTRY ? 'font-medium text-zinc-100' : 'text-zinc-600'}`}>{fmt(Math.round(m.isTRY), 'TRY')}</span>
              <span className={`w-24 text-right ${m.tahsilatTRY ? 'text-emerald-300' : 'text-zinc-600'}`}>{fmt(Math.round(m.tahsilatTRY), 'TRY')}</span>
            </button>
          ))}
        </div>
        <div className="num grid grid-cols-[1fr_auto_auto] gap-x-4 border-t border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="font-semibold text-zinc-300">Toplam</span>
          <span className="w-24 text-right font-semibold text-zinc-100">{fmt(Math.round(totIs), 'TRY')}</span>
          <span className="w-24 text-right font-semibold text-emerald-300">{fmt(Math.round(totTa), 'TRY')}</span>
        </div>
        <div className="num grid grid-cols-[1fr_auto_auto] gap-x-4 bg-amber-400/[0.06] px-4 py-2.5 text-sm">
          <span className="font-semibold text-amber-300">Aylık ortalama</span>
          <span className="w-24 text-right font-bold text-amber-300">{fmt(Math.round(totIs / n), 'TRY')}</span>
          <span className="w-24 text-right font-bold text-emerald-300">{fmt(Math.round(totTa / n), 'TRY')}</span>
        </div>
      </Card>
    </Sheet>
  );
}
