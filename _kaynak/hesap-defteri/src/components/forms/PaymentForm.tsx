import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { fmt, fmtBreakdown, fmtRate, parseNum, SYMBOL, today } from '../../lib/format';
import { fetchRates } from '../../lib/rates';
import { computePayment, creditedMoney, EPS, ledger, round2, subMoney, suggestTarget } from '../../lib/money';
import type { Currency, PaymentType, Rates } from '../../types';
import { CURRENCIES, PAYMENT_TYPE_LABEL } from '../../types';
import { Button, Field, Input, Segmented, Select, Sheet, Textarea, cx } from '../ui';

type Target = Currency | 'AUTO';

export function PaymentForm({ id, customerId, jobId }: { id?: string; customerId?: string; jobId?: string }) {
  const { data, dispatch } = useStore();
  const { close, toast } = useUI();
  const existing = data.payments.find((p) => p.id === id);
  const presetJob = data.jobs.find((j) => j.id === (existing?.jobId ?? jobId));

  const [cid, setCid] = useState(existing?.customerId ?? customerId ?? presetJob?.customerId ?? data.customers[0]?.id ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [type, setType] = useState<PaymentType>(existing?.type ?? 'havale');
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'TRY');
  const [relJob, setRelJob] = useState(existing?.jobId ?? jobId ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [rateUSD, setRateUSD] = useState(String(existing?.rates.USD ?? data.settings.rates.USD).replace('.', ','));
  const [rateEUR, setRateEUR] = useState(String(existing?.rates.EUR ?? data.settings.rates.EUR).replace('.', ','));
  const [rateMsg, setRateMsg] = useState('');
  const [loadingRate, setLoadingRate] = useState(false);

  // Bu ödeme hariç müşterinin açık bakiyesi
  const open = useMemo(() => {
    const l = ledger(
      data.jobs.filter((j) => j.customerId === cid),
      data.payments.filter((p) => p.customerId === cid && p.id !== existing?.id),
      data.settings.rates,
    );
    return l.balance;
  }, [data, cid, existing?.id]);

  const defaultTarget = (): Target => {
    if (existing) return existing.mode === 'auto' ? 'AUTO' : existing.targetCurrency;
    if (presetJob) return presetJob.currency;
    const openCur = CURRENCIES.filter((c) => open[c] > EPS);
    if (openCur.length > 1) return 'AUTO';
    return suggestTarget(open, 'TRY');
  };
  const [target, setTarget] = useState<Target>(defaultTarget);

  const custJobs = data.jobs.filter((j) => j.customerId === cid).sort((a, b) => b.date.localeCompare(a.date));
  const rates: Rates = { USD: parseNum(rateUSD), EUR: parseNum(rateEUR) };
  const amt = parseNum(amount);

  // Hangi kurlar gerekli?
  const involved = new Set<Currency>([currency]);
  if (target === 'AUTO') CURRENCIES.filter((c) => open[c] > EPS).forEach((c) => involved.add(c));
  else involved.add(target);
  const needsRate = involved.size > 1;
  const neededRates = (['USD', 'EUR'] as const).filter((c) => involved.has(c));
  const ratesValid = neededRates.every((c) => rates[c] > 0);

  const preview = useMemo(() => {
    if (!(amt > 0) || !ratesValid) return null;
    const safeRates = { USD: rates.USD > 0 ? rates.USD : data.settings.rates.USD, EUR: rates.EUR > 0 ? rates.EUR : data.settings.rates.EUR };
    return computePayment(
      {
        id: 'preview',
        customerId: cid,
        date,
        type,
        amount: round2(amt),
        currency,
        mode: target === 'AUTO' ? 'auto' : 'single',
        targetCurrency: target === 'AUTO' ? currency : target,
        rates: safeRates,
      },
      open,
    );
  }, [amt, ratesValid, rates.USD, rates.EUR, cid, date, type, currency, target, open, data.settings.rates]);

  const after = preview ? subMoney(open, creditedMoney(preview)) : open;
  const overpaid = preview ? CURRENCIES.filter((c) => after[c] < -EPS && open[c] > -EPS) : [];

  const valid = cid && amt > 0 && ratesValid && (type !== 'urun' || description.trim());

  const pullRate = async () => {
    setLoadingRate(true);
    setRateMsg('');
    try {
      const r = await fetchRates();
      setRateUSD(String(r.rates.USD).replace('.', ','));
      setRateEUR(String(r.rates.EUR).replace('.', ','));
      setRateMsg(`${r.source} · ${r.date}`);
    } catch {
      setRateMsg('Kur alınamadı (çevrimdışı?). Elle girebilirsiniz.');
    } finally {
      setLoadingRate(false);
    }
  };

  const save = () => {
    if (!valid || !preview) return;
    const p = { ...preview, id: existing?.id ?? uid(), jobId: relJob || undefined, description: description.trim() || undefined, note: note.trim() || undefined };
    dispatch({ type: 'upsertPayment', payment: p });
    toast(existing ? 'Ödeme güncellendi' : `Tahsilat kaydedildi: ${fmt(p.amount, p.currency)}`);
    close();
  };

  const remove = () => {
    if (!existing || !confirm('Bu ödeme kaydı silinsin mi?')) return;
    dispatch({ type: 'deletePayment', id: existing.id });
    toast('Ödeme silindi');
    close();
  };

  const targetOptions: Array<{ value: Target; label: React.ReactNode }> = [
    { value: 'AUTO', label: 'Otomatik' },
    ...CURRENCIES.map((c) => ({ value: c as Target, label: SYMBOL[c] })),
  ];

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'Ödemeyi Düzenle' : 'Yeni Tahsilat / Mahsup'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="danger" onClick={remove} aria-label="Sil">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="success" className="flex-1" onClick={save} disabled={!valid}>
            {existing ? 'Güncelle' : 'Tahsilatı Kaydet'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Müşteri">
          <Select value={cid} onChange={(e) => { setCid(e.target.value); setRelJob(''); }}>
            {data.customers
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>

        <div className="rounded-xl bg-amber-400/[0.06] px-3 py-2.5 ring-1 ring-inset ring-amber-400/15">
          <div className="text-[11px] font-medium uppercase tracking-wide text-amber-300/70">Açık Bakiye</div>
          <div className="num mt-0.5 text-sm font-semibold text-amber-200">{fmtBreakdown(open)}</div>
        </div>

        <Field label="Ödeme Türü">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PAYMENT_TYPE_LABEL) as PaymentType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cx(
                  'min-h-11 rounded-xl px-3 text-left text-sm font-medium ring-1 ring-inset transition',
                  type === t ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/40' : 'bg-zinc-950/50 text-zinc-400 ring-white/10 hover:text-zinc-200',
                )}
              >
                {PAYMENT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </Field>

        {type === 'urun' && (
          <Field label="Alınan Ürün / Cihaz" hint="Nakit girmese de bakiyeden düşülür (ayni ödeme).">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Örn. Dizüstü bilgisayar" />
          </Field>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={type === 'urun' ? 'Ürünün Değeri' : 'Ödenen Tutar'}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{SYMBOL[currency]}</span>
              <Input className="num pl-8 text-lg font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus={!existing} />
            </div>
          </Field>
          <Field label="Ödenen Döviz">
            <Segmented value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: SYMBOL[c] }))} className="w-36" />
          </Field>
        </div>

        <Field
          label="Hangi Bakiyeden Düşülsün?"
          hint={target === 'AUTO' ? 'Ödeme, işlem kuruyla açık döviz bakiyelerine sırayla dağıtılır.' : `Tamamı ${SYMBOL[target]} bakiyesinden düşülür.`}
        >
          <Segmented value={target} onChange={setTarget} options={targetOptions} />
        </Field>

        {neededRates.length > 0 && (
          <div className="rounded-xl bg-zinc-950/50 p-3 ring-1 ring-inset ring-white/10">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">İşlem Anındaki Kur</span>
              <button type="button" onClick={pullRate} className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200">
                {loadingRate ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Güncel kuru çek
              </button>
            </div>
            <div className={cx('grid gap-3', neededRates.length > 1 && 'grid-cols-2')}>
              {neededRates.map((c) => (
                <label key={c} className="block">
                  <span className="mb-1 block text-xs text-zinc-500">1 {SYMBOL[c]} = ? ₺</span>
                  <Input
                    className="num"
                    inputMode="decimal"
                    value={c === 'USD' ? rateUSD : rateEUR}
                    onChange={(e) => (c === 'USD' ? setRateUSD : setRateEUR)(e.target.value)}
                  />
                </label>
              ))}
            </div>
            {rateMsg && <p className="mt-2 text-xs text-zinc-500">{rateMsg}</p>}
          </div>
        )}

        {preview && (
          <div className="space-y-2 rounded-xl bg-emerald-400/[0.06] p-3 ring-1 ring-inset ring-emerald-400/20">
            <Row label="Ödeme">
              <span className="num">{fmt(preview.amount, preview.currency)}</span>
              {preview.currency !== 'TRY' && <span className="num text-zinc-400"> ≈ {fmt(preview.amountTRY, 'TRY')}</span>}
            </Row>
            <Row label="Bakiyeden düşen">
              <span className="num font-semibold text-emerald-300">
                {preview.allocations.map((a) => fmt(a.amount, a.currency)).join(' + ')}
              </span>
            </Row>
            {needsRate && (
              <Row label="Kullanılan kur">
                <span className="num text-zinc-400">
                  {neededRates.map((c) => `${SYMBOL[c]} ${fmtRate(preview.rates[c])}`).join(' · ')}
                </span>
              </Row>
            )}
            <div className="flex items-center gap-2 border-t border-white/5 pt-2 text-sm">
              <span className="text-zinc-400">Kalan</span>
              <span className="num text-zinc-500 line-through decoration-zinc-600">{fmtBreakdown(open, { hideZero: true })}</span>
              <ArrowRight size={14} className="text-zinc-600" />
              <span className="num font-semibold text-zinc-100">{fmtBreakdown(after, { hideZero: true })}</span>
            </div>
            {overpaid.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-sky-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {overpaid.map((c) => SYMBOL[c]).join(', ')} bakiyesi aşılıyor; fazlası avans olarak görünecek.
                {target !== 'AUTO' && CURRENCIES.some((c) => c !== target && open[c] > EPS) && ' Diğer dövizdeki açık bakiyeye dağıtmak için “Otomatik” seçin.'}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tarih">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="İlgili İş (opsiyonel)">
            <Select value={relJob} onChange={(e) => setRelJob(e.target.value)}>
              <option value="">— Genel (cari) —</option>
              {custJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {fmt(j.amount, j.currency)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Not (opsiyonel)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dekont no, açıklama…" />
        </Field>
      </div>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
