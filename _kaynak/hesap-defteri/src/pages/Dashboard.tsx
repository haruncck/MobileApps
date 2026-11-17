import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Activity, ArrowDownLeft, Briefcase, CalendarRange, ChevronRight, Scale, Users } from 'lucide-react';
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

  const pct = total.jobsTRY > 0 ? Math.min(100, (total.creditedTRY / total.jobsTRY) * 100) : 0;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Genel Özet</h1>
        </div>
        <RatesChip />
      </header>

      {/* KPI kartları */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <KpiHead icon={<Briefcase size={16} />} label="Yapılan İşler Toplamı" tone="text-zinc-300" />
          <div className="num mt-2 text-2xl font-bold text-white">{fmt(total.jobsTRY, 'TRY')}</div>
          <div className="num mt-1 text-xs text-zinc-500">{fmtBreakdown(total.jobs)}</div>
        </Card>
        <Card className="p-4">
          <KpiHead icon={<ArrowDownLeft size={16} />} label="Toplam Alınan (Tahsilat)" tone="text-emerald-300" />
          <div className="num mt-2 text-2xl font-bold text-emerald-300">{fmt(total.creditedTRY, 'TRY')}</div>
          <div className="num mt-1 text-xs text-zinc-500">{fmtBreakdown(total.credited)}</div>
          <div className="num mt-1 text-[11px] text-zinc-600">Fiili tahsilat (işlem kuruyla): {fmt(total.receivedTRY, 'TRY')}</div>
        </Card>
        <Card className="relative overflow-hidden p-4 ring-1 ring-amber-400/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
          <KpiHead icon={<Scale size={16} />} label="Net Kalan Alacak" tone="text-amber-300" />
          <div className="num mt-2 text-3xl font-bold text-amber-300">{fmt(total.balanceTRY, 'TRY')}</div>
          <div className="num mt-1 text-sm font-medium text-amber-100/80">{fmtBreakdown(total.balance)}</div>
          <div className="num mt-1 text-[11px] text-zinc-600">
            {fmt(total.jobsTRY, 'TRY')} − {fmt(total.creditedTRY, 'TRY')}
          </div>
        </Card>
      </div>

      {/* Tahsilat oranı */}
      <Card className="mt-3 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Tahsilat oranı</span>
          <span className="num font-semibold text-zinc-100">%{pct.toFixed(1).replace('.', ',')}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Mini istatistikler */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini icon={<Activity size={15} />} label="Aylık Ort. Ciro" value={fmt(avg.avgTRY, 'TRY')} sub={`${avg.months} aylık ortalama`} />
        <Mini icon={<CalendarRange size={15} />} label="Bu Ay İş" value={fmt(thisMonth?.isTRY ?? 0, 'TRY')} />
        <Mini icon={<ArrowDownLeft size={15} />} label="Bu Ay Tahsilat" value={fmt(thisMonth?.tahsilatTRY ?? 0, 'TRY')} />
        <Mini icon={<Users size={15} />} label="Açık Cari" value={`${customers.filter((x) => balanceState(x.l.balance) === 'alacak').length} / ${data.customers.length}`} sub="müşteri" />
      </div>

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

function Mini({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="num mt-1.5 truncate text-lg font-semibold text-zinc-100">{value}</div>
      {sub && <div className="text-[11px] text-zinc-600">{sub}</div>}
    </Card>
  );
}
