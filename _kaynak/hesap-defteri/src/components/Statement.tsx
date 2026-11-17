import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileImage, FileText, Loader2, MessageCircle, Printer } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useUI } from '../ui-context';
import { buildStatement, periodStart, statementText } from '../lib/statement';
import type { Period, Statement } from '../lib/statement';
import { fmt, fmtDate, fmtRate, today } from '../lib/format';
import { EPS } from '../lib/money';
import type { Business, Currency } from '../types';
import { Button, Field, Input, Segmented, Sheet } from './ui';

const CUR_NAME: Record<Currency, string> = { TRY: 'Türk lirası hesabı', USD: 'Dolar hesabı', EUR: 'Euro hesabı' };
const DOC_W = 794; // A4 genişliği (96 dpi)

/* ------------------------------------------------------------------ */
/* Belge                                                               */
/* ------------------------------------------------------------------ */

export const StatementDoc = forwardRef<HTMLDivElement, { st: Statement; business: Business; showTRY: boolean; rates: { USD: number; EUR: number } }>(
  function StatementDoc({ st, business, showTRY, rates }, ref) {
    const open = st.sections.filter((s) => Math.abs(s.closing) > EPS);
    return (
      <div ref={ref} className="statement-doc bg-white text-[#1c1f24]" style={{ width: DOC_W, padding: '44px 48px 40px', fontFamily: 'Barlow, sans-serif' }}>
        {/* Başlık */}
        <div data-row className="flex items-start justify-between gap-6 border-b-2 border-[#1f3a93] pb-4">
          <div>
            <div className="text-[24px] font-bold leading-tight text-[#1f3a93]">{business.name || 'İşletme adı'}</div>
            {business.phone && <div className="text-[14px] text-[#5f6673]">{business.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold leading-tight">Cari hesap özeti</div>
            <div className="text-[14px] text-[#5f6673]">Tarih: {fmtDate(st.date)}</div>
          </div>
        </div>

        {/* Müşteri ve kalan */}
        <div data-row className="mt-5 flex items-end justify-between gap-6">
          <div>
            <div className="text-[13px] text-[#5f6673]">Sayın</div>
            <div className="text-[22px] font-bold leading-tight">{st.customerName}</div>
            <div className="mt-1 text-[14px] text-[#5f6673]">
              {st.from ? `${fmtDate(st.from)} ile ${fmtDate(st.date)} arasındaki hareketler` : `${fmtDate(st.date)} tarihine kadar tüm hareketler`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[14px] font-semibold text-[#5f6673]">Kalan bakiye</div>
            {open.length ? (
              open.map((s) => (
                <div key={s.currency} className="figure text-[30px] font-bold leading-tight text-[#b42318]" style={{ borderBottom: '3px double #b42318' }}>
                  {fmt(s.closing, s.currency)}
                </div>
              ))
            ) : (
              <div className="figure text-[30px] font-bold leading-tight text-[#17734a]">Borç yok</div>
            )}
            {showTRY && st.hasForeign && (
              <div className="mt-1 text-[13px] text-[#5f6673]">
                Bugünkü kurla toplam {fmt(Math.round(st.closingTRY), 'TRY')}
                <br />
                ($1 = ₺{fmtRate(rates.USD)}, €1 = ₺{fmtRate(rates.EUR)})
              </div>
            )}
          </div>
        </div>

        {/* Döviz bazında hareketler */}
        {st.sections.map((s) => (
          <div key={s.currency} className="mt-7">
            {st.sections.length > 1 && (
              <div data-row className="mb-1 text-[16px] font-bold text-[#1f3a93]">
                {CUR_NAME[s.currency]}
              </div>
            )}
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr data-row className="border-b border-[#1c1f24] text-left text-[12.5px] text-[#5f6673]">
                  <th className="w-[84px] py-1.5 font-semibold">Tarih</th>
                  <th className="py-1.5 font-semibold">Açıklama</th>
                  <th className="w-[108px] py-1.5 text-right font-semibold">Borç</th>
                  <th className="w-[108px] py-1.5 text-right font-semibold">Ödeme</th>
                  <th className="w-[118px] py-1.5 text-right font-semibold">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {st.from && (
                  <tr data-row className="border-b border-[#d3deee]">
                    <td className="num py-1.5 align-top">{fmtDate(st.from)}</td>
                    <td className="py-1.5 font-semibold">Devreden bakiye</td>
                    <td />
                    <td />
                    <td className="num py-1.5 text-right align-top font-semibold">{fmt(s.opening, s.currency)}</td>
                  </tr>
                )}
                {s.rows.map((r, i) => (
                  <tr data-row key={i} className="border-b border-[#d3deee]">
                    <td className="num py-1.5 align-top">{fmtDate(r.date)}</td>
                    <td className="py-1.5 pr-3 align-top">
                      <div>{r.text}</div>
                      {r.sub && <div className="text-[12px] text-[#5f6673]">{r.sub}</div>}
                    </td>
                    <td className="num py-1.5 text-right align-top">{r.debit ? fmt(r.debit, s.currency) : ''}</td>
                    <td className="num py-1.5 text-right align-top text-[#17734a]">{r.credit ? fmt(r.credit, s.currency) : ''}</td>
                    <td className="num py-1.5 text-right align-top">{fmt(r.balance, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr data-row className="border-t-2 border-[#1c1f24] font-bold">
                  <td className="py-2" />
                  <td className="py-2">Toplam</td>
                  <td className="num py-2 text-right">{fmt(s.debit, s.currency)}</td>
                  <td className="num py-2 text-right text-[#17734a]">{fmt(s.credit, s.currency)}</td>
                  <td className={`num py-2 text-right ${Math.abs(s.closing) > EPS ? 'text-[#b42318]' : 'text-[#17734a]'}`}>
                    <span style={{ borderBottom: '3px double currentColor' }}>{fmt(s.closing, s.currency)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

        {/* Alt bilgi */}
        <div data-row className="mt-8 border-t border-[#d8dde6] pt-3 text-[13px] text-[#5f6673]">
          {business.iban && (
            <div className="mb-1 text-[14px] text-[#1c1f24]">
              Ödeme için IBAN: <b className="num">{business.iban}</b>
              {business.name ? ` (${business.name})` : ''}
            </div>
          )}
          Bu özet {fmtDate(st.date)} tarihinde hazırlanmıştır. Kayıtlarınızla farklılık görürseniz lütfen bildiriniz.
        </div>
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/* Dışa aktarma yardımcıları                                           */
/* ------------------------------------------------------------------ */

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

async function renderCanvas(node: HTMLElement) {
  const { toCanvas } = await import('html-to-image');
  await document.fonts?.ready;
  return toCanvas(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
}

/** Satırları ortadan bölmeden A4 sayfalara ayırır */
async function makePdf(node: HTMLElement): Promise<Blob> {
  const canvas = await renderCanvas(node);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const scale = canvas.width / node.offsetWidth; // css px → canvas px
  const TOP = 28; // devam sayfalarında üst boşluk (pt)
  const BOTTOM = 34; // sayfa numarası için alt boşluk (pt)
  const cssPerPt = node.offsetWidth / pageW;
  const pageCssH = (pageH - BOTTOM) * cssPerPt; // ilk sayfaya sığan css yüksekliği

  // Satır sonlarını topla (bölme noktaları)
  // Önizleme küçültülmüş olabilir: ekran ölçülerini belgenin kendi ölçüsüne çevir
  const box = node.getBoundingClientRect();
  const ratio = box.width / node.offsetWidth || 1;
  const ends = Array.from(node.querySelectorAll<HTMLElement>('[data-row]'))
    .map((el) => (el.getBoundingClientRect().bottom - box.top) / ratio)
    .sort((a, b) => a - b);
  const total = node.offsetHeight;
  const breaks: number[] = [0];
  let start = 0;
  while (total - start > (breaks.length === 1 ? pageCssH : pageCssH - TOP * cssPerPt)) {
    const limit = start + (breaks.length === 1 ? pageCssH : pageCssH - TOP * cssPerPt);
    const cut = ends.filter((e) => e > start + 40 && e <= limit).pop() ?? limit;
    breaks.push(cut);
    start = cut;
  }
  breaks.push(total);

  for (let i = 0; i < breaks.length - 1; i++) {
    const y0 = breaks[i];
    const h = breaks[i + 1] - y0;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    const offset = i > 0 ? Math.ceil(TOP * cssPerPt * scale) : 0; // devam sayfalarında üst boşluk
    slice.height = Math.ceil(h * scale) + offset;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, Math.floor(y0 * scale), canvas.width, Math.ceil(h * scale), 0, offset, canvas.width, Math.ceil(h * scale));
    if (i > 0) pdf.addPage();
    const imgH = (slice.height / slice.width) * pageW;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, imgH);
    if (breaks.length > 2) {
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`${i + 1} / ${breaks.length - 1}`, pageW - 40, pageH - 16);
    }
  }
  return pdf.output('blob');
}

async function makePng(node: HTMLElement): Promise<Blob> {
  const canvas = await renderCanvas(node);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Resim oluşturulamadı'))), 'image/png'));
}

function download(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Telefonun paylaş menüsü (WhatsApp, e-posta…); desteklenmiyorsa dosyayı indirir */
async function shareFile(file: File, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  download(file);
  return 'downloaded';
}

/** Türkiye cep numarasını wa.me biçimine çevirir: 0532… → 90532… */
function waNumber(phone?: string) {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = `90${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith('5')) d = `90${d}`;
  return d.length >= 11 ? d : '';
}

/* ------------------------------------------------------------------ */
/* Paylaşma ekranı                                                     */
/* ------------------------------------------------------------------ */

export function StatementSheet({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const { toast } = useUI();
  const customer = data.customers.find((c) => c.id === customerId);
  const [period, setPeriod] = useState<Period>('all');
  const [custom, setCustom] = useState(`${today().slice(0, 4)}-01-01`);
  const [showTRY, setShowTRY] = useState(false);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState<'' | 'pdf' | 'png'>('');
  const biz = data.settings.business ?? {};
  const [editBiz, setEditBiz] = useState(!biz.name);
  const [bizDraft, setBizDraft] = useState<Business>(biz);
  const docRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [docH, setDocH] = useState(1100);
  const [printing, setPrinting] = useState(false);

  const st = useMemo(() => buildStatement(data, customerId, periodStart(period, custom, today()), today(), { notes }), [data, customerId, period, custom, notes]);
  const business = editBiz ? bizDraft : biz;

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      setScale(el.clientWidth / DOC_W);
      if (docRef.current) setDocH(docRef.current.offsetHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (docRef.current) ro.observe(docRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const saveBiz = () => {
    const clean: Business = { name: bizDraft.name?.trim() || undefined, phone: bizDraft.phone?.trim() || undefined, iban: bizDraft.iban?.replace(/\s+/g, ' ').trim().toUpperCase() || undefined };
    dispatch({ type: 'setBusiness', business: clean });
    setBizDraft(clean);
    setEditBiz(false);
  };

  const baseName = `Cari-ozeti-${safeName(customer?.name ?? 'musteri')}-${fmtDate(today()).replace(/\./g, '-')}`;

  const exportAs = async (kind: 'pdf' | 'png') => {
    if (!docRef.current) return;
    if (editBiz) saveBiz();
    setBusy(kind);
    try {
      const blob = kind === 'pdf' ? await makePdf(docRef.current) : await makePng(docRef.current);
      const file = new File([blob], `${baseName}.${kind}`, { type: kind === 'pdf' ? 'application/pdf' : 'image/png' });
      const r = await shareFile(file, `${customer?.name} cari hesap özeti`);
      if (r === 'downloaded') toast(kind === 'pdf' ? 'PDF indirildi' : 'Resim indirildi');
    } catch (e) {
      toast(`Hazırlanamadı: ${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setBusy('');
    }
  };

  const text = statementText(st, business, { showTRY, rates: data.settings.rates });
  const shareText = async () => {
    if (editBiz) saveBiz();
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const wa = waNumber(customer?.phone);
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!customer) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cari özeti"
      footer={
        <div className="space-y-2">
          <Button variant="primary" className="w-full text-[16px]" onClick={() => exportAs('pdf')} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />} PDF olarak gönder
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => exportAs('png')} disabled={!!busy} className="px-2 text-[14px]">
              {busy === 'png' ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />} Resim
            </Button>
            <Button onClick={shareText} className="px-2 text-[14px]">
              <MessageCircle size={16} /> Mesaj
            </Button>
            <Button
              onClick={() => {
                if (editBiz) saveBiz();
                setPrinting(true);
              }}
              className="px-2 text-[14px]"
            >
              <Printer size={16} /> Yazdır
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Hangi hareketler">
          <Segmented
            value={period}
            onChange={setPeriod}
            label="Dönem"
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'year', label: 'Bu yıl' },
              { value: 'q', label: 'Son 3 ay' },
              { value: 'custom', label: 'Tarihten' },
            ]}
          />
        </Field>
        {period === 'custom' && (
          <Field label="Başlangıç tarihi" hint="Bu tarihten önceki hareketler “Devreden bakiye” satırında toplanır.">
            <Input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-44" />
          </Field>
        )}
        {st.sections.some((x) => x.currency !== 'TRY') && (
          <label className="flex min-h-11 items-center gap-3 text-[15px] text-graphite">
            <input type="checkbox" checked={showTRY} onChange={(e) => setShowTRY(e.target.checked)} className="h-5 w-5 accent-[#1f3a93]" />
            Dövizli bakiyenin bugünkü kurla TL karşılığını da yaz
          </label>
        )}

        <label className="flex min-h-11 items-center gap-3 text-[15px] text-graphite">
          <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} className="h-5 w-5 accent-[#1f3a93]" />
          Kendi notlarımı da göster (dekont no, açıklama vb.)
        </label>

        {/* İşletme bilgileri */}
        {editBiz ? (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[15px] font-semibold text-graphite">Özetin üstünde görünecek bilgileriniz</div>
            <div className="space-y-3">
              <Field label="Adınız veya firma adı">
                <Input value={bizDraft.name ?? ''} maxLength={80} onChange={(e) => setBizDraft({ ...bizDraft, name: e.target.value })} placeholder="Örn. Harun Çiçek Mühendislik" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Telefon (isteğe bağlı)">
                  <Input type="tel" value={bizDraft.phone ?? ''} maxLength={30} onChange={(e) => setBizDraft({ ...bizDraft, phone: e.target.value })} />
                </Field>
                <Field label="IBAN (isteğe bağlı)">
                  <Input value={bizDraft.iban ?? ''} maxLength={40} onChange={(e) => setBizDraft({ ...bizDraft, iban: e.target.value })} placeholder="TR.." className="num" />
                </Field>
              </div>
              <Button variant="secondary" className="min-h-10" onClick={saveBiz}>
                Bilgilerimi kaydet
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setEditBiz(true)} className="min-h-10 text-[14px] font-semibold text-ink">
            Özetteki bilgilerimi düzenle
          </button>
        )}

        {/* Önizleme */}
        <div>
          <div className="mb-1 text-[14px] font-semibold text-pencil">Önizleme</div>
          <div ref={boxRef} className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
            <div style={{ height: docH * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: DOC_W }}>
                <StatementDoc ref={docRef} st={st} business={business} showTRY={showTRY} rates={data.settings.rates} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {printing &&
        createPortal(
          <div className="print-root">
            <StatementDoc st={st} business={business} showTRY={showTRY} rates={data.settings.rates} />
          </div>,
          document.body,
        )}
    </Sheet>
  );
}

