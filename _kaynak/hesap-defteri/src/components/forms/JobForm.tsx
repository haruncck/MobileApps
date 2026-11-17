import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { fmt, fmtDate, parseNum, SYMBOL, today } from '../../lib/format';
import { EPS, round2 } from '../../lib/money';
import type { Currency } from '../../types';
import { CURRENCIES } from '../../types';
import { Button, ConfirmSheet, Field, Input, Segmented, Select, Sheet, cx } from '../ui';

const NEW = '__new__';
export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && s >= '2000-01-01' && s <= '2100-12-31';

export function JobForm({ id, customerId }: { id?: string; customerId?: string }) {
  const { data, dispatch } = useStore();
  const { close, toast } = useUI();
  const existing = data.jobs.find((j) => j.id === id);

  // Müşteri kendiliğinden seçilmez (yanlış müşteriye yazmayı önlemek için)
  const [cid, setCid] = useState(existing?.customerId ?? customerId ?? (data.customers.length ? '' : NEW));
  const lastCurrency = (c: string): Currency => {
    const js = data.jobs.filter((j) => j.customerId === c);
    return js.length ? js[js.length - 1].currency : 'TRY';
  };
  const [newName, setNewName] = useState('');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? (customerId ? lastCurrency(customerId) : 'TRY'));
  const [note, setNote] = useState(existing?.note ?? '');
  const [askDelete, setAskDelete] = useState(false);

  const amt = parseNum(amount);
  const amountBad = amount.trim() !== '' && !(amt > 0);
  const dateOk = isValidDate(date);
  const customerOk = cid === NEW ? !!newName.trim() : !!cid;
  const valid = !!title.trim() && amt > 0 && dateOk && customerOk;
  const futureDate = dateOk && date > today();
  const oldDate = dateOk && date < `${new Date().getFullYear() - 3}-01-01`;
  // Tutar düşürülünce müşteri fazla ödemiş görünecek mi?
  const custId = existing?.customerId ?? cid;
  const balAfter = (() => {
    if (!(amt > 0) || !custId || custId === NEW) return 0;
    const jobsSum = data.jobs.filter((j) => j.customerId === custId && j.currency === currency && j.id !== existing?.id).reduce((s, j) => s + j.amount, 0);
    const credited = data.payments
      .filter((p) => p.customerId === custId)
      .reduce((s, p) => s + p.allocations.filter((a) => a.currency === currency).reduce((x, a) => x + a.amount, 0), 0);
    return round2(jobsSum + amt - credited);
  })();

  // Düzenlemede dövizi değiştirmek, o dövizde alınmış ödemeleri fazla ödeme olarak bırakabilir
  const creditedInOld =
    existing && currency !== existing.currency
      ? data.payments
          .filter((p) => p.customerId === existing.customerId)
          .reduce((s, p) => s + p.allocations.filter((a) => a.currency === existing.currency).reduce((x, a) => x + a.amount, 0), 0)
      : 0;

  const missing = !customerOk ? 'Müşteri seçin' : !title.trim() ? 'Yapılan işi yazın' : !(amt > 0) ? 'Tutarı yazın' : !dateOk ? 'Tarih seçin' : '';

  const save = () => {
    if (!valid) return;
    let customerIdFinal = cid;
    if (cid === NEW) {
      const found = data.customers.find((c) => c.name.toLocaleLowerCase('tr') === newName.trim().toLocaleLowerCase('tr'));
      customerIdFinal = found?.id ?? uid();
      if (!found) dispatch({ type: 'upsertCustomer', customer: { id: customerIdFinal, name: newName.trim(), createdAt: new Date().toISOString() } });
    }
    dispatch({
      type: 'upsertJob',
      job: {
        id: existing?.id ?? uid(),
        customerId: customerIdFinal,
        title: title.trim(),
        date,
        amount: round2(amt),
        currency,
        status: existing?.status ?? 'tamamlandi',
        note: note.trim() || undefined,
      },
    });
    toast(existing ? 'İş güncellendi' : `İş yazıldı: ${fmt(round2(amt), currency)}`);
    close();
  };

  const remove = () => {
    if (!existing) return;
    const removed = existing;
    dispatch({ type: 'deleteJob', id: removed.id });
    close();
    toast(`İş silindi: ${removed.title}`, 'ok', { label: 'Geri al', run: () => dispatch({ type: 'upsertJob', job: removed }) });
  };

  const custName = data.customers.find((c) => c.id === (existing?.customerId ?? cid))?.name;

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'İşi düzenle' : 'İş yaptım'}
      footer={
        <div>
          {!valid && missing && <p className="mb-2 text-center text-[14px] text-pencil">{missing}</p>}
          <div className="flex gap-2">
            {existing && (
              <Button variant="danger" onClick={() => setAskDelete(true)} aria-label="İşi sil">
                <Trash2 size={18} />
              </Button>
            )}
            <Button variant="primary" className="flex-1 text-[16px]" onClick={save} disabled={!valid}>
              {existing ? 'Değişikliği kaydet' : amt > 0 ? `${fmt(round2(amt), currency)} işi kaydet` : 'İşi kaydet'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {customerId || existing ? (
          <div className="rounded-lg bg-desk px-3 py-2.5 text-[17px] font-semibold text-graphite">{custName}</div>
        ) : (
          <Field label="Müşteri">
            <Select
              value={cid}
              onChange={(e) => {
                setCid(e.target.value);
                if (e.target.value && e.target.value !== NEW) setCurrency(lastCurrency(e.target.value));
              }}
              className={cx(!cid && 'text-faint')}
            >
              {data.customers.length > 0 && (
                <option value="" disabled>
                  Müşteri seçin
                </option>
              )}
              {data.customers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              <option value={NEW}>+ Yeni müşteri</option>
            </Select>
          </Field>
        )}
        {cid === NEW && !existing && (
          <Field label="Yeni müşterinin adı">
            <Input autoFocus value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="Firma adı" />
          </Field>
        )}
        <Field label="Yapılan iş">
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Hidrolik pano, PLC yazılımı" />
        </Field>

        <div>
          <label htmlFor="job-amount" className="mb-1 block text-[14px] font-semibold text-pencil">
            Tutar
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-faint">{SYMBOL[currency]}</span>
              <Input
                id="job-amount"
                className={cx('figure min-h-14 pl-9 text-[26px] font-semibold', amountBad && 'border-due')}
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <Segmented value={currency} onChange={setCurrency} label="Para birimi" options={CURRENCIES.map((c) => ({ value: c, label: SYMBOL[c] }))} className="w-36 [&>button]:min-h-12" />
          </div>
          {amountBad ? (
            <p className="mt-1 text-[14px] font-semibold text-due">Tutar anlaşılamadı. Örnek: 10.000 veya 1.250,50</p>
          ) : amt > 0 ? (
            <p className="num mt-1 text-[14px] text-pencil">
              Okunan tutar: <b className="text-graphite">{fmt(round2(amt), currency, { decimals: !Number.isInteger(round2(amt)) })}</b>
            </p>
          ) : null}
          {existing && balAfter < -EPS && creditedInOld <= EPS && (
            <p className="mt-1 text-[14px] font-semibold text-due">
              Bu tutarla müşteri {fmt(-balAfter, currency)} fazla ödemiş görünecek. Tutarı kontrol edin.
            </p>
          )}
          {creditedInOld > EPS && existing && (
            <p className="mt-1 text-[14px] font-semibold text-due">
              Bu müşteriden {fmt(round2(creditedInOld), existing.currency)} ödeme {SYMBOL[existing.currency]} olarak alındı. İşin para birimini değiştirirseniz bu ödeme{' '}
              {SYMBOL[existing.currency]} hanesinde fazla ödeme olarak kalır.
            </p>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Field
            label="Tarih"
            hint={!dateOk ? <span className="font-semibold text-due">Tarih seçin</span> : futureDate ? (
                <span className="font-semibold text-due">İleri tarih: {fmtDate(date)}</span>
              ) : oldDate ? (
                <span className="font-semibold text-due">Çok eski tarih: {fmtDate(date)}</span>
              ) : undefined
            }
          >
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={cx('w-40', !dateOk && 'border-due')} />
          </Field>
          <Field label="Not (isteğe bağlı)">
            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Teklif veya fatura no" />
          </Field>
        </div>
      </div>
      {askDelete && existing && (
        <ConfirmSheet
          title="İş silinsin mi?"
          confirmLabel="İşi sil"
          danger
          message={
            <p>
              {custName} için yazılan “{existing.title}” ({fmt(existing.amount, existing.currency)}, {fmtDate(existing.date)}) silinecek. Müşterinin borcu bu kadar azalacak.
            </p>
          }
          onCancel={() => setAskDelete(false)}
          onConfirm={remove}
        />
      )}
    </Sheet>
  );
}
