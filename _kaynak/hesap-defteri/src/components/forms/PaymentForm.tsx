import { useMemo, useState } from 'react';
import { CircleCheck, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { fmt, fmtBreakdown, parseNum, SYMBOL, today } from '../../lib/format';
import { fetchRates } from '../../lib/rates';
import { computePayment, convert, creditedMoney, EPS, jobPayStates, ledger, round2, subMoney } from '../../lib/money';
import type { Currency, Job, PaymentType, Rates } from '../../types';
import { CURRENCIES } from '../../types';
import { Button, Field, Input, Segmented, Select, Sheet, cx } from '../ui';

const GENEL = '__genel__';
const toInput = (n: number) => (Number.isFinite(n) ? String(round2(n)).replace('.', ',') : '');
const TYPE_SHORT: Record<PaymentType, string> = { havale: 'Havale', nakit: 'Nakit', cek: 'Çek', urun: 'Ürün' };

/**
 * Basit tahsilat akışı:
 *  1) Müşteri  2) Hangi iş? (açık işler, ya da "Genel")  3) Tutar + döviz
 *  4) Döviz farklıysa tek kur kutusu  5) Tahsil Et
 * Hangi döviz bakiyesinden düşüleceği otomatik belirlenir.
 */
export function PaymentForm({ id, customerId, jobId }: { id?: string; customerId?: string; jobId?: string }) {
  const { data, dispatch } = useStore();
  const { close, toast } = useUI();
  const existing = data.payments.find((p) => p.id === id);
  const presetJob = data.jobs.find((j) => j.id === (existing?.jobId ?? jobId));
  const settingsRates = data.settings.rates;

  const [cid, setCid] = useState(existing?.customerId ?? customerId ?? presetJob?.customerId ?? data.customers[0]?.id ?? '');

  // Bu ödeme hariç müşterinin işleri, ödemeleri ve açık bakiyesi
  const custJobs = useMemo(() => data.jobs.filter((j) => j.customerId === cid), [data.jobs, cid]);
  const otherPays = useMemo(() => data.payments.filter((p) => p.customerId === cid && p.id !== existing?.id), [data.payments, cid, existing?.id]);
  const states = useMemo(() => jobPayStates(custJobs, otherPays), [custJobs, otherPays]);
  const open = useMemo(() => ledger(custJobs, otherPays, settingsRates).balance, [custJobs, otherPays, settingsRates]);
  const openJobs = useMemo(
    () =>
      custJobs
        .map((j, i) => ({ j, i }))
        .filter(({ j }) => states[j.id]?.state !== 'tahsil' || j.id === existing?.jobId)
        .sort((a, b) => a.j.date.localeCompare(b.j.date) || a.i - b.i)
        .map(({ j }) => j),
    [custJobs, states, existing?.jobId],
  );

  const remainingOf = (j: Job) => states[j.id]?.remaining ?? j.amount;

  const [jobSel, setJobSel] = useState<string>(existing ? existing.jobId ?? GENEL : presetJob?.id ?? GENEL);
  const job = custJobs.find((j) => j.id === jobSel);

  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? presetJob?.currency ?? 'TRY');
  const [rateStr, setRateStr] = useState<Record<'USD' | 'EUR', string>>({
    USD: toInput(existing?.rates.USD ?? settingsRates.USD),
    EUR: toInput(existing?.rates.EUR ?? settingsRates.EUR),
  });
  const rates: Rates = { USD: parseNum(rateStr.USD), EUR: parseNum(rateStr.EUR) };
  const safeRates: Rates = { USD: rates.USD > 0 ? rates.USD : settingsRates.USD, EUR: rates.EUR > 0 ? rates.EUR : settingsRates.EUR };

  // Tutar: iş seçilince kalan tutarla otomatik dolar (kullanıcı değiştirene kadar)
  const [amountStr, setAmountStr] = useState(existing ? toInput(existing.amount) : presetJob ? toInput(remainingOf(presetJob)) : '');
  const [auto, setAuto] = useState(!existing && !!presetJob);
  const [type, setType] = useState<PaymentType>(existing?.type ?? 'havale');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [loadingRate, setLoadingRate] = useState(false);

  // Hangi döviz bakiyesinden düşülecek? (otomatik)
  const openCur = CURRENCIES.filter((c) => open[c] > EPS);
  const target: Currency | 'AUTO' = job ? job.currency : openCur.length === 1 ? openCur[0] : openCur.length > 1 ? 'AUTO' : currency;

  // Kur yalnızca ödenen döviz ile düşülecek döviz farklıysa sorulur
  const involved = new Set<Currency>(target === 'AUTO' ? openCur : [target]);
  const needsRate = [...involved].some((c) => c !== currency);
  const rateCurs = needsRate ? (['USD', 'EUR'] as const).filter((c) => involved.has(c) || c === currency) : [];

  const fillFor = (j: Job, cur: Currency, r: Rates) => toInput(convert(remainingOf(j), j.currency, cur, r));

  const pickJob = (v: string) => {
    setJobSel(v);
    const j = custJobs.find((x) => x.id === v);
    if (j) {
      setCurrency(j.currency);
      setAmountStr(fillFor(j, j.currency, safeRates));
      setAuto(true);
    } else if (auto) {
      setAmountStr('');
      setAuto(false);
    }
  };

  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    if (auto && job) setAmountStr(fillFor(job, c, safeRates));
  };

  const setRate = (c: 'USD' | 'EUR', v: string) => {
    const next = { ...rateStr, [c]: v };
    setRateStr(next);
    const r = { USD: parseNum(next.USD), EUR: parseNum(next.EUR) };
    if (auto && job && r.USD > 0 && r.EUR > 0) setAmountStr(fillFor(job, currency, r));
  };

  const pullRate = async () => {
    setLoadingRate(true);
    try {
      const r = await fetchRates();
      setRateStr({ USD: toInput(r.rates.USD), EUR: toInput(r.rates.EUR) });
      if (auto && job) setAmountStr(fillFor(job, currency, r.rates));
    } catch {
      toast('Kur alınamadı, elle girin', 'err');
    } finally {
      setLoadingRate(false);
    }
  };

  const amt = parseNum(amountStr);
  const ratesOk = rateCurs.every((c) => rates[c] > 0);

  const preview =
    amt > 0 && ratesOk && cid
      ? computePayment(
          {
            id: existing?.id ?? 'yeni',
            customerId: cid,
            date,
            type,
            amount: round2(amt),
            currency,
            mode: target === 'AUTO' ? 'auto' : 'single',
            targetCurrency: target === 'AUTO' ? currency : target,
            rates: safeRates,
            jobId: job?.id,
          },
          open,
        )
      : null;

  const after = preview ? subMoney(open, creditedMoney(preview)) : open;
  const jobCredit = preview && job ? preview.allocations.filter((a) => a.currency === job.currency).reduce((s, a) => s + a.amount, 0) : 0;
  const jobLeft = job ? round2(remainingOf(job) - jobCredit) : 0;

  const valid = !!preview && (type !== 'urun' || !!description.trim());

  const save = () => {
    if (!valid || !preview) return;
    const p = { ...preview, id: existing?.id ?? uid(), description: description.trim() || undefined, note: note.trim() || undefined };
    dispatch({ type: 'upsertPayment', payment: p });
    toast(existing ? 'Ödeme güncellendi' : `Tahsil edildi: ${fmt(p.amount, p.currency)}`);
    close();
  };

  const remove = () => {
    if (!existing || !confirm('Bu ödeme kaydı silinsin mi?')) return;
    dispatch({ type: 'deletePayment', id: existing.id });
    toast('Ödeme silindi');
    close();
  };

  const Radio = ({ on }: { on: boolean }) => (
    <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full ring-2', on ? 'bg-emerald-400 ring-emerald-400' : 'ring-zinc-600')}>
      {on && <span className="h-2 w-2 rounded-full bg-zinc-950" />}
    </span>
  );
  const optCls = (on: boolean) =>
    cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition', on ? 'bg-emerald-400/10 ring-emerald-400/50' : 'bg-zinc-950/50 ring-white/10 hover:ring-white/20');

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'Ödemeyi Düzenle' : 'Tahsilat Al'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="danger" onClick={remove} aria-label="Sil">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="success" className="min-h-12 flex-1 text-base" onClick={save} disabled={!valid}>
            <CircleCheck size={20} />
            {preview ? `${fmt(preview.amount, preview.currency)} Tahsil Et` : 'Tahsil Et'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 1. Müşteri */}
        {!customerId && !presetJob && !existing ? (
          <Field label="Müşteri">
            <Select
              value={cid}
              onChange={(e) => {
                setCid(e.target.value);
                setJobSel(GENEL);
                setAuto(false);
              }}
            >
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
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <span className="font-semibold text-white">{data.customers.find((c) => c.id === cid)?.name}</span>
            <span className="num text-right text-sm text-amber-300">Borç: {fmtBreakdown(open, { hideZero: true })}</span>
          </div>
        )}

        {/* 2. Hangi iş? */}
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">Hangi işin ödemesi?</div>
          <div className="space-y-1.5">
            {openJobs.map((j) => (
              <button key={j.id} type="button" onClick={() => pickJob(j.id)} className={optCls(jobSel === j.id)}>
                <Radio on={jobSel === j.id} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{j.title}</span>
                <span className="num shrink-0 text-sm font-semibold text-amber-300">{fmt(remainingOf(j), j.currency)}</span>
              </button>
            ))}
            <button type="button" onClick={() => pickJob(GENEL)} className={optCls(jobSel === GENEL)}>
              <Radio on={jobSel === GENEL} />
              <span className="flex-1 text-sm text-zinc-300">
                Genel ödeme <span className="text-zinc-500">(en eski borçtan düşülür)</span>
              </span>
            </button>
          </div>
        </div>

        {/* 3. Tutar */}
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">{type === 'urun' ? 'Ürünün değeri' : 'Alınan tutar'}</div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-500">{SYMBOL[currency]}</span>
              <Input
                className="num min-h-14 pl-9 text-2xl font-bold"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setAuto(false);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
              />
            </div>
            <Segmented value={currency} onChange={pickCurrency} options={CURRENCIES.map((c) => ({ value: c, label: SYMBOL[c] }))} className="w-36 [&>button]:min-h-12" />
          </div>
          {job && currency !== job.currency && (
            <p className="mt-1.5 text-xs text-zinc-500">
              {SYMBOL[job.currency]} cinsinden iş için {SYMBOL[currency]} olarak ödeme alıyorsunuz.
            </p>
          )}
        </div>

        {/* 4. Kur (yalnızca gerekirse) */}
        {rateCurs.length > 0 && (
          <div className="rounded-xl bg-sky-400/[0.06] p-3 ring-1 ring-inset ring-sky-400/20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-sky-200/80">Ödeme günkü kur</span>
              <button type="button" onClick={pullRate} className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300">
                {loadingRate ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Güncel kuru getir
              </button>
            </div>
            <div className={cx('grid gap-2', rateCurs.length > 1 && 'grid-cols-2')}>
              {rateCurs.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-sm text-zinc-400">1 {SYMBOL[c]} =</span>
                  <Input className="num" inputMode="decimal" value={rateStr[c]} onChange={(e) => setRate(c, e.target.value)} onFocus={(e) => e.target.select()} />
                  <span className="text-sm text-zinc-400">₺</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sonuç */}
        {preview && (
          <div className="rounded-xl bg-emerald-400/[0.07] p-3 ring-1 ring-inset ring-emerald-400/20">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-zinc-400">Borçtan düşecek</span>
              <span className="num text-base font-bold text-emerald-300">{preview.allocations.map((a) => fmt(a.amount, a.currency)).join(' + ')}</span>
            </div>
            {job && (
              <div className="mt-1.5 text-sm">
                {jobLeft <= EPS ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-emerald-300">
                    <CircleCheck size={16} /> “{job.title}” tamamen kapanacak
                    {jobLeft < -EPS && <span className="num font-normal text-sky-300">(fazlası {fmt(-jobLeft, job.currency)} diğer borçlardan düşer)</span>}
                  </span>
                ) : (
                  <span className="text-zinc-300">
                    “{job.title}” için kalan: <span className="num font-semibold text-amber-300">{fmt(jobLeft, job.currency)}</span>
                  </span>
                )}
              </div>
            )}
            <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-white/5 pt-1.5 text-sm">
              <span className="text-zinc-400">Müşterinin kalan borcu</span>
              <span className="num font-semibold text-zinc-100">{fmtBreakdown(after, { hideZero: true })}</span>
            </div>
          </div>
        )}

        {/* 5. Ödeme şekli */}
        <Field label="Ödeme şekli">
          <Segmented value={type} onChange={setType} options={(Object.keys(TYPE_SHORT) as PaymentType[]).map((t) => ({ value: t, label: TYPE_SHORT[t] }))} />
        </Field>
        {type === 'urun' && (
          <Field label="Alınan ürün / cihaz" hint="Para girmese de borçtan düşülür.">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Örn. Dizüstü bilgisayar" />
          </Field>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Field label="Tarih">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          </Field>
          <Field label="Not">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsiyonel" />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
