import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FileJson, FileSpreadsheet, Loader2, Plus, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Smartphone, Trash2, Upload, X } from 'lucide-react';
import { jobSuggestions, newTemplate } from '../lib/templates';
import { fmt, SYMBOL } from '../lib/format';
import { CURRENCIES } from '../types';
import type { Currency } from '../types';
import { round2 } from '../lib/money';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { fmtRate, parseNum } from '../lib/format';
import { emptyData } from '../lib/seed';
import { loadSnapshot } from '../services/storage';
import type { AppData } from '../types';
import { Button, ConfirmSheet, Field, Input, Ledger, SectionTitle, Segmented, Sheet, cx } from '../components/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InstallEvent = any;

const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null);
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function Settings() {
  const { data, dispatch, refreshRates, ratesLoading, replaceAll, restoreSnapshot, persisted } = useStore();
  const { toast } = useUI();
  const [usd, setUsd] = useState(fmtRate(data.settings.rates.USD));
  const [eur, setEur] = useState(fmtRate(data.settings.rates.EUR));
  const [busy, setBusy] = useState<'' | 'xlsx' | 'import'>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [installEvt, setInstallEvt] = useState<InstallEvent>(null);
  const [snap, setSnap] = useState<{ at: string; reason: string; data: AppData } | null>(null);
  const [dialog, setDialog] = useState<
    | null
    | { kind: 'import'; next: AppData; fileName: string }
    | { kind: 'issues'; issues: string[]; fileName: string }
    | { kind: 'wipe' }
    | { kind: 'undo' }
  >(null);

  useEffect(() => {
    setUsd(fmtRate(data.settings.rates.USD));
    setEur(fmtRate(data.settings.rates.EUR));
  }, [data.settings.rates]);

  useEffect(() => {
    loadSnapshot().then(setSnap);
  }, [data]);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const saveRates = () => {
    const U = parseNum(usd, { rate: true });
    const E = parseNum(eur, { rate: true });
    if (!(U > 0 && E > 0)) return toast('Kur geçersiz. Örnek: 42,24', 'err');
    dispatch({ type: 'setRates', rates: { USD: U, EUR: E }, source: 'Elle girildi' });
    toast('Kurlar kaydedildi');
  };

  const exportXlsx = async () => {
    setBusy('xlsx');
    try {
      const { exportWorkbook } = await import('../services/excel');
      exportWorkbook(data);
      dispatch({ type: 'markBackup' });
      toast('Excel yedeği indirildi');
    } catch (e) {
      toast(`Yedek alınamadı: ${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setBusy('');
    }
  };

  const exportJson = async () => {
    const { exportJSON } = await import('../services/excel');
    exportJSON(data);
    dispatch({ type: 'markBackup' });
    toast('JSON yedeği indirildi');
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    setBusy('import');
    try {
      const { importFile } = await import('../services/excel');
      const res = await importFile(f);
      if (res.issues.length) setDialog({ kind: 'issues', issues: res.issues, fileName: f.name });
      else if (!res.data.customers.length) setDialog({ kind: 'issues', issues: ['Dosyada hiç müşteri yok.'], fileName: f.name });
      else setDialog({ kind: 'import', next: res.data, fileName: f.name });
    } catch (e) {
      toast((e as Error).message || 'Dosya okunamadı', 'err');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const backupDays = daysSince(data.settings.lastBackupAt);
  const hasData = data.customers.length > 0;
  const backupWarn = hasData && (backupDays === null || backupDays >= 7);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-[28px] font-bold text-graphite">Ayarlar</h1>

      {/* Yedek */}
      <SectionTitle>Yedek</SectionTitle>
      <Ledger>
        <div className="rows">
          <div className={cx('px-3 py-3', backupWarn && 'bg-due-soft')}>
            <div className={cx('text-[16px] font-semibold', backupWarn ? 'text-due' : 'text-graphite')}>
              {backupDays === null ? 'Henüz hiç yedek almadınız' : backupDays === 0 ? 'Son yedek bugün alındı' : `Son yedek ${backupDays} gün önce alındı`}
            </div>
            <p className="text-[14px] text-pencil">
              Kayıtlar yalnızca bu telefonda duruyor. Telefon kaybolur ya da tarayıcı verileri silinirse yedek olmadan geri gelmez. Haftada bir yedek alıp
              Drive'a veya e-postanıza kaydedin.
            </p>
          </div>
          <Action icon={<FileSpreadsheet size={22} />} cls="text-paid" title="Excel yedeği indir" text="Özet, her müşteri için ayrı sayfa ve tüm hareketler" onClick={exportXlsx} loading={busy === 'xlsx'} />
          <Action icon={<FileJson size={22} />} cls="text-ink" title="Telefon değiştirme yedeği (.json)" text="Kayıtları başka bir telefona taşımak için" onClick={exportJson} />
          <Action
            icon={<Upload size={22} />}
            cls="text-graphite"
            title="Yedekten geri yükle"
            text="Bu uygulamadan alınmış Excel (.xlsx) veya JSON dosyası"
            onClick={() => fileRef.current?.click()}
            loading={busy === 'import'}
          />
          {snap && snap.data.customers.length > 0 && (
            <Action
              icon={<RotateCcw size={22} />}
              cls="text-advance"
              title="Son toplu değişikliği geri al"
              text={`${snap.reason} öncesine dön (${fmtDateTime(snap.at)}): ${snap.data.customers.length} müşteri, ${snap.data.jobs.length} iş, ${snap.data.payments.length} ödeme`}
              onClick={() => setDialog({ kind: 'undo' })}
            />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </Ledger>

      {/* Hazır işler */}
      <SectionTitle>Hazır işler</SectionTitle>
      <Templates />

      {/* Kurlar */}
      <SectionTitle>Döviz kurları</SectionTitle>
      <div className="rounded-[10px] border border-line bg-paper p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="1 dolar ($) kaç TL">
            <Input className="num" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} />
          </Field>
          <Field label="1 euro (€) kaç TL">
            <Input className="num" inputMode="decimal" value={eur} onChange={(e) => setEur(e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-[14px] text-pencil">
          Bu kurlar yalnızca dövizli borçların bugünkü TL karşılığını göstermek için kullanılır. Alınan ödemeler, girildiği gün yazılan kurla sabit kalır; burada
          kur değişince geçmiş ödemeler değişmez.
        </p>
        <p className="mt-1 text-[13px] text-faint">
          Kaynak: {data.settings.ratesSource ?? 'Elle girildi'}
          {data.settings.ratesUpdatedAt && `, ${fmtDateTime(data.settings.ratesUpdatedAt)}`}
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={saveRates}>
            Kurları kaydet
          </Button>
          <Button
            onClick={async () => {
              const ok = await refreshRates();
              toast(ok ? 'Kurlar güncellendi' : 'Kur alınamadı. İnternet bağlantınızı kontrol edin.', ok ? 'ok' : 'err');
            }}
            disabled={ratesLoading}
          >
            {ratesLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} İnternetten al
          </Button>
        </div>
      </div>

      {installEvt && (
        <>
          <SectionTitle>Telefona kur</SectionTitle>
          <Ledger>
            <div className="rows">
              <Action
                icon={<Smartphone size={22} />}
                cls="text-ink"
                title="Ana ekrana ekle"
                text="Uygulama gibi tam ekran açılır, internetsiz çalışır"
                onClick={async () => {
                  installEvt.prompt();
                  await installEvt.userChoice;
                  setInstallEvt(null);
                }}
              />
            </div>
          </Ledger>
        </>
      )}

      {/* Veri */}
      <SectionTitle>Kayıtlar</SectionTitle>
      <Ledger>
        <div className="rows">
          <div className="flex items-start gap-3 px-3 py-3">
            {persisted ? <ShieldCheck size={22} className="mt-0.5 shrink-0 text-paid" /> : <ShieldAlert size={22} className="mt-0.5 shrink-0 text-due" />}
            <div>
              <div className="text-[16px] font-semibold text-graphite">{persisted ? 'Kalıcı depolama açık' : 'Kalıcı depolama izni verilmedi'}</div>
              <p className="text-[14px] text-pencil">
                {persisted
                  ? 'Tarayıcı, yer açmak için bu kayıtları kendiliğinden silmez.'
                  : 'Tarayıcı uzun süre kullanılmayan verileri silebilir. Uygulamayı ana ekrana ekleyin ve düzenli yedek alın.'}
              </p>
              <p className="num mt-1 text-[14px] text-faint">
                {data.customers.length} müşteri, {data.jobs.length} iş, {data.payments.length} ödeme kayıtlı
              </p>
            </div>
          </div>
          <Action icon={<Trash2 size={22} />} cls="text-due" title="Tüm kayıtları sil" text="Boş bir defterle baştan başla" onClick={() => setDialog({ kind: 'wipe' })} />
        </div>
      </Ledger>

      {/* Pencereler */}
      {dialog?.kind === 'issues' && (
        <Sheet
          open
          onClose={() => setDialog(null)}
          title="Yedek yüklenmedi"
          footer={
            <Button className="w-full" onClick={() => setDialog(null)}>
              Tamam
            </Button>
          }
        >
          <p className="text-[16px] text-graphite">
            “{dialog.fileName}” dosyasında sorunlu kayıtlar var. Eksik yükleme yapıp kayıt kaybetmemek için dosya hiç yüklenmedi; mevcut defteriniz değişmedi.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] text-pencil">
            {dialog.issues.slice(0, 12).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
            {dialog.issues.length > 12 && <li>ve {dialog.issues.length - 12} sorun daha</li>}
          </ul>
        </Sheet>
      )}
      {dialog?.kind === 'import' && (
        <ConfirmSheet
          title="Yedek yüklensin mi?"
          confirmLabel="Yedeği yükle"
          message={
            <>
              <p>
                “{dialog.fileName}” içinde <b>{dialog.next.customers.length} müşteri, {dialog.next.jobs.length} iş, {dialog.next.payments.length} ödeme</b> var.
              </p>
              {hasData && (
                <p className="mt-2">
                  Şu anki defterinizdeki {data.customers.length} müşteri, {data.jobs.length} iş ve {data.payments.length} ödemenin <b>yerine geçecek</b>. Şu anki
                  hâl saklanır; isterseniz bu sayfadan geri alabilirsiniz.
                </p>
              )}
            </>
          }
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            const next = dialog.next;
            setDialog(null);
            const ok = await replaceAll({ ...next, settings: { ...next.settings, lastBackupAt: next.settings.lastBackupAt ?? data.settings.lastBackupAt } }, 'Yedek yükleme');
            toast(ok ? 'Yedek yüklendi' : 'Geri dönüş noktası kaydedilemediği için yedek yüklenmedi. Telefonun hafızası dolu olabilir.', ok ? 'ok' : 'err');
          }}
        />
      )}
      {dialog?.kind === 'wipe' && (
        <ConfirmSheet
          title="Tüm kayıtlar silinsin mi?"
          confirmLabel="Hepsini sil"
          danger
          message={
            <>
              <p>
                {data.customers.length} müşteri, {data.jobs.length} iş ve {data.payments.length} ödeme silinecek.
              </p>
              <p className="mt-2 text-pencil">Silmeden önce mevcut hâl saklanır; bu sayfadaki “Son toplu değişikliği geri al” ile geri getirebilirsiniz.</p>
            </>
          }
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            const ok = await replaceAll({ ...emptyData(), settings: data.settings }, 'Tüm kayıtları silme');
            toast(ok ? 'Tüm kayıtlar silindi' : 'Geri dönüş noktası kaydedilemediği için hiçbir şey silinmedi.', ok ? 'ok' : 'err');
          }}
        />
      )}
      {dialog?.kind === 'undo' && snap && (
        <ConfirmSheet
          title="Geri alınsın mı?"
          confirmLabel="Geri al"
          message={
            <p>
              Defter, {fmtDateTime(snap.at)} tarihindeki hâline döner ({snap.data.customers.length} müşteri, {snap.data.jobs.length} iş, {snap.data.payments.length}{' '}
              ödeme). O tarihten sonra girdiğiniz kayıtlar bu hâlde yoktur.
            </p>
          }
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            toast((await restoreSnapshot()) ? 'Geri alındı' : 'Geri dönüş noktası bulunamadı', 'ok');
          }}
        />
      )}
    </div>
  );
}

function Action({ icon, cls, title, text, onClick, loading }: { icon: ReactNode; cls: string; title: string; text: string; onClick: () => void; loading?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ink-soft/40 active:bg-ink-soft disabled:opacity-60">
      <span className={cx('shrink-0', cls)}>{loading ? <Loader2 size={22} className="animate-spin" /> : icon}</span>
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold text-graphite">{title}</span>
        <span className="block text-[14px] text-pencil">{text}</span>
      </span>
    </button>
  );
}

/** Sık yapılan işler: iş eklerken tek dokunuşla ad ve tutar dolar */
function Templates() {
  const { data, dispatch } = useStore();
  const { toast } = useUI();
  const list = data.settings.templates ?? [];
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const amt = parseNum(amount);
  const ok = title.trim() && amt > 0;
  const frequent = jobSuggestions(data, undefined, 12).filter((s) => !s.saved).slice(0, 5);

  const save = (next: typeof list) => dispatch({ type: 'setTemplates', templates: next });
  const add = () => {
    if (!ok) return;
    save([...list, newTemplate(title, round2(amt), currency)]);
    setTitle('');
    setAmount('');
    toast('Hazır iş eklendi');
  };

  return (
    <Ledger>
      <div className="rows">
        <p className="px-3 py-3 text-[14px] text-pencil">İş eklerken bu listeden seçince iş adı ve tutar kendiliğinden dolar. Tutarı yine değiştirebilirsiniz.</p>
        {list.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-graphite">{t.title}</span>
            <span className="figure text-[17px] font-semibold text-graphite">{fmt(t.amount, t.currency)}</span>
            <button
              type="button"
              aria-label={`${t.title} hazır işini sil`}
              onClick={() => {
                save(list.filter((x) => x.id !== t.id));
                toast('Hazır iş silindi', 'ok', { label: 'Geri al', run: () => save(list) });
              }}
              className="grid h-11 w-11 place-items-center rounded-lg text-faint hover:bg-due-soft hover:text-due"
            >
              <X size={18} />
            </button>
          </div>
        ))}
        <div className="space-y-2 px-3 py-3">
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Yeni hazır iş, örn. Tek piston pano + devreye alma" />
          <div className="flex gap-2">
            <Input className="figure flex-1 text-[18px]" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Tutar" />
            <Segmented value={currency} onChange={setCurrency} label="Para birimi" options={CURRENCIES.map((c) => ({ value: c, label: SYMBOL[c] }))} className="w-36" />
          </div>
          <Button variant="primary" className="w-full" onClick={add} disabled={!ok}>
            <Plus size={18} /> Hazır işi ekle
          </Button>
        </div>
        {frequent.length > 0 && (
          <div className="px-3 py-3">
            <div className="mb-1.5 text-[14px] font-semibold text-pencil">Sık yazdığınız işler (eklemek için dokunun)</div>
            <div className="flex flex-wrap gap-2">
              {frequent.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => {
                    save([...list, newTemplate(s.title, s.amount, s.currency)]);
                    toast(`Eklendi: ${s.title}`);
                  }}
                  className="min-h-11 rounded-lg border border-line px-3 text-left text-[14px] hover:border-ink"
                >
                  <span className="font-semibold text-graphite">+ {s.title}</span> <span className="figure text-pencil">{fmt(s.amount, s.currency)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Ledger>
  );
}
