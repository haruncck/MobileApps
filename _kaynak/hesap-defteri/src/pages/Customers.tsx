import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Pencil, Phone, Search, Users } from 'lucide-react';
import { StatementSheet } from '../components/Statement';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { balanceState, customerLedger, EPS } from '../lib/money';
import type { BalanceState } from '../lib/money';
import { fmt, fmtDate, fmtWords } from '../lib/format';
import { CURRENCIES } from '../types';
import type { Money } from '../types';
import { BalanceBadge, JobRow, MoneyChips, PaymentRow } from '../components/common';
import { Button, EmptyState, IconButton, Input, Ledger, Segmented, SectionTitle, cx } from '../components/ui';

type Filter = 'borclu' | 'all';

export function Customers() {
  const { route } = useUI();
  return route.customerId ? <CustomerDetail id={route.customerId} /> : <CustomerList />;
}

function CustomerList() {
  const { data } = useStore();
  const { go, open } = useUI();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('borclu');

  const rows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    return data.customers
      .map((c) => {
        const l = customerLedger(data, c.id);
        const dates = [...data.jobs.filter((j) => j.customerId === c.id).map((j) => j.date), ...data.payments.filter((p) => p.customerId === c.id).map((p) => p.date)].sort();
        return { c, l, state: balanceState(l.balance) as BalanceState, last: dates[dates.length - 1] };
      })
      .filter((x) => !term || x.c.name.toLocaleLowerCase('tr').includes(term))
      // Henüz kaydı olmayan yeni müşteriler de 'Borcu olanlar' listesinde görünür
      .filter((x) => filter === 'all' || term || x.state !== 'kapandi' || !x.last)
      .sort((a, b) => b.l.balanceTRY - a.l.balanceTRY || a.c.name.localeCompare(b.c.name, 'tr'));
  }, [data, q, filter]);

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold text-graphite">Müşteriler</h1>
        <Button variant="secondary" onClick={() => open({ kind: 'customer' })}>
          Yeni müşteri
        </Button>
      </header>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input className="pl-10" placeholder="Müşteri adıyla ara" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
        <Segmented
          className="sm:w-64"
          value={filter}
          onChange={setFilter}
          label="Müşteri filtresi"
          options={[
            { value: 'borclu', label: 'Borcu olanlar' },
            { value: 'all', label: 'Hepsi' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <Ledger>
          <EmptyState
            icon={<Users size={28} />}
            title={q ? 'Bu isimde müşteri yok' : filter === 'borclu' && data.customers.length ? 'Borcu olan müşteri yok' : 'Henüz müşteri yok'}
            action={
              <Button variant="primary" onClick={() => open({ kind: 'customer' })}>
                Müşteri ekle
              </Button>
            }
          />
        </Ledger>
      ) : (
        <Ledger>
          <div className="rows">
            {rows.map(({ c, l, state, last }) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go({ tab: 'customers', customerId: c.id })}
                className="flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-semibold text-graphite">{c.name}</span>
                  <span className="block text-[14px] text-pencil">{last ? `Son kayıt ${fmtDate(last)}` : 'Kayıt yok'}</span>
                </span>
                {state === 'kapandi' ? <BalanceBadge state={state} /> : <MoneyChips m={l.balance} />}
                <ChevronRight size={18} className="shrink-0 text-faint" />
              </button>
            ))}
          </div>
        </Ledger>
      )}
    </div>
  );
}

/** Para birimi bazında tutarları tek satırda yazar: "₺1.227.700" veya "€2.156,30 ve $300" */
function Amounts({ m, sign = '', cls }: { m: Money; sign?: string; cls?: string }) {
  const list = CURRENCIES.filter((c) => Math.abs(m[c]) > EPS);
  if (!list.length) return <span className={cx('figure', cls)}>{fmt(0, 'TRY')}</span>;
  return (
    <span className="flex flex-col items-end">
      {list.map((c) => (
        <span key={c} className={cx('figure leading-tight', cls)}>
          {sign}
          {fmt(m[c], c)}
        </span>
      ))}
    </span>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const { data } = useStore();
  const { back, open, go } = useUI();
  const [tab, setTab] = useState<'jobs' | 'pays'>('jobs');
  const [showStatement, setShowStatement] = useState(false);
  const c = data.customers.find((x) => x.id === id);

  const order = (a: { date: string }, b: { date: string }, ia: number, ib: number) => b.date.localeCompare(a.date) || ib - ia;
  const jobs = useMemo(
    () =>
      data.jobs
        .map((j, i) => ({ j, i }))
        .filter(({ j }) => j.customerId === id)
        .sort((a, b) => order(a.j, b.j, a.i, b.i))
        .map(({ j }) => j),
    [data.jobs, id],
  );
  const pays = useMemo(
    () =>
      data.payments
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.customerId === id)
        .sort((a, b) => order(a.p, b.p, a.i, b.i))
        .map(({ p }) => p),
    [data.payments, id],
  );

  if (!c)
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="Müşteri bulunamadı"
        action={<Button onClick={() => go({ tab: 'customers' })}>Müşteri listesine dön</Button>}
      />
    );

  const l = customerLedger(data, id);
  const state = balanceState(l.balance);
  const hasForeign = CURRENCIES.some((k) => k !== 'TRY' && Math.abs(l.balance[k]) > EPS);

  const jobsList = (
    <Ledger>
      <div className="rows">
        {jobs.length ? (
          jobs.map((j) => <JobRow key={j.id} job={j} onClick={() => open({ kind: 'job', id: j.id })} />)
        ) : (
          <p className="px-3 py-4 text-[15px] text-pencil">Bu müşteriye henüz iş yazılmadı.</p>
        )}
      </div>
      {jobs.length > 0 && (
        <div className="flex items-start justify-between border-t-2 border-graphite/80 px-3 py-3">
          <span className="text-[16px] font-bold">Toplam</span>
          <Amounts m={l.jobs} cls="text-[18px] font-bold text-graphite" />
        </div>
      )}
    </Ledger>
  );
  const paysList = (
    <Ledger>
      <div className="rows">
        {pays.length ? (
          pays.map((p) => <PaymentRow key={p.id} p={p} onClick={() => open({ kind: 'payment', id: p.id })} />)
        ) : (
          <p className="px-3 py-4 text-[15px] text-pencil">Bu müşteriden henüz ödeme alınmadı.</p>
        )}
      </div>
      {pays.length > 0 && (
        <div className="flex items-start justify-between border-t-2 border-graphite/80 px-3 py-3">
          <span className="text-[16px] font-bold">Alınan</span>
          <Amounts m={l.credited} cls="text-[18px] font-bold text-paid" />
        </div>
      )}
    </Ledger>
  );

  return (
    <div>
      <header className="mb-3 flex items-center gap-1">
        <IconButton onClick={back} aria-label="Geri" className="-ml-2">
          <ArrowLeft size={24} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] font-bold leading-tight text-graphite">{c.name}</h1>
          {c.phone && (
            <a href={`tel:${c.phone}`} className="num inline-flex items-center gap-1 text-[15px] text-ink">
              <Phone size={14} /> {c.phone}
            </a>
          )}
        </div>
        <IconButton onClick={() => open({ kind: 'customer', id })} aria-label="Müşteriyi düzenle">
          <Pencil size={20} />
        </IconButton>
      </header>

      {/* Hesap özeti – Excel'deki Toplam / Alınan / Kalan */}
      <Ledger>
        <div className="rows">
          <div className="flex items-start justify-between gap-3 px-3 py-3">
            <span className="text-[16px] font-semibold text-pencil">Yapılan işler</span>
            <Amounts m={l.jobs} cls="text-[20px] font-semibold text-graphite" />
          </div>
          <div className="flex items-start justify-between gap-3 px-3 py-3">
            <span className="text-[16px] font-semibold text-pencil">Alınan</span>
            <Amounts m={l.credited} cls="text-[20px] font-semibold text-paid" />
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 border-t-2 border-graphite/80 px-3 pb-4 pt-3">
          <span>
            <span className="block text-[18px] font-bold text-graphite">{state === 'fazla' ? 'Fazla ödedi' : 'Kalan borcu'}</span>
            {state === 'kapandi' && <span className="text-[14px] text-pencil">Hesap kapalı</span>}
          </span>
          <span className="flex flex-col items-end">
            {CURRENCIES.filter((k) => Math.abs(l.balance[k]) > EPS).map((k) => (
              <span key={k} className={cx('figure total-rule text-[30px] font-bold leading-tight', l.balance[k] > 0 ? 'text-due' : 'text-advance')}>
                {fmt(Math.abs(l.balance[k]), k)}
                {l.balance[k] < 0 && state === 'alacak' && <span className="ml-1 text-[14px] font-semibold">fazla ödendi</span>}
              </span>
            ))}
            {state === 'kapandi' && <span className="figure text-[30px] font-bold text-faint">{fmt(0, 'TRY')}</span>}
            {hasForeign && (
              <span className="num mt-1 text-[13px] text-pencil">Bugünkü kurla {fmt(Math.round(Math.abs(l.balanceTRY)), 'TRY')}</span>
            )}
          </span>
        </div>
      </Ledger>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="success" onClick={() => open({ kind: 'payment', customerId: id })}>
          Ödeme aldım
        </Button>
        <Button variant="primary" onClick={() => open({ kind: 'job', customerId: id })}>
          İş ekle
        </Button>
        <Button variant="secondary" className="col-span-2" onClick={() => setShowStatement(true)} disabled={!jobs.length && !pays.length}>
          <FileText size={18} /> Cari özeti gönder
        </Button>
      </div>
      {showStatement && <StatementSheet customerId={id} onClose={() => setShowStatement(false)} />}

      {c.note && <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-[15px] text-pencil">{c.note}</p>}

      {state === 'fazla' && (
        <p className="mt-3 rounded-lg bg-ink-soft px-3 py-2 text-[15px] text-advance">
          Bu müşteri yapılan işlerden fazla ödemiş ({fmtWords({ TRY: -Math.min(0, l.balance.TRY), USD: -Math.min(0, l.balance.USD), EUR: -Math.min(0, l.balance.EUR) })}). Sonraki işler
          bu tutardan düşülür.
        </p>
      )}

      {/* Mobil: sekmeli / Masaüstü: yan yana (Excel'deki iki sütun gibi) */}
      <div className="lg:hidden">
        <Segmented
          className="mt-6"
          value={tab}
          onChange={setTab}
          label="Liste"
          options={[
            { value: 'jobs', label: `İşler (${jobs.length})` },
            { value: 'pays', label: `Ödemeler (${pays.length})` },
          ]}
        />
        <div className="mt-3">{tab === 'jobs' ? jobsList : paysList}</div>
      </div>
      <div className="hidden gap-6 lg:grid lg:grid-cols-2">
        <div>
          <SectionTitle>Yapılan işler ({jobs.length})</SectionTitle>
          {jobsList}
        </div>
        <div>
          <SectionTitle>Alınan ödemeler ({pays.length})</SectionTitle>
          {paysList}
        </div>
      </div>
    </div>
  );
}
