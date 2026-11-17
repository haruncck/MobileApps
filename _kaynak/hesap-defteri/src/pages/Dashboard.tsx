import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Activity, ArrowDownLeft, Briefcase, ChevronRight, Scale } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { balanceState, customerLedger, ledger, monthlyAverage, monthlySeries } from '../lib/money';
import { fmt, fmtBreakdown, fmtCompact } from '../lib/format';
import { BalanceBadge, JobRow, MoneyChips, PaymentRow } from '../components/common';
import { Card, SectionTitle } from '../components/ui';
import { RatesChip } from '../components/RatesChip';

export function Dashboard() {
  const { data } = useStore();
  const { go, open } = useUI();
  const r = data.settings.rates;

  const total = useMemo(() => ledger(data.jobs, data.payments, r), [data.jobs, data.payments, r]);
  const series = useMemo(() => monthlySeries(data, 12), [data]);
  const avg = useMemo(() => monthlyAverage(data), [data]);
  const thisMonth = series[series.length - 1];
  const custName = new Map(data.customers.map((c) => [c.id, c.name]));

  const customers = useMemo(
    () =>
      data.customers
        .map((c) => ({ c, l: customerLedger(data, c.id) }))
        .sort((a, b) => b.l.balanceTRY - a.l.balanceTRY),
    [data],
  );

  const recent = useMemo(
    () =>
      [
        ...data.jobs.map((j) => ({ kind: 'job' as const, date: j.date, item: j })),
        ...data.payments.map((p) => ({ kind: 'pay' as const, date: p.date, item: p })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [data.jobs, data.payments],
  );

  const lastMonth = series[series.length - 2];
  const curKey = thisMonth?.key ?? '';
  const jobsThisMonth = data.jobs.filter((j) => j.date.startsWith(curKey)).length;
  const paysThisMonth = data.payments.filter((p) => p.date.startsWith(curKey)).length;
  const avgCollect = avg.months ? total.receivedTRY / avg.months : 0;
  const vsAvg = avg.avgTRY > 0 ? ((thisMonth?.isTRY ?? 0) / avg.avgTRY - 1) * 100 : 0;
  const monthName = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm capitalize text-zinc-500">{monthName}</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Özet</h1>
        </div>
        <RatesChip />
      </header>

      {/* 1. Aylık ortalama kazanç */}
      <Card className="relative overflow-hidden p-5 ring-1 ring-amber-400/20">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />
        <KpiHead icon={<Activity size={16} />} label="Aylık ortalama kazanç" tone="text-amber-300" />
        <div className="num mt-2 text-4xl font-bold tracking-tight text-white">{fmt(Math.round(avg.avgTRY), 'TRY')}</div>
        <div className="mt-1 text-sm text-zinc-400">
          {avg.months} aylık ortalama · tahsilat ortalaması <span className="num text-emerald-300">{fmt(Math.round(avgCollect), 'TRY')}</span>/ay
        </div>
      </Card>

      {/* 2. Bu ay */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <KpiHead icon={<Briefcase size={16} />} label="Bu ay yapılan iş" tone="text-zinc-300" />
          <div className="num mt-2 text-2xl font-bold text-white">{fmt(Math.round(thisMonth?.isTRY ?? 0), 'TRY')}</div>
          <div className="mt-1 text-xs text-zinc-500">{jobsThisMonth} iş</div>
          {avg.avgTRY > 0 && (thisMonth?.isTRY ?? 0) > 0 && (
            <div className={`num mt-1 text-xs font-medium ${vsAvg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {vsAvg >= 0 ? '▲' : '▼'} ortalamanın %{Math.abs(Math.round(vsAvg))} {vsAvg >= 0 ? 'üstünde' : 'altında'}
            </div>
          )}
          <div className="num mt-2 border-t border-white/5 pt-2 text-xs text-zinc-500">Geçen ay: {fmt(Math.round(lastMonth?.isTRY ?? 0), 'TRY')}</div>
        </Card>
        <Card className="p-4">
          <KpiHead icon={<ArrowDownLeft size={16} />} label="Bu ay tahsilat" tone="text-emerald-300" />
          <div className="num mt-2 text-2xl font-bold text-emerald-300">{fmt(Math.round(thisMonth?.tahsilatTRY ?? 0), 'TRY')}</div>
          <div className="mt-1 text-xs text-zinc-500">{paysThisMonth} ödeme</div>
          <div className="num mt-2 border-t border-white/5 pt-2 text-xs text-zinc-500">Geçen ay: {fmt(Math.round(lastMonth?.tahsilatTRY ?? 0), 'TRY')}</div>
        </Card>
      </div>

      {/* 3. Toplam alacak */}
      <Card className="mt-3 flex items-center gap-3 p-4" onClick={() => go({ tab: 'customers' })}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
          <Scale size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Toplam alacağım</div>
          <div className="num truncate text-xs text-zinc-500">{fmtBreakdown(total.balance, { hideZero: true })}</div>
        </div>
        <div className="num text-xl font-bold text-amber-300">{fmt(Math.round(total.balanceTRY), 'TRY')}</div>
        <ChevronRight size={16} className="text-zinc-600" />
      </Card>

      <div className="grid gap-x-6 lg:grid-cols-5">
        {/* Grafik */}
        <div className="lg:col-span-3">
          <SectionTitle>Aylık İş & Tahsilat (₺)</SectionTitle>
          <Card className="p-3 pt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#ffffff0d" />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    cursor={{ fill: '#ffffff08' }}
                    contentStyle={{ background: '#18181b', border: '1px solid #ffffff1a', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#e4e4e7', fontWeight: 600 }}
                    formatter={(v) => fmt(Number(v), 'TRY')}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} iconType="circle" iconSize={8} />
                  <Bar dataKey="isTRY" name="Yapılan İş" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="tahsilatTRY" name="Tahsilat" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="px-1 pt-1 text-[11px] text-zinc-600">İşler güncel kurla, tahsilatlar işlem kuruyla TL'ye çevrilmiştir.</p>
          </Card>
        </div>

        {/* Müşteri bakiyeleri */}
        <div className="lg:col-span-2">
          <SectionTitle action={<button className="text-xs text-zinc-400 hover:text-white" onClick={() => go({ tab: 'customers' })}>Tümü</button>}>
            Müşteri Bakiyeleri
          </SectionTitle>
          <Card className="divide-y divide-white/5">
            {customers.map(({ c, l }) => (
              <button key={c.id} onClick={() => go({ tab: 'customers', customerId: c.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-zinc-100">{c.name}</span>
                    <BalanceBadge state={balanceState(l.balance)} />
                  </div>
                  <div className="mt-1">
                    <MoneyChips m={l.balance} size="sm" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold text-zinc-200">{fmt(l.balanceTRY, 'TRY')}</div>
                  <div className="text-[11px] text-zinc-600">TL karşılığı</div>
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </button>
            ))}
          </Card>
        </div>
      </div>

      <SectionTitle action={<button className="text-xs text-zinc-400 hover:text-white" onClick={() => go({ tab: 'movements' })}>Tümü</button>}>Son Hareketler</SectionTitle>
      <Card className="divide-y divide-white/5">
        {recent.map((x) =>
          x.kind === 'job' ? (
            <JobRow key={x.item.id} job={x.item} customerName={custName.get(x.item.customerId)} onClick={() => open({ kind: 'job', id: x.item.id })} />
          ) : (
            <PaymentRow key={x.item.id} p={x.item} customerName={custName.get(x.item.customerId)} onClick={() => open({ kind: 'payment', id: x.item.id })} />
          ),
        )}
      </Card>
    </div>
  );
}

function KpiHead({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide ${tone}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5">{icon}</span>
      {label}
    </div>
  );
}
