import { useMemo, useState } from 'react';
import { ListX, Search } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { JobRow, PaymentRow } from '../components/common';
import { Card, EmptyState, Input, Segmented, Select } from '../components/ui';
import { fmt } from '../lib/format';
import { rateOf } from '../lib/money';
import type { Currency, Job, Payment } from '../types';
import { CURRENCIES } from '../types';

type Kind = 'all' | 'job' | 'pay';
type Item = { kind: 'job'; date: string; item: Job } | { kind: 'pay'; date: string; item: Payment };

export function Movements() {
  const { data } = useStore();
  const { open } = useUI();
  const [kind, setKind] = useState<Kind>('all');
  const [cid, setCid] = useState('');
  const [cur, setCur] = useState<'' | Currency>('');
  const [q, setQ] = useState('');
  const custName = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);

  const groups = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    const items: Item[] = [
      ...(kind !== 'pay' ? data.jobs.map((j) => ({ kind: 'job' as const, date: j.date, item: j })) : []),
      ...(kind !== 'job' ? data.payments.map((p) => ({ kind: 'pay' as const, date: p.date, item: p })) : []),
    ]
      .filter((x) => !cid || x.item.customerId === cid)
      .filter((x) => !cur || x.item.currency === cur || (x.kind === 'pay' && x.item.allocations.some((a) => a.currency === cur)))
      .filter((x) => {
        if (!term) return true;
        const text = x.kind === 'job' ? `${x.item.title} ${x.item.note ?? ''}` : `${x.item.description ?? ''} ${x.item.note ?? ''}`;
        return `${text} ${custName.get(x.item.customerId) ?? ''}`.toLocaleLowerCase('tr').includes(term);
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const map = new Map<string, { items: Item[]; jobsTRY: number; paysTRY: number }>();
    for (const it of items) {
      const key = it.date.slice(0, 7);
      const g = map.get(key) ?? { items: [], jobsTRY: 0, paysTRY: 0 };
      g.items.push(it);
      if (it.kind === 'job') g.jobsTRY += it.item.amount * rateOf(it.item.currency, data.settings.rates);
      else g.paysTRY += it.item.amountTRY;
      map.set(key, g);
    }
    return [...map.entries()];
  }, [data, kind, cid, cur, q, custName]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-white">Hareketler</h1>
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input className="pl-10" placeholder="İş, açıklama veya müşteri ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented
          className="md:w-64"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'job', label: 'İşler' },
            { value: 'pay', label: 'Ödemeler' },
          ]}
        />
        <div className="grid grid-cols-2 gap-2 md:contents">
          <Select value={cid} onChange={(e) => setCid(e.target.value)} className="md:w-44">
            <option value="">Tüm müşteriler</option>
            {data.customers
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Select value={cur} onChange={(e) => setCur(e.target.value as '' | Currency)} className="md:w-32">
            <option value="">Tüm dövizler</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<ListX size={26} />} title="Kayıt bulunamadı" text="Filtreleri değiştirmeyi deneyin." />
      ) : (
        groups.map(([key, g]) => {
          const [y, m] = key.split('-').map(Number);
          return (
            <section key={key} className="mt-5">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-semibold capitalize text-zinc-300">
                  {new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="num flex gap-3 text-xs">
                  {g.jobsTRY > 0 && <span className="text-amber-300/80">İş {fmt(g.jobsTRY, 'TRY')}</span>}
                  {g.paysTRY > 0 && <span className="text-emerald-300/80">Tahsilat {fmt(g.paysTRY, 'TRY')}</span>}
                </div>
              </div>
              <Card className="divide-y divide-white/5 overflow-hidden">
                {g.items.map((x) =>
                  x.kind === 'job' ? (
                    <JobRow key={x.item.id} job={x.item} customerName={custName.get(x.item.customerId)} onClick={() => open({ kind: 'job', id: x.item.id })} />
                  ) : (
                    <PaymentRow key={x.item.id} p={x.item} customerName={custName.get(x.item.customerId)} onClick={() => open({ kind: 'payment', id: x.item.id })} />
                  ),
                )}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
