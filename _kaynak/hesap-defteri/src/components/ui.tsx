import { useEffect } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-2xl border border-white/[0.06] bg-panel shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]',
        onClick && 'cursor-pointer transition active:scale-[0.99] hover:border-white/10',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type Tone = 'amber' | 'emerald' | 'slate' | 'sky' | 'rose';
const TONES: Record<Tone, string> = {
  amber: 'bg-amber-400/12 text-amber-300 ring-amber-400/25',
  emerald: 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/25',
  slate: 'bg-slate-400/12 text-slate-300 ring-slate-400/20',
  sky: 'bg-sky-400/12 text-sky-300 ring-sky-400/25',
  rose: 'bg-rose-400/12 text-rose-300 ring-rose-400/25',
};

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold',
  success: 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-semibold',
  secondary: 'bg-white/[0.06] text-zinc-100 hover:bg-white/10 ring-1 ring-inset ring-white/10',
  ghost: 'text-zinc-300 hover:bg-white/[0.06]',
  danger: 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 ring-1 ring-inset ring-rose-500/30',
};

export function Button({ variant = 'secondary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        BTN[variant],
        className,
      )}
    />
  );
}

export function IconButton({ className, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cx('grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 active:scale-95', className)}
    />
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full min-h-11 rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-[15px] text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20';

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, 'appearance-none bg-[length:16px] pr-8', p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...p} className={cx(inputCls, 'py-2.5', p.className)} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('grid gap-1 rounded-xl bg-zinc-950/60 p-1 ring-1 ring-inset ring-white/10', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 rounded-lg px-2 text-sm font-medium transition',
            value === o.value ? 'bg-zinc-700/80 text-white shadow' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Mobilde alttan açılan sayfa, masaüstünde ortalanmış pencere */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-zinc-900 shadow-2xl animate-up sm:max-w-lg sm:rounded-3xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <IconButton onClick={onClose} aria-label="Kapat">
            <X size={20} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-white/5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-zinc-500">{icon}</div>
      <p className="font-medium text-zinc-200">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{children}</h3>
      {action}
    </div>
  );
}
