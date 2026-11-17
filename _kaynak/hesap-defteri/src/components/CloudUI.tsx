import { useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useStore, dataCounts } from '../store/AppStore';
import { ConfirmEmail } from '../services/cloud';
import { useUI } from '../ui-context';
import { Button, Field, Input, Ledger, Segmented, Sheet, cx } from './ui';

const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Üst çubuktaki küçük eşitleme durumu */
export function CloudBadge() {
  const { cloud } = useStore();
  const { go } = useUI();
  if (!cloud.configured || cloud.status === 'off') return null;
  if (cloud.status === 'needs-auth')
    return (
      <button type="button" onClick={() => go({ tab: 'settings' })} className="inline-flex min-h-9 items-center gap-1 rounded-md bg-ink px-2 text-[13px] font-semibold text-white">
        <Cloud size={14} /> Buluta giriş yapın
      </button>
    );
  const label =
    cloud.status === 'syncing' ? 'Eşitleniyor' : cloud.status === 'offline' ? 'İnternet yok' : cloud.status === 'error' ? 'Eşitlenemedi' : cloud.status === 'choose' ? 'Seçim bekliyor' : 'Bulutta';
  return (
    <span className={cx('inline-flex items-center gap-1 text-[13px]', cloud.status === 'error' ? 'font-semibold text-due' : 'text-pencil')}>
      {cloud.status === 'syncing' ? <Loader2 size={13} className="animate-spin" /> : cloud.status === 'offline' || cloud.status === 'error' ? <CloudOff size={13} /> : <Cloud size={13} className="text-paid" />}
      {label}
    </span>
  );
}

/** Ayarlar sayfasındaki bölüm */
export function CloudSettings() {
  const { cloud, cloudConnect, cloudSyncNow, cloudDisconnect } = useStore();
  const { toast } = useUI();
  const [askOff, setAskOff] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState(cloud.email ?? '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cloud.configured) return null;

  const loggedOut = cloud.status === 'off' || cloud.status === 'needs-auth';
  const pwOk = pw.length >= 8;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = async () => {
    if (!pwOk || !emailOk) return;
    setBusy(true);
    try {
      await cloudConnect(email, pw, mode);
      setPw('');
      toast('Buluta bağlandı');
    } catch (e) {
      if (e instanceof ConfirmEmail) {
        setMode('signin');
        setPw('');
      } else toast(e instanceof Error ? e.message : 'Bağlanılamadı', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 className="mb-2 mt-7 px-1 text-[17px] font-bold text-graphite">Bulut eşitleme</h3>
      <Ledger>
        <div className="rows">
          {loggedOut ? (
            <div className="space-y-3 px-3 py-3">
              <p className="text-[15px] text-graphite">
                Telefon, tablet ve bilgisayarda aynı e-posta ve şifreyle giriş yapınca hepsi aynı defteri görür. Telefon kaybolsa da kayıtlar bulutta kalır.
              </p>
              {cloud.status === 'needs-auth' && <p className="text-[14px] font-semibold text-due">Oturum kapandı; eşitlemek için yeniden giriş yapın. Kayıtlarınız bu cihazda güvende.</p>}
              <Segmented
                value={mode}
                onChange={setMode}
                label="Giriş türü"
                options={[
                  { value: 'signup', label: 'İlk kez: hesap aç' },
                  { value: 'signin', label: 'Giriş yap' },
                ]}
              />
              <Field label="E-posta">
                <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@gmail.com" />
              </Field>
              <Field label="Şifre" hint={mode === 'signup' ? 'En az 8 karakter. Diğer cihazlarda bu şifreyle gireceksiniz; unutmayacağınız bir yere not edin.' : undefined}>
                <Input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
              </Field>
              <Button variant="primary" className="w-full" onClick={submit} disabled={busy || !pwOk || !emailOk}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />} {mode === 'signup' ? 'Hesap aç ve bağlan' : 'Giriş yap ve bağlan'}
              </Button>
              {cloud.error && (
                <p className={cx('rounded-lg px-3 py-2 text-[15px] font-semibold', /onay|Confirm/.test(cloud.error) ? 'bg-ink-soft text-ink' : 'bg-due-soft text-due')}>{cloud.error}</p>
              )}
            </div>
          ) : (
            <>
              <div className="px-3 py-3">
                <div className="flex items-center gap-2 text-[16px] font-semibold text-graphite">
                  <Cloud size={18} className="text-paid" /> Buluta bağlı
                </div>
                <div className="text-[14px] text-pencil">{cloud.email}</div>
                <div className="mt-1 text-[14px] text-pencil">
                  {cloud.status === 'syncing'
                    ? 'Eşitleniyor…'
                    : cloud.status === 'offline'
                      ? 'İnternet yok. Değişiklikler bağlantı gelince gönderilecek.'
                      : cloud.status === 'error'
                        ? `Eşitlenemedi: ${cloud.error}`
                        : `Son eşitleme ${hhmm(cloud.lastSyncAt)}`}
                </div>
              </div>
              <div className="flex gap-2 px-3 py-3">
                <Button className="flex-1" onClick={() => void cloudSyncNow()} disabled={cloud.status === 'syncing'}>
                  <RefreshCw size={16} /> Şimdi eşitle
                </Button>
                <Button variant="ghost" onClick={() => setAskOff(true)}>
                  Çıkış yap
                </Button>
              </div>
            </>
          )}
        </div>
        {askOff && (
          <Sheet
            open
            onClose={() => setAskOff(false)}
            title="Buluttan çıkış yapılsın mı?"
            footer={
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setAskOff(false)}>
                  Vazgeç
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    cloudDisconnect();
                    setAskOff(false);
                    toast('Buluttan çıkış yapıldı');
                  }}
                >
                  Çıkış yap
                </Button>
              </div>
            }
          >
            <p className="text-[16px]">Bu cihazdaki kayıtlar silinmez, buluttaki defter de yerinde kalır. Bu cihazda yapılan değişiklikler artık buluta gönderilmez.</p>
          </Sheet>
        )}
      </Ledger>
    </>
  );
}

/** İlk bağlantıda iki tarafta farklı defter varsa */
export function CloudChoiceSheet() {
  const { cloud, cloudChoose, data } = useStore();
  if (cloud.status !== 'choose' || !cloud.choice) return null;
  const r = dataCounts(cloud.choice.remote);
  const l = dataCounts(data);
  return (
    <Sheet open onClose={() => undefined} title="Hangi defter kullanılsın?">
      <p className="text-[16px] text-graphite">Bulutta daha önce kaydedilmiş bir defter var ve bu cihazdakinden farklı.</p>
      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => void cloudChoose('remote')} className="w-full rounded-lg border border-line p-3 text-left hover:border-ink">
          <div className="text-[17px] font-bold text-graphite">Buluttaki defteri kullan</div>
          <div className="text-[14px] text-pencil">
            {r.c} müşteri, {r.j} iş, {r.p} ödeme. Son değişiklik {when(cloud.choice.remoteAt)}.
          </div>
          <div className="mt-1 text-[13px] text-faint">Bu cihazdaki defter, Ayarlar’dan geri alınabilecek şekilde saklanır.</div>
        </button>
        <button type="button" onClick={() => void cloudChoose('local')} className="w-full rounded-lg border border-line p-3 text-left hover:border-ink">
          <div className="text-[17px] font-bold text-graphite">Bu cihazdakini buluta yükle</div>
          <div className="text-[14px] text-pencil">
            {l.c} müşteri, {l.j} iş, {l.p} ödeme.
          </div>
          <div className="mt-1 text-[13px] text-faint">Buluttaki eski defter bu cihazda geri alınabilecek şekilde saklanır.</div>
        </button>
      </div>
    </Sheet>
  );
}
