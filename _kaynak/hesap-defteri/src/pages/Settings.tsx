import { useEffect, useRef, useState } from 'react';
import { Database, Download, FileJson, FileSpreadsheet, Loader2, RefreshCw, Smartphone, Trash2, Upload } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { fmtRate, parseNum } from '../lib/format';
import { emptyData } from '../lib/seed';
import { storage } from '../services/storage';
import { Button, Card, Field, Input, SectionTitle } from '../components/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InstallEvent = any;

export function Settings() {
  const { data, dispatch, refreshRates, ratesLoading } = useStore();
  const { toast } = useUI();
  const [usd, setUsd] = useState(fmtRate(data.settings.rates.USD));
  const [eur, setEur] = useState(fmtRate(data.settings.rates.EUR));
  const [busy, setBusy] = useState<'' | 'xlsx' | 'import'>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [installEvt, setInstallEvt] = useState<InstallEvent>(null);

  useEffect(() => {
    setUsd(fmtRate(data.settings.rates.USD));
    setEur(fmtRate(data.settings.rates.EUR));
  }, [data.settings.rates]);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const saveRates = () => {
    const U = parseNum(usd);
    const E = parseNum(eur);
    if (!(U > 0 && E > 0)) return toast('Geçerli kur girin', 'err');
    dispatch({ type: 'setRates', rates: { USD: U, EUR: E }, source: 'Manuel' });
    toast('Kurlar kaydedildi');
  };

  const exportXlsx = async () => {
    setBusy('xlsx');
    try {
      const { exportWorkbook } = await import('../services/excel');
      exportWorkbook(data);
      toast('Excel dosyası indirildi');
    } catch (e) {
      toast(`Dışa aktarılamadı: ${(e as Error).message}`, 'err');
    } finally {
      setBusy('');
    }
  };

  const exportJson = async () => {
    const { exportJSON } = await import('../services/excel');
    exportJSON(data);
    toast('JSON yedeği indirildi');
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    setBusy('import');
    try {
      const { importFile } = await import('../services/excel');
      const next = await importFile(f);
      if (!confirm(`Yedekte ${next.customers.length} müşteri, ${next.jobs.length} iş, ${next.payments.length} ödeme var.\nMevcut verilerin YERİNE geçsin mi?`)) return;
      dispatch({ type: 'replace', data: next });
      toast('Yedek geri yüklendi');
    } catch (e) {
      toast((e as Error).message || 'Dosya okunamadı', 'err');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Ayarlar</h1>

      <SectionTitle>Güncel Döviz Kurları</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="1 USD ($) = ₺">
            <Input className="num" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} />
          </Field>
          <Field label="1 EUR (€) = ₺">
            <Input className="num" inputMode="decimal" value={eur} onChange={(e) => setEur(e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Kaynak: {data.settings.ratesSource ?? '—'}
          {data.settings.ratesUpdatedAt && ` · ${new Date(data.settings.ratesUpdatedAt).toLocaleString('tr-TR')}`}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Bu kurlar özet ekranındaki TL karşılıkları içindir. Ödemelerdeki mahsuplar, kayıt anında girilen işlem kuruyla sabitlenir.
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={saveRates}>
            Kaydet
          </Button>
          <Button
            onClick={async () => { const ok = await refreshRates(); toast(ok ? 'Kurlar güncellendi' : 'Kur alınamadı', ok ? 'ok' : 'err'); }}
            disabled={ratesLoading}
          >
            {ratesLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Piyasadan Çek
          </Button>
        </div>
      </Card>

      <SectionTitle>Yedekleme & Excel</SectionTitle>
      <Card className="divide-y divide-white/5">
        <Action icon={<FileSpreadsheet size={20} />} tone="text-emerald-300 bg-emerald-400/10" title="Excel'e Aktar (.xlsx)" text="Genel Özet + her müşteri için ayrı sekme + Hareketler" onClick={exportXlsx} loading={busy === 'xlsx'} />
        <Action icon={<FileJson size={20} />} tone="text-sky-300 bg-sky-400/10" title="JSON Yedeği İndir" text="Tam yedek; başka cihaza taşımak için" onClick={exportJson} />
        <Action icon={<Upload size={20} />} tone="text-amber-300 bg-amber-400/10" title="Yedekten Geri Yükle" text="Bu uygulamadan alınmış .xlsx veya .json dosyası" onClick={() => fileRef.current?.click()} loading={busy === 'import'} />
        <input ref={fileRef} type="file" accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </Card>

      {installEvt && (
        <>
          <SectionTitle>Uygulama</SectionTitle>
          <Card className="divide-y divide-white/5">
            <Action
              icon={<Smartphone size={20} />}
              tone="text-zinc-200 bg-white/5"
              title="Ana Ekrana Yükle"
              text="Tam ekran, çevrimdışı çalışan uygulama olarak kur"
              onClick={async () => {
                installEvt.prompt();
                await installEvt.userChoice;
                setInstallEvt(null);
              }}
            />
          </Card>
        </>
      )}

      <SectionTitle>Veri</SectionTitle>
      <Card className="divide-y divide-white/5">
        <div className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-400">
          <Database size={18} className="text-zinc-500" />
          <span className="flex-1">
            Depolama: <span className="text-zinc-200">{storage.name}</span>
          </span>
          <span className="num text-xs text-zinc-500">
            {data.customers.length} müşteri · {data.jobs.length} iş · {data.payments.length} ödeme
          </span>
        </div>
        <Action
          icon={<Trash2 size={20} />}
          tone="text-rose-300 bg-rose-400/10"
          title="Tüm Verileri Sil"
          text="Boş bir hesap defteriyle başla"
          onClick={() => {
            if (confirm('TÜM müşteri, iş ve ödeme kayıtları silinecek. Bu işlem geri alınamaz. Devam edilsin mi?')) {
              dispatch({ type: 'replace', data: { ...emptyData(), settings: data.settings } });
              toast('Tüm veriler silindi');
            }
          }}
        />
      </Card>
      <p className="mt-6 text-center text-xs text-zinc-600">
        <Download size={12} className="mr-1 inline" />
        Veriler yalnızca bu cihazda saklanır. Düzenli Excel/JSON yedeği almanız önerilir.
      </p>
    </div>
  );
}

function Action({ icon, tone, title, text, onClick, loading }: { icon: React.ReactNode; tone: string; title: string; text: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] disabled:opacity-60">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>{loading ? <Loader2 size={18} className="animate-spin" /> : icon}</div>
      <div className="min-w-0">
        <div className="font-medium text-zinc-100">{title}</div>
        <div className="text-xs text-zinc-500">{text}</div>
      </div>
    </button>
  );
}
