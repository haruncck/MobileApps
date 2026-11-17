import { useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, Pencil, Phone, Plus, Search, Users, Wallet } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { balanceState, customerLedger, EPS, jobPayStates } from '../lib/money';
import type { BalanceState } from '../lib/money';
import { fmt } from '../lib/format';
import { CURRENCIES } from '../types';
import { BalanceBadge, JobRow, MoneyChips, PaymentRow } from '../components/common';
import { Button, Card, EmptyState, IconButton, Input, Segmented, SectionTitle, cx } from '../components/ui';

type Filter = 'all' | 'alacak' | 'kapandi';

export function Customers() {
  const { route } = useUI();
  return route.customerId ? <CustomerDetail id={route.customerId} /> : <CustomerList />;
}

function CustomerList() {
  const { data } = useStore();
  const { go, open } = useUI();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    return data.customers
      .map((c) => {
        const l = customerLedger(data, c.id);
        return { c, l, state: balanceState(l.balance) as BalanceState, jobs: data.jobs.filter((j) => j.customerId === c.id).length };
      })
      .filter((x) => !term || x.c.name.toLocaleLowerCase('tr').includes(term))
      .filter((x) => filter === 'all' || (filter === 'alacak' ? x.state === 'alacak' : x.state !== 'alacak'))
      .sort((a, b) => b.l.balanceTRY - a.l.balanceTRY || a.c.name.localeCompare(b.c.name, 'tr'));
  }, [data, q, filter]);

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Müşteriler</h1>
        <Button variant="secondary" onClick={() => open({ kind: 'customer' })}>
          <Plus size={18} /> Müşteri
        </Button>
      </header>
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input className="pl-10" placeholder="Müşteri ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Tümü' },
          { value: 'alacak', label: 'Alacaklı' },
          { value: 'kapandi', label: 'Kapanan' },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Users size={26} />} title="Müşteri bulunamadı" text="Yeni bir cari kart oluşturarak başlayın." action={<Button variant="primary" onClick={() => open({ kind: 'customer' })}><Plus size={18} /> Yeni Müşteri</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, l, state, jobs }) => (
            <Card key={c.id} onClick={() => go({ tab: 'customers', customerId: c.id })} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} state={state} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{c.name}</div>
                    <div className="text-xs text-zinc-500">{jobs} iş kaydı</div>
                  </div>
                </div>
                <BalanceBadge state={state} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-2 border-t border-white/5 pt-3">
                <div>
                  <div className="mb-0.5 text-[11px] uppercase tracking-wide text-zinc-600">Kalan</div>
                  <MoneyChips m={l.balance} />
                </div>
                <div className="text-right">
                  <div className="num text-sm text-zinc-400">{fmt(l.balanceTRY, 'TRY')}</div>
                  <div className="text-[10px] text-zinc-600">TL karşılığı</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ name, state }: { name: string; state: BalanceState }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toLocaleUpperCase('tr')).join('');
  return (
    <div
      className={cx(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold',
        state === 'alacak' ? 'bg-amber-400/15 text-amber-300' : state === 'fazla' ? 'bg-sky-400/15 text-sky-300' : 'bg-slate-400/15 text-slate-300',
      )}
    >
      {initials}
    </div>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const { data } = useStore();
  const { back, open, go } = useUI();
  const [tab, setTab] = useState<'jobs' | 'pays'>('jobs');
  const c = data.customers.find((x) => x.id === id);

  const jobs = useMemo(() => data.jobs.filter((j) => j.customerId === id).sort((a, b) => b.date.localeCompare(a.date)), [data.jobs, id]);
  const pays = useMemo(() => data.payments.filter((p) => p.customerId === id).sort((a, b) => b.date.localeCompare(a.date)), [data.payments, id]);
  const states = useMemo(() => jobPayStates(jobs, pays), [jobs, pays]);

  if (!c)
    return <EmptyState icon={<Users size={26} />} title="Müşteri bulunamadı" action={<Button onClick={() => go({ tab: 'customers' })}>Listeye dön</Button>} />;

  const l = customerLedger(data, id);
  const state = balanceState(l.balance);
  const usedCurrencies = CURRENCIES.filter((k) => Math.abs(l.jobs[k]) > EPS || Math.abs(l.credited[k]) > EPS);

  const jobsList = (
    <Card className="divide-y divide-white/5 overflow-hidden">
      {jobs.length ? (
        jobs.map((j) => <JobRow key={j.id} job={j} state={states[j.id]?.state} covered={states[j.id]?.covered} onClick={() => open({ kind: 'job', id: j.id })} />)
      ) : (
        <EmptyState icon={<Briefcase size={24} />} title="Henüz iş yok" action={<Button variant="primary" onClick={() => open({ kind: 'job', customerId: id })}><Plus size={18} /> İş Ekle</Button>} />
      )}
    </Card>
  );
  const paysList = (
    <Card className="divide-y divide-white/5 overflow-hidden">
      {pays.length ? (
        pays.map((p) => <PaymentRow key={p.id} p={p} onClick={() => open({ kind: 'payment', id: p.id })} />)
      ) : (
        <EmptyState icon={<Wallet size={24} />} title="Henüz ödeme yok" action={<Button variant="success" onClick={() => open({ kind: 'payment', customerId: id })}><Plus size={18} /> Ödeme Ekle</Button>} />
      )}
    </Card>
  );

  return (
    <div>
      <header className="mb-4 flex items-center gap-2">
        <IconButton onClick={back} aria-label="Geri" className="-ml-2">
          <ArrowLeft size={22} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-white">{c.name}</h1>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <BalanceBadge state={state} />
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-zinc-300">
                <Phone size={12} /> {c.phone}
              </a>
            )}
          </div>
        </div>
        <IconButton onClick={() => open({ kind: 'customer', id })} aria-label="Düzenle">
          <Pencil size={18} />
        </IconButton>
      </header>

      {/* Bakiye özeti */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500/10 to-transparent p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Net Kalan Bakiye</div>
          <div className="mt-1">
            <MoneyChips m={l.balance} />
          </div>
          <div className="num mt-1 text-sm text-zinc-400">
            TL karşılığı: <span className={cx('font-semibold', l.balanceTRY > EPS ? 'text-amber-300' : l.balanceTRY < -EPS ? 'text-sky-300' : 'text-zinc-300')}>{fmt(l.balanceTRY, 'TRY')}</span>
          </div>
        </div>
        {usedCurrencies.length > 0 && (
          <table className="num w-full text-sm">
            <thead>
              <tr className="border-y border-white/5 text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2 text-left font-medium">Döviz</th>
                <th className="px-2 py-2 text-right font-medium">İş</th>
                <th className="px-2 py-2 text-right font-medium">Alınan</th>
                <th className="px-4 py-2 text-right font-medium">Kalan</th>
              </tr>
            </thead>
            <tbody>
              {usedCurrencies.map((k) => (
                <tr key={k} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2 text-zinc-400">{k}</td>
                  <td className="px-2 py-2 text-right text-zinc-200">{fmt(l.jobs[k], k)}</td>
                  <td className="px-2 py-2 text-right text-emerald-300">{fmt(l.credited[k], k)}</td>
                  <td className={cx('px-4 py-2 text-right font-semibold', l.balance[k] > EPS ? 'text-amber-300' : l.balance[k] < -EPS ? 'text-sky-300' : 'text-zinc-500')}>
                    {fmt(l.balance[k], k)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => open({ kind: 'job', customerId: id })}>
          <Briefcase size={18} /> İş Ekle
        </Button>
        <Button variant="success" onClick={() => open({ kind: 'payment', customerId: id })}>
          <Wallet size={18} /> Ödeme Al
        </Button>
      </div>

      {c.note && <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-zinc-400">{c.note}</p>}

      {/* Mobil: sekmeli / Masaüstü: yan yana */}
      <div className="lg:hidden">
        <Segmented
          className="mt-5"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'jobs', label: `Yapılan İşler (${jobs.length})` },
            { value: 'pays', label: `Ödemeler (${pays.length})` },
          ]}
        />
        <div className="mt-3">{tab === 'jobs' ? jobsList : paysList}</div>
      </div>
      <div className="hidden gap-6 lg:grid lg:grid-cols-2">
        <div>
          <SectionTitle>Yapılan İşler ({jobs.length})</SectionTitle>
          {jobsList}
        </div>
        <div>
          <SectionTitle>Alınan Ödemeler / Mahsuplar ({pays.length})</SectionTitle>
          {paysList}
        </div>
      </div>
    </div>
  );
}
