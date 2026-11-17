import { Briefcase, ChevronRight, UserPlus, Wallet } from 'lucide-react';
import type { Job, Money, Payment } from '../types';
import { CURRENCIES, PAYMENT_TYPE_LABEL } from '../types';
import type { BalanceState } from '../lib/money';
import { EPS } from '../lib/money';
import { fmt, fmtDate, fmtRate, SYMBOL } from '../lib/format';
import { useUI } from '../ui-context';
import { Badge, Sheet, cx } from './ui';

export function BalanceBadge({ state }: { state: BalanceState }) {
  if (state === 'alacak') return <Badge tone="due">Borçlu</Badge>;
  if (state === 'fazla') return <Badge tone="advance">Fazla ödedi</Badge>;
  return <Badge tone="neutral">Hesap kapalı</Badge>;
}

/** Döviz bazlı bakiye: "₺100.000  $850" */
export function MoneyChips({ m, size = 'md', showZero = false }: { m: Money; size?: 'sm' | 'md' | 'lg'; showZero?: boolean }) {
  const list = CURRENCIES.filter((c) => showZero || Math.abs(m[c]) > EPS);
  const sz = size === 'lg' ? 'text-[28px] leading-tight' : size === 'sm' ? 'text-[15px]' : 'text-[18px]';
  if (!list.length) return <span className={cx('figure font-semibold text-faint', sz)}>{fmt(0, 'TRY')}</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0">
      {list.map((c) => (
        <span key={c} className={cx('figure font-semibold', sz, m[c] > EPS ? 'text-due' : m[c] < -EPS ? 'text-advance' : 'text-faint')}>
          {fmt(m[c], c)}
        </span>
      ))}
    </span>
  );
}

export function JobRow({ job, customerName, onClick }: { job: Job; customerName?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold text-graphite">{job.title}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[14px] text-pencil">
          {customerName && <span className="font-medium text-graphite/80">{customerName}</span>}
          <span className="num">{fmtDate(job.date)}</span>
          {job.note && <span className="truncate text-faint">{job.note}</span>}
        </div>
      </div>
      <span className="figure shrink-0 text-[18px] font-semibold text-graphite">{fmt(job.amount, job.currency)}</span>
    </button>
  );
}

export function PaymentRow({ p, customerName, onClick }: { p: Payment; customerName?: string; onClick?: () => void }) {
  const converted = p.allocations.some((a) => a.currency !== p.currency) || p.allocations.length > 1;
  const foreign = p.allocations.find((a) => a.currency !== 'TRY');
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold text-graphite">{p.description || PAYMENT_TYPE_LABEL[p.type]}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[14px] text-pencil">
          {customerName && <span className="font-medium text-graphite/80">{customerName}</span>}
          <span className="num">{fmtDate(p.date)}</span>
          {p.description && <span>{PAYMENT_TYPE_LABEL[p.type]}</span>}
          {p.note && <span className="truncate text-faint">{p.note}</span>}
        </div>
        {converted && (
          <div className="num mt-0.5 text-[13px] text-paid">
            Borçtan düşen: {p.allocations.map((a) => fmt(a.amount, a.currency)).join(' + ')}
            {foreign && p.currency === 'TRY' && (
              <span className="text-pencil">
                {' '}
                (kur {SYMBOL[foreign.currency]}1 = ₺{fmtRate(p.rates[foreign.currency as 'USD' | 'EUR'])})
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="figure text-[18px] font-semibold text-paid">{fmt(p.amount, p.currency)}</span>
        {p.currency !== 'TRY' && <span className="num text-[13px] text-pencil">≈ {fmt(Math.round(p.amountTRY), 'TRY')}</span>}
      </div>
    </button>
  );
}

export function QuickAddSheet() {
  const { close, open, route } = useUI();
  const customerId = route.customerId;
  const items = [
    { icon: <Wallet size={22} />, title: 'Ödeme aldım', text: 'Müşterinin borcundan düş (para, çek veya ürün)', cls: 'text-paid', go: () => open({ kind: 'payment', customerId }) },
    { icon: <Briefcase size={22} />, title: 'İş yaptım', text: 'Müşterinin borcuna ekle', cls: 'text-due', go: () => open({ kind: 'job', customerId }) },
    { icon: <UserPlus size={22} />, title: 'Yeni müşteri', text: 'Yeni bir cari hesap aç', cls: 'text-ink', go: () => open({ kind: 'customer' }) },
  ];
  return (
    <Sheet open onClose={close} title="Ne kaydedeceksiniz?">
      <div className="ledger">
        <div className="rows">
          {items.map((i) => (
            <button key={i.title} type="button" onClick={i.go} className="flex w-full items-center gap-4 px-3 py-4 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft">
              <span className={i.cls}>{i.icon}</span>
              <span className="flex-1">
                <span className="block text-[17px] font-bold text-graphite">{i.title}</span>
                <span className="block text-[14px] text-pencil">{i.text}</span>
              </span>
              <ChevronRight size={18} className="text-faint" />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
