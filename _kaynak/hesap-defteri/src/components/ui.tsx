import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/** Düz kâğıt panel */
export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const cls = cx('rounded-[10px] border border-line bg-paper', onClick && 'block w-full text-left transition-colors hover:border-ink/40 active:bg-ink-soft/50', className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** Kırmızı kenar çizgili, satır çizgili defter sayfası */
export function Ledger({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ledger', className)}>{children}</div>;
}

export type Tone = 'due' | 'paid' | 'neutral' | 'advance' | 'ink';
const TONES: Record<Tone, string> = {
  due: 'text-due bg-due-soft',
  paid: 'text-paid bg-paid-soft',
  neutral: 'text-pencil bg-desk',
  advance: 'text-advance bg-ink-soft',
  ink: 'text-ink bg-ink-soft',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[12px] font-semibold', TONES[tone], className)}>{children}</span>;
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-ink text-white hover:bg-[#182f78] font-semibold',
  success: 'bg-paid text-white hover:bg-[#12613e] font-semibold',
  secondary: 'bg-paper text-graphite border border-line hover:border-pencil/50',
  ghost: 'text-pencil hover:bg-desk',
  danger: 'bg-paper text-due border border-due/40 hover:bg-due-soft',
};

export function Button({ variant = 'secondary', className, type = 'button', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type={type}
      {...p}
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-[15px] transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40',
        BTN[variant],
        className,
      )}
    />
  );
}

export function IconButton({ className, type = 'button', ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...p}
      className={cx('grid h-11 w-11 place-items-center rounded-lg text-pencil transition hover:bg-desk hover:text-graphite active:translate-y-px', className)}
    />
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[14px] font-semibold text-pencil">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-faint">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full min-h-12 rounded-lg border border-line bg-paper px-3 text-[16px] text-graphite placeholder:text-faint outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15';

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, 'appearance-none pr-9', p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...p} className={cx(inputCls, 'py-2.5', p.className)} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('grid gap-1 rounded-lg border border-line bg-desk p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-10 rounded-md px-2 text-[15px] font-semibold transition',
            value === o.value ? 'bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-pencil hover:text-graphite',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Geri tuşu yönetimi: açık pencereler yığını. Geri tuşu yalnızca en üstteki pencereyi kapatır. */
const sheetStack: Array<{ id: number; close: () => void }> = [];
let sheetSeq = 0;
let ignorePops = 0;
let pendingRelease = 0; // kapanan pencerenin geçmiş kaydı, hemen açılan yeni pencereye devredilir
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    const top = sheetStack.pop();
    if (top) top.close();
  });
}

/**
 * Mobilde alttan açılan sayfa, masaüstünde ortalanmış pencere.
 * Android geri tuşu açık pencereyi kapatır, uygulamadan çıkmaz.
 */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetStack[sheetStack.length - 1]?.id === id) closeRef.current();
    };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    const id = ++sheetSeq;
    sheetStack.push({ id, close: () => closeRef.current() });
    if (pendingRelease > 0) pendingRelease--; // önceki pencerenin kaydını devral (ör. Hızlı ekle → Ödeme)
    else history.pushState({ sheet: id }, '');
    return () => {
      window.removeEventListener('keydown', k);
      const i = sheetStack.findIndex((x) => x.id === id);
      if (i !== -1) {
        // Ekrandan kapatıldı (geri tuşuyla değil): eklediğimiz geçmiş kaydını geri al
        sheetStack.splice(i, 1);
        pendingRelease++;
        setTimeout(() => {
          if (pendingRelease > 0) {
            pendingRelease--;
            ignorePops++;
            history.back();
          }
        }, 0);
      }
      if (!sheetStack.length) document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-graphite/40 animate-fade" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-paper shadow-[0_-8px_30px_rgba(35,38,45,0.18)] animate-up sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-2">
          <h2 className="text-[19px] font-bold text-graphite">{title}</h2>
          <IconButton onClick={onClose} aria-label="Kapat" className="-mr-2">
            <X size={22} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-paper px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-2 text-faint">{icon}</div>
      <p className="font-semibold text-graphite">{title}</p>
      {text && <p className="mt-1 max-w-xs text-[15px] text-pencil">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-baseline justify-between px-1">
      <h3 className="text-[17px] font-bold text-graphite">{children}</h3>
      {action}
    </div>
  );
}

/** Onay penceresi (tarayıcının confirm() kutusu yerine) */
export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onCancel}>
            Vazgeç
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} className={cx('flex-1', danger && 'bg-due text-white hover:bg-[#931c13]')} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[16px] text-graphite">{message}</div>
    </Sheet>
  );
}
