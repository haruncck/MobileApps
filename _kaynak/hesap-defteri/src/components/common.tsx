import { ArrowDownLeft, Briefcase, CircleCheck, CirclePlus, Package, UserPlus, Wallet } from 'lucide-react';
import type { Job, Money, Payment } from '../types';
import { CURRENCIES, PAYMENT_TYPE_LABEL } from '../types';
import type { BalanceState, JobPay, JobPayState } from '../lib/money';
import { EPS } from '../lib/money';
import { fmt, fmtDate, SYMBOL } from '../lib/format';
import { useUI } from '../ui-context';
import { Badge, Sheet } from './ui';

export function BalanceBadge({ state }: { state: BalanceState }) {
  if (state === 'alacak') return <Badge tone="amber">Alacak</Badge>;
  if (state === 'fazla') return <Badge tone="sky">Avans / Fazla</Badge>;
  return <Badge tone="slate">Bakiye Kapandı</Badge>;
}

export function JobStateBadge({ state }: { state: JobPayState }) {
  if (state === 'tahsil')
    return (
      <Badge tone="emerald">
        <CircleCheck size={11} /> Tahsil Edildi
      </Badge>
    );
  if (state === 'kismi') return <Badge tone="amber">Kısmi</Badge>;
  return <Badge tone="amber">Alacak</Badge>;
}

/** Döviz bazlı bakiye "çipleri" */
export function MoneyChips({ m, size = 'md', showZero = false }: { m: Money; size?: 'sm' | 'md'; showZero?: boolean }) {
  const list = CURRENCIES.filter((c) => showZero || Math.abs(m[c]) > EPS);
  if (!list.length) return <span className={size === 'sm' ? 'text-sm text-zinc-500' : 'text-zinc-500'}>{fmt(0, 'TRY')}</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {list.map((c) => (
        <span
          key={c}
          className={[
            'num font-semibold',
            size === 'sm' ? 'text-sm' : 'text-base',
            m[c] > EPS ? 'text-amber-300' : m[c] < -EPS ? 'text-sky-300' : 'text-zinc-500',
          ].join(' ')}
        >
          {fmt(m[c], c)}
        </span>
      ))}
    </div>
  );
}

export function JobRow({
  job,
  pay,
  customerName,
  onClick,
  onCollect,
}: {
  job: Job;
  pay?: JobPay;
  customerName?: string;
  onClick?: () => void;
  onCollect?: () => void;
}) {
  const open = pay && pay.state !== 'tahsil';
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
          <Briefcase size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-zinc-100">{job.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
            {customerName && <span className="text-zinc-400">{customerName}</span>}
            <span>{fmtDate(job.date)}</span>
            {open && pay.state === 'kismi' && <span className="num text-amber-300/90">· Kalan {fmt(pay.remaining, job.currency)}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="num font-semibold text-zinc-100">{fmt(job.amount, job.currency)}</span>
          {pay && !onCollect && <JobStateBadge state={pay.state} />}
          {pay && onCollect && pay.state === 'tahsil' && <JobStateBadge state="tahsil" />}
        </div>
      </button>
      {open && onCollect && (
        <button
          onClick={onCollect}
          className="min-h-10 shrink-0 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
        >
          Tahsil Et
        </button>
      )}
    </div>
  );
}

export function PaymentRow({ p, customerName, onClick }: { p: Payment; customerName?: string; onClick?: () => void }) {
  const cross = p.allocations.some((a) => a.currency !== p.currency) || p.allocations.length > 1;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] active:bg-white/[0.05]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
        {p.type === 'urun' ? <Package size={18} /> : <ArrowDownLeft size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-zinc-100">{p.description || PAYMENT_TYPE_LABEL[p.type]}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
          {customerName && <span className="text-zinc-400">{customerName}</span>}
          <span>{fmtDate(p.date)}</span>
          {p.description && <span>· {PAYMENT_TYPE_LABEL[p.type]}</span>}
          {cross && (
            <span className="num text-emerald-400/80">
              → {p.allocations.map((a) => fmt(a.amount, a.currency)).join(' + ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="num font-semibold text-emerald-300">−{fmt(p.amount, p.currency)}</span>
        {p.currency !== 'TRY' && <span className="num text-[11px] text-zinc-500">≈ {fmt(p.amountTRY, 'TRY')}</span>}
        {cross && p.currency === 'TRY' && (
          <span className="num text-[11px] text-zinc-500">
            kur {p.allocations.filter((a) => a.currency !== 'TRY').map((a) => `${SYMBOL[a.currency]}${p.rates[a.currency as 'USD' | 'EUR'].toLocaleString('tr-TR')}`).join(' ')}
          </span>
        )}
      </div>
    </button>
  );
}

export function QuickAddSheet() {
  const { close, open, route } = useUI();
  const customerId = route.customerId;
  const items = [
    { icon: <Briefcase size={22} />, title: 'Yeni İş', text: 'Hakediş / borçlandırma kaydı', tone: 'bg-amber-400/10 text-amber-300', go: () => open({ kind: 'job', customerId }) },
    { icon: <Wallet size={22} />, title: 'Yeni Ödeme', text: 'Tahsilat, ara ödeme veya ürün mahsubu', tone: 'bg-emerald-400/10 text-emerald-300', go: () => open({ kind: 'payment', customerId }) },
    { icon: <UserPlus size={22} />, title: 'Yeni Müşteri', text: 'Cari kart oluştur', tone: 'bg-sky-400/10 text-sky-300', go: () => open({ kind: 'customer' }) },
  ];
  return (
    <Sheet open onClose={close} title={<span className="flex items-center gap-2"><CirclePlus size={20} className="text-amber-400" /> Hızlı Ekle</span>}>
      <div className="grid gap-2 pb-2">
        {items.map((i) => (
          <button key={i.title} onClick={i.go} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-4 text-left ring-1 ring-inset ring-white/5 transition hover:bg-white/[0.06] active:scale-[0.99]">
            <div className={`grid h-12 w-12 place-items-center rounded-xl ${i.tone}`}>{i.icon}</div>
            <div>
              <div className="font-semibold text-white">{i.title}</div>
              <div className="text-sm text-zinc-400">{i.text}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
