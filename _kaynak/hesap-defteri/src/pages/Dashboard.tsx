import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, NotebookPen } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { balanceState, customerLedger, ledger, monthlyAverage, monthlySeries } from '../lib/money';
import { fmt, fmtCompact, fmtWords } from '../lib/format';
import { JobRow, MoneyChips, PaymentRow } from '../components/common';
import { Button, EmptyState, Ledger, SectionTitle, cx } from '../components/ui';
import { RatesChip } from '../components/RatesChip';
import { AverageDetail, MonthDetail, currentMonthKey, monthLabel } from '../components/MonthDetail';
import type { MonthView } from '../components/MonthDetail';

export function Dashboard() {
  const { data } = useStore();
  const { go, open } = useUI();
  const r = data.settings.rates;
  const [detail, setDetail] = useState<null | { kind: 'month'; month: string; view: MonthView } | { kind: 'avg' }>(null);

  const total = useMemo(() => ledger(data.jobs, data.payments, r), [data.jobs, data.payments, r]);
  const curKey = currentMonthKey();
  // curKey bağımlılığı: gece yarısı ay değişince 'bu ay' yenilensin
  const series = useMemo(() => monthlySeries(data, 12), [data, curKey]);
  const avg = useMemo(() => monthlyAverage(data), [data, curKey]);
  const custName = new Map(data.customers.map((c) => [c.id, c.name]));

  const thisMonth = series.find((s) => s.key === curKey);
  const lastMonth = series[series.length - 2];
  const jobsThisMonth = data.jobs.filter((j) => j.date.startsWith(curKey)).length;
  const paysThisMonth = data.payments.filter((p) => p.date.startsWith(curKey)).length;

  const debtors = useMemo(
    () =>
      data.customers
        .map((c) => ({ c, l: customerLedger(data, c.id) }))
        .filter((x) => balanceState(x.l.balance) !== 'kapandi')
        .sort((a, b) => b.l.balanceTRY - a.l.balanceTRY),
    [data],
  );

  const recent = useMemo(
    () =>
      [
        ...data.jobs.map((j, i) => ({ kind: 'job' as const, date: j.date, i, item: j })),
        ...data.payments.map((p, i) => ({ kind: 'pay' as const, date: p.date, i, item: p })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i)
        .slice(0, 6),
    [data.jobs, data.payments],
  );

  if (!data.customers.length)
    return (
      <div>
        <h1 className="mb-4 text-[28px] font-bold capitalize text-graphite">{monthLabel(curKey)}</h1>
        <Ledger>
          <EmptyState
            icon={<NotebookPen size={30} />}
            title="Defteriniz boş"
            text="İlk müşterinizi ekleyin, sonra yaptığınız işleri ve aldığınız ödemeleri yazın."
            action={
              <Button variant="primary" onClick={() => open({ kind: 'customer' })}>
                Müşteri ekle
              </Button>
            }
          />
        </Ledger>
      </div>
    );

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold capitalize leading-tight text-graphite">{monthLabel(curKey)}</h1>
        <RatesChip />
      </header>

      <div className="grid gap-x-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Defter sayfası: bu ay + ortalama + toplam alacak */}
        <Ledger>
          <div className="rows">
            <Line
              label="Bu ay yapılan iş"
              sub={`${jobsThisMonth} iş. Geçen ay ${fmt(Math.round(lastMonth?.isTRY ?? 0), 'TRY')}`}
              value={fmt(Math.round(thisMonth?.isTRY ?? 0), 'TRY')}
              onClick={() => setDetail({ kind: 'month', month: curKey, view: 'jobs' })}
            />
            <Line
              label="Bu ay alınan ödeme"
              sub={`${paysThisMonth} ödeme. Geçen ay ${fmt(Math.round(lastMonth?.tahsilatTRY ?? 0), 'TRY')}`}
              value={fmt(Math.round(thisMonth?.tahsilatTRY ?? 0), 'TRY')}
              valueCls="text-paid"
              onClick={() => setDetail({ kind: 'month', month: curKey, view: 'pays' })}
            />
            <Line
              label="Aylık ortalama kazanç"
              sub={avg.includesCurrent ? 'Yapılan iş, yalnızca bu ay' : `Yapılan iş, son ${avg.months} ay (bu ay hariç)`}
              value={fmt(Math.round(avg.avgTRY), 'TRY')}
              valueCls="text-ink"
              onClick={() => setDetail({ kind: 'avg' })}
            />
          </div>
          {/* Toplam: çift çizgi */}
          <button
            type="button"
            onClick={() => go({ tab: 'customers' })}
            className="flex w-full items-end justify-between gap-3 border-t-2 border-graphite/80 px-3 pb-4 pt-3 text-left transition-colors hover:bg-due-soft/50"
          >
            <span>
              <span className="block text-[17px] font-bold text-graphite">Toplam alacağım</span>
              <span className="block text-[14px] text-pencil">{fmtWords(total.balance)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="figure total-rule text-[34px] font-bold leading-none text-due">{fmt(Math.round(total.balanceTRY), 'TRY')}</span>
              <ChevronRight size={18} className="text-faint" />
            </span>
          </button>
        </Ledger>

        {/* Kimde ne kadar var */}
        <div>
          <SectionTitle
            action={
              <button type="button" className="min-h-11 px-1 text-[15px] font-semibold text-ink" onClick={() => go({ tab: 'customers' })}>
                Tüm müşteriler
              </button>
            }
          >
            Kimde ne kadar alacağım var
          </SectionTitle>
          <Ledger>
            <div className="rows">
              {debtors.length ? (
                debtors.map(({ c, l }) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => go({ tab: 'customers', customerId: c.id })}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft"
                  >
                    <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-graphite">{c.name}</span>
                    <MoneyChips m={l.balance} />
                    <ChevronRight size={16} className="text-faint" />
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-[15px] text-pencil">Kimsede alacağınız yok.</p>
              )}
            </div>
          </Ledger>
        </div>
      </div>

      {/* Grafik */}
      <SectionTitle>Son 12 ay</SectionTitle>
      <div className="rounded-[10px] border border-line bg-paper p-3">
        <div className="mb-2 flex gap-4 px-1 text-[14px] text-pencil">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-ink" /> Yapılan iş
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-paid" /> Alınan ödeme
          </span>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={series}
              margin={{ top: 4, right: 4, left: -6, bottom: 0 }}
              barGap={1}
              onClick={(e) => {
                const k = series[Number(e?.activeTooltipIndex)]?.key;
                if (k) setDetail({ kind: 'month', month: k, view: 'jobs' });
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid vertical={false} stroke="#d3deee" />
              <XAxis dataKey="label" tick={{ fill: '#5f6673', fontSize: 12, fontFamily: 'Barlow' }} axisLine={{ stroke: '#d8dde6' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fill: '#5f6673', fontSize: 12, fontFamily: 'Barlow' }} axisLine={false} tickLine={false} width={46} />
              <Tooltip
                cursor={{ fill: '#e8edf9' }}
                contentStyle={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 8, fontSize: 14, fontFamily: 'Barlow' }}
                labelStyle={{ color: '#23262d', fontWeight: 700 }}
                formatter={(v) => fmt(Math.round(Number(v)), 'TRY')}
              />
              <Bar dataKey="isTRY" name="Yapılan iş" fill="#1f3a93" radius={[2, 2, 0, 0]} maxBarSize={18} />
              <Bar dataKey="tahsilatTRY" name="Alınan ödeme" fill="#17734a" radius={[2, 2, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="px-1 pt-1 text-[13px] text-faint">Bir aya dokunun, o ayın kayıtları açılsın. Dolar ve euro işler bugünkü kurla TL'ye çevrildi.</p>
      </div>

      <SectionTitle
        action={
          <button type="button" className="min-h-11 px-1 text-[15px] font-semibold text-ink" onClick={() => go({ tab: 'movements' })}>
            Tümü
          </button>
        }
      >
        Son yazılanlar
      </SectionTitle>
      <Ledger>
        <div className="rows">
          {recent.map((x) =>
            x.kind === 'job' ? (
              <JobRow key={x.item.id} job={x.item} customerName={custName.get(x.item.customerId)} onClick={() => open({ kind: 'job', id: x.item.id })} />
            ) : (
              <PaymentRow key={x.item.id} p={x.item} customerName={custName.get(x.item.customerId)} onClick={() => open({ kind: 'payment', id: x.item.id })} />
            ),
          )}
        </div>
      </Ledger>

      {detail?.kind === 'month' && <MonthDetail key={detail.month + detail.view} month={detail.month} view={detail.view} onClose={() => setDetail(null)} />}
      {detail?.kind === 'avg' && <AverageDetail avg={avg} onClose={() => setDetail(null)} onPick={(m) => setDetail({ kind: 'month', month: m, view: 'jobs' })} />}
    </div>
  );
}

function Line({ label, sub, value, valueCls, onClick }: { label: string; sub: ReactNode; value: string; valueCls?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft">
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold text-graphite">{label}</span>
        <span className="block text-[14px] text-pencil">{sub}</span>
      </span>
      <span className={cx('figure text-[26px] font-semibold leading-none', valueCls ?? 'text-graphite')}>{value}</span>
      <ChevronRight size={18} className="shrink-0 text-faint" />
    </button>
  );
}
