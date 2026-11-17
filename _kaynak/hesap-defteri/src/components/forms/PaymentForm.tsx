import { useMemo, useState } from 'react';
import { CircleCheck, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { fmt, fmtDate, fmtRate, fmtWords, parseNum, SYMBOL, today } from '../../lib/format';
import { fetchRates } from '../../lib/rates';
import { computePayment, convert, creditedMoney, EPS, jobPayStates, ledger, round2, subMoney } from '../../lib/money';
import type { Currency, Job, PaymentType, Rates } from '../../types';
import { CURRENCIES } from '../../types';
import { Button, ConfirmSheet, Field, Input, Segmented, Select, Sheet, cx } from '../ui';

const GENEL = '__genel__';
const toInput = (n: number) => (Number.isFinite(n) ? String(round2(n)).replace('.', ',') : '');
/** Kurlar tam hassasiyetle (yuvarlanmadan) gösterilir; aksi halde düzenleme sırasında bakiye kayar */
const toRateInput = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6).replace('.', ',') : '');
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && s >= '2000-01-01' && s <= '2100-12-31';
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

  // Müşteri kendiliğinden seçilmez (yanlış müşteriye ödeme yazmayı önlemek için)
  const [cid, setCid] = useState(existing?.customerId ?? customerId ?? presetJob?.customerId ?? '');

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
  const [showJobs, setShowJobs] = useState(jobSel !== GENEL);
  const job = custJobs.find((j) => j.id === jobSel);

  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? presetJob?.currency ?? 'TRY');
  const [rateStr, setRateStr] = useState<Record<'USD' | 'EUR', string>>({
    USD: toRateInput(existing?.rates.USD ?? settingsRates.USD),
    EUR: toRateInput(existing?.rates.EUR ?? settingsRates.EUR),
  });
  const rates: Rates = { USD: parseNum(rateStr.USD, { rate: true }), EUR: parseNum(rateStr.EUR, { rate: true }) };
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
  const jobChanged = existing ? (existing.jobId ?? GENEL) !== jobSel : false;
  const derivedTarget: Currency | 'AUTO' = openCur.length === 1 ? openCur[0] : openCur.length > 1 ? 'AUTO' : currency;
  const target: Currency | 'AUTO' = job
    ? job.currency
    : existing && !jobChanged && currency === existing.currency
      ? existing.mode === 'auto'
        ? 'AUTO'
        : existing.targetCurrency
      : derivedTarget;

  // Kur yalnızca ödenen döviz ile düşülecek döviz farklıysa sorulur
  const involved = new Set<Currency>(target === 'AUTO' ? openCur : [target]);
  const needsRate = [...involved].some((c) => c !== currency);
  const rateCurs = needsRate ? (['USD', 'EUR'] as const).filter((c) => involved.has(c) || c === currency) : [];

  const fillFor = (j: Job, cur: Currency, r: Rates) => toInput(convert(remainingOf(j), j.currency, cur, r));

  const pickJob = (v: string) => {
    setJobSel(v);
    const j = custJobs.find((x) => x.id === v);
    if (j) {
      // Yazılmış bir tutar varsa ezilmez; yalnızca boşsa işin kalanı yazılır
      if (!amountStr.trim() || auto) {
        setCurrency(j.currency);
        setAmountStr(fillFor(j, j.currency, safeRates));
        setAuto(true);
      }
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
    const r = { USD: parseNum(next.USD, { rate: true }), EUR: parseNum(next.EUR, { rate: true }) };
    if (auto && job && r.USD > 0 && r.EUR > 0) setAmountStr(fillFor(job, currency, r));
  };

  const pullRate = async () => {
    setLoadingRate(true);
    try {
      const r = await fetchRates();
      setRateStr({ USD: toRateInput(r.rates.USD), EUR: toRateInput(r.rates.EUR) });
      if (auto && job) setAmountStr(fillFor(job, currency, r.rates));
    } catch {
      toast('Kur alınamadı, elle girin', 'err');
    } finally {
      setLoadingRate(false);
    }
  };

  const amt = parseNum(amountStr);
  const ratesOk = rateCurs.every((c) => rates[c] > 0);

  // Düzenlemede para ile ilgili hiçbir şey değişmediyse kayıtlı dağılım aynen korunur
  const sameRate = (c: 'USD' | 'EUR') => !existing || Math.abs(safeRates[c] - existing.rates[c]) < 1e-9;
  const moneyUnchanged =
    !!existing && round2(amt) === existing.amount && currency === existing.currency && !jobChanged && cid === existing.customerId && sameRate('USD') && sameRate('EUR');

  const preview = moneyUnchanged
    ? { ...existing!, date, type }
    : amt > 0 && ratesOk && cid
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

  const before = existing ? subMoney(open, creditedMoney(existing)) : null;
  const after = preview ? subMoney(open, creditedMoney(preview)) : open;
  const jobCredit = preview && job ? preview.allocations.filter((a) => a.currency === job.currency).reduce((s, a) => s + a.amount, 0) : 0;
  const jobLeft = job ? round2(remainingOf(job) - jobCredit) : 0;

  const dateOk = isDate(date);
  const amountBad = amountStr.trim() !== '' && !(amt > 0);
  const rateWarn = rateCurs.filter((c) => rates[c] > 0 && Math.abs(rates[c] / settingsRates[c] - 1) > 0.2);
  const valid = !!preview && dateOk && !!cid && (type !== 'urun' || !!description.trim());
  const missing = !cid
    ? 'Müşteri seçin'
    : amountBad || !(amt > 0)
      ? 'Tutarı yazın'
      : !ratesOk
        ? 'Kuru yazın'
        : !dateOk
          ? 'Tarih seçin'
          : type === 'urun' && !description.trim()
            ? 'Alınan ürünün adını yazın'
            : '';

  // Borçtan fazla ödeme (fazladan yazılmış bir sıfır gibi hatalara karşı)
  const over = CURRENCIES.filter((c) => after[c] < -EPS && after[c] < open[c] - EPS).map((c) => ({ c, v: -after[c] }));
  const futureDate = dateOk && date > today();
  const oldDate = dateOk && date < `${new Date().getFullYear() - 3}-01-01`;
  const [askOver, setAskOver] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const doSave = () => {
    if (!valid || !preview) return;
    const p = { ...preview, id: existing?.id ?? uid(), description: description.trim() || undefined, note: note.trim() || undefined };
    dispatch({ type: 'upsertPayment', payment: p });
    toast(existing ? 'Ödeme güncellendi' : `Ödeme kaydedildi: ${fmt(p.amount, p.currency)}`);
    close();
  };
  const save = () => {
    if (!valid) return;
    if (over.length && !moneyUnchanged) setAskOver(true);
    else doSave();
  };

  const remove = () => {
    if (!existing) return;
    const removed = existing;
    dispatch({ type: 'deletePayment', id: removed.id });
    close();
    toast(`Ödeme silindi: ${fmt(removed.amount, removed.currency)}`, 'ok', { label: 'Geri al', run: () => dispatch({ type: 'upsertPayment', payment: removed }) });
  };
  const rateFromSettings = !existing && rateCurs.every((c) => Math.abs(rates[c] - settingsRates[c]) < 1e-9);

  const Radio = ({ on }: { on: boolean }) => (
    <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full ring-2', on ? 'bg-paid ring-paid' : 'ring-faint')}>
      {on && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
  const optCls = (on: boolean) =>
    cx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ring-1 ring-inset transition', on ? 'bg-paid-soft ring-paid' : 'bg-paper ring-line hover:ring-pencil/40');

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'Ödemeyi düzenle' : 'Ödeme aldım'}
      footer={
        <div>
          {!valid && missing && <p className="mb-2 text-center text-[14px] text-pencil">{missing}</p>}
          <div className="flex gap-2">
            {existing && (
              <Button variant="danger" onClick={() => setAskDelete(true)} aria-label="Ödemeyi sil">
                <Trash2 size={18} />
              </Button>
            )}
            <Button variant="success" className="flex-1 text-[16px]" onClick={save} disabled={!valid}>
              <CircleCheck size={20} />
              {existing
                ? 'Değişikliği kaydet'
                : type === 'urun'
                  ? 'Ürünü borçtan düş'
                  : preview
                    ? `${fmt(preview.amount, preview.currency)} ödemeyi kaydet`
                    : 'Ödemeyi kaydet'}
            </Button>
          </div>
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
                setShowJobs(false);
                setAuto(false);
              }}
              className={cx(!cid && 'text-faint')}
            >
              <option value="" disabled>
                Müşteri seçin
              </option>
              {data.customers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            {cid && <span className="num mt-1 block text-[15px] text-due">Şu anki borcu: {fmtWords(open)}</span>}
          </Field>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-desk px-3 py-2.5">
            <span className="text-[17px] font-semibold text-graphite">{data.customers.find((c) => c.id === cid)?.name}</span>
            <span className="num text-right text-[15px] text-due">Şu anki borcu: {fmtWords(before ?? open)}</span>
          </div>
        )}

        {/* 2. Varsayılan: genel borçtan düş. İstenirse belirli bir işe yazılır. */}
        {!showJobs ? (
          cid && (
            <div className="flex items-center justify-between gap-3 text-[15px]">
              <span className="text-pencil">Ödeme müşterinin genel borcundan düşülür.</span>
              {openJobs.length > 0 && (
                <button type="button" onClick={() => setShowJobs(true)} className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-[14px] font-semibold text-ink">
                  Bir işe yaz
                </button>
              )}
            </div>
          )
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-pencil">Hangi işin ödemesi?</span>
              <button
                type="button"
                onClick={() => {
                  pickJob(GENEL);
                  setShowJobs(false);
                }}
                className="min-h-11 px-1 text-[14px] font-semibold text-ink"
              >
                Genel borçtan düş
              </button>
            </div>
            <div className="space-y-1.5">
              <button type="button" onClick={() => pickJob(GENEL)} className={optCls(jobSel === GENEL)}>
                <Radio on={jobSel === GENEL} />
                <span className="flex-1 text-[15px] font-semibold text-graphite">Genel borçtan</span>
              </button>
              {openJobs.map((j) => (
                <button key={j.id} type="button" onClick={() => pickJob(j.id)} className={optCls(jobSel === j.id)}>
                  <Radio on={jobSel === j.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug text-graphite">{j.title}</span>
                    <span className="num block text-[13px] text-pencil">{fmtDate(j.date)}</span>
                  </span>
                  <span className="num shrink-0 text-right text-[14px] text-pencil">
                    kalan <b className="text-[15px] text-due">{fmt(remainingOf(j), j.currency)}</b>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Tutar */}
        <div>
          <label htmlFor="pay-amount" className="mb-1 block text-[14px] font-semibold text-pencil">
            {type === 'urun' ? 'Ürünün değeri' : 'Alınan tutar'}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-faint">{SYMBOL[currency]}</span>
              <Input
                id="pay-amount"
                className={cx('figure min-h-14 pl-9 text-[26px] font-semibold', amountBad && 'border-due focus:border-due focus:ring-due/15')}
                inputMode="decimal"
                autoComplete="off"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setAuto(false);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
              />
            </div>
            <Segmented value={currency} onChange={pickCurrency} label="Ödenen para birimi" options={CURRENCIES.map((c) => ({ value: c, label: SYMBOL[c] }))} className="w-36 [&>button]:min-h-12" />
          </div>
          {amountBad ? (
            <p className="mt-1 text-[14px] font-semibold text-due">Tutar anlaşılamadı. Örnek: 10.000 veya 1.250,50</p>
          ) : amt > 0 ? (
            <p className="num mt-1 text-[14px] text-pencil">
              Okunan tutar: <b className="text-graphite">{fmt(round2(amt), currency, { decimals: !Number.isInteger(round2(amt)) })}</b>
            </p>
          ) : null}
          {job && currency !== job.currency && (
            <p className="mt-1 text-[14px] text-pencil">
              {SYMBOL[job.currency]} cinsinden işe {SYMBOL[currency]} olarak ödeme alıyorsunuz.
            </p>
          )}
        </div>

        {/* 4. Kur (yalnızca gerekirse) */}
        {rateCurs.length > 0 && (
          <div className="rounded-lg border border-ink/25 bg-ink-soft p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-ink">Ödeme günkü kur</span>
              <button type="button" onClick={pullRate} className="inline-flex min-h-9 items-center gap-1.5 text-[14px] font-semibold text-ink">
                {loadingRate ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} İnternetten al
              </button>
            </div>
            <div className={cx('grid gap-2', rateCurs.length > 1 && 'grid-cols-2')}>
              {rateCurs.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-[15px] text-pencil">1 {SYMBOL[c]} =</span>
                  <Input
                    className={cx('num', !(rates[c] > 0) && 'border-due')}
                    inputMode="decimal"
                    autoComplete="off"
                    value={rateStr[c]}
                    onChange={(e) => setRate(c, e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="text-[15px] text-pencil">₺</span>
                </label>
              ))}
            </div>
            {rateFromSettings && (
              <p className="mt-2 text-[14px] text-pencil">
                Ayarlardaki kur yazıldı{data.settings.ratesUpdatedAt ? ` (${fmtDate(data.settings.ratesUpdatedAt.slice(0, 10))})` : ''}. Ödeme günkü kur farklıysa düzeltin.
              </p>
            )}
            {rateWarn.map((c) => (
              <p key={c} className="mt-2 text-[14px] font-semibold text-due">
                Bu {SYMBOL[c]} kuru, kayıtlı kurdan ({fmtRate(settingsRates[c])}) çok farklı. Doğru yazdığınızdan emin olun.
              </p>
            ))}
          </div>
        )}

        {/* Sonuç */}
        {preview && (
          <div className="rounded-lg border border-paid/30 bg-paid-soft p-3">
            <div className="flex items-baseline justify-between gap-2 text-[15px]">
              <span className="text-pencil">Borçtan düşecek</span>
              <span className="figure text-[19px] font-semibold text-paid">{preview.allocations.map((a) => fmt(a.amount, a.currency)).join(' + ')}</span>
            </div>
            {job && (
              <div className="mt-1.5 text-[15px]">
                {jobLeft <= EPS ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold text-paid">
                    <CircleCheck size={16} /> “{job.title}” tamamen kapanacak
                    {jobLeft < -EPS && <span className="num font-normal text-advance">(fazlası {fmt(-jobLeft, job.currency)} diğer borçlardan düşer)</span>}
                  </span>
                ) : (
                  <span className="text-pencil">
                    “{job.title}” için kalan: <span className="num font-semibold text-due">{fmt(jobLeft, job.currency)}</span>
                  </span>
                )}
              </div>
            )}
            <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-paid/20 pt-1.5 text-[15px]">
              <span className="text-pencil">Kaydedince kalan borç</span>
              <span className="num font-semibold text-graphite">{fmtWords(after)}</span>
            </div>
            {over.length > 0 && (
              <p className="mt-1.5 text-[15px] font-semibold text-due">
                Borcundan fazla: {over.map((o) => fmt(o.v, o.c)).join(' + ')} fazla ödeme olarak kalacak. Tutarı kontrol edin.
              </p>
            )}
            {before && !moneyUnchanged && (
              <div className="flex items-baseline justify-between gap-2 text-[14px]">
                <span className="text-faint">Değiştirmeden önce</span>
                <span className="num text-pencil">{fmtWords(before)}</span>
              </div>
            )}
          </div>
        )}

        {/* 5. Ödeme şekli */}
        <Field label="Ödeme şekli">
          <Segmented value={type} onChange={setType} label="Ödeme şekli" options={(Object.keys(TYPE_SHORT) as PaymentType[]).map((t) => ({ value: t, label: TYPE_SHORT[t] }))} />
        </Field>
        {type === 'urun' && (
          <Field label="Alınan ürün veya cihaz" hint="Para girmese de borçtan düşülür.">
            <Input value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder="Örn. Dizüstü bilgisayar" />
          </Field>
        )}

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
            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Dekont no, açıklama" />
          </Field>
        </div>
      </div>
      {askOver && preview && (
        <ConfirmSheet
          title="Borcundan fazla ödeme"
          confirmLabel="Yine de kaydet"
          message={
            <>
              <p>
                {data.customers.find((c) => c.id === cid)?.name} müşterisinin borcu {fmtWords(open)}. Girdiğiniz {fmt(preview.amount, preview.currency)} bunu aşıyor; kaydederseniz{' '}
                <b>{over.map((o) => fmt(o.v, o.c)).join(' + ')}</b> fazla ödeme olarak görünecek.
              </p>
              <p className="mt-2 text-pencil">Tutarı yanlış yazdıysanız Vazgeç'e basıp düzeltin.</p>
            </>
          }
          onCancel={() => setAskOver(false)}
          onConfirm={() => {
            setAskOver(false);
            doSave();
          }}
        />
      )}
      {askDelete && existing && (
        <ConfirmSheet
          title="Ödeme silinsin mi?"
          confirmLabel="Ödemeyi sil"
          danger
          message={
            <p>
              {data.customers.find((c) => c.id === existing.customerId)?.name} müşterisinden {fmtDate(existing.date)} tarihinde alınan <b>{fmt(existing.amount, existing.currency)}</b> silinecek.
              Müşterinin borcu {existing.allocations.map((a) => fmt(a.amount, a.currency)).join(' + ')} artacak.
            </p>
          }
          onCancel={() => setAskDelete(false)}
          onConfirm={remove}
        />
      )}
    </Sheet>
  );
}
