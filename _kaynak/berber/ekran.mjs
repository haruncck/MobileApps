// Berber Randevu — telefon boyutunda tarayıcı turu: davranış denetimleri + ekran görüntüleri.
// Kullanım: PW=/yol/playwright node _kaynak/berber/ekran.mjs <çıktı-klasörü>
// Saat 21 Kasım 2026 Cumartesi 14:25'e sabitlenir. Bir denetim düşerse ya da konsol hatası varsa çıkış kodu 1.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');
const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../berber');
const cikti = path.resolve(process.argv[2] || '/tmp/berber-ekran');
await mkdir(cikti, { recursive: true });

const TUR = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const sunucu = createServer(async (istek, yanit) => {
  let yol = decodeURIComponent(new URL(istek.url, 'http://x').pathname);
  if (yol.endsWith('/')) yol += 'index.html';
  const dosya = path.join(kok, yol);
  if (!dosya.startsWith(kok)) { yanit.writeHead(403).end(); return; }
  let icerik;
  try { icerik = await readFile(dosya); } catch { yanit.writeHead(404).end('yok'); return; }
  yanit.writeHead(200, { 'content-type': TUR[path.extname(dosya)] || 'application/octet-stream' }).end(icerik);
});
await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
const adres = `http://127.0.0.1:${sunucu.address().port}/`;

const hatalar = [], dusen = [];
let gecen = 0;
const denet = (kosul, ad) => { if (kosul) gecen++; else { dusen.push(ad); console.log('DÜŞTÜ:', ad); } };

const tarayici = await chromium.launch({ channel: 'chrome' });
async function ac(tema, depo, sw) {
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: tema, serviceWorkers: sw ? 'allow' : 'block', acceptDownloads: true });
  const s = await baglam.newPage();
  s.on('console', m => { if (m.type() === 'error') hatalar.push(m.text()); });
  s.on('pageerror', e => hatalar.push(String(e)));
  s.on('response', y => { if (y.status() >= 400) hatalar.push(y.status() + ' ' + y.url()); });
  await s.clock.install({ time: new Date('2026-11-21T14:25:00+03:00') });
  if (depo !== undefined) await s.addInitScript(d => { if (!sessionStorage.getItem('ekildi')) { localStorage.setItem('berber-v1', d); sessionStorage.setItem('ekildi', '1'); } }, depo);
  await s.goto(adres);
  await s.waitForSelector('.dilim, .rnd', { timeout: 8000 });
  return { baglam, s };
}
const cek = async (s, ad) => { await s.waitForTimeout(350); await s.screenshot({ path: path.join(cikti, ad + '.png') }); };
const tasmaYok = async (s, ad) => denet(await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), ad + ': yatay taşma yok');
const kayit = s => s.evaluate(() => JSON.parse(localStorage.getItem('berber-v1')));

/* ---------- Task 4: gün ekranı ve randevu formu ---------- */
{
  const { baglam, s } = await ac('light');
  denet((await s.locator('.rnd').count()) >= 9, 'gün: örnek veriyle bugün en az 9 randevu');
  denet(await s.locator('#ornek-serit').isVisible(), 'gün: örnek veri şeridi görünür');
  denet((await s.locator('#baslik-tarih').innerText()).includes('21 Kasım'), 'gün: başlıkta bugünün tarihi');
  denet(await s.locator('.simdi').count() === 1, 'gün: şimdi çizgisi var');
  await tasmaYok(s, 'gün');
  await cek(s, '01-gun-acik');

  // boş dilime dokun → form o saatle açılır → kaydet → listede görünür
  const bos = s.locator('.dilim.bos').last();
  const saat = await bos.getAttribute('data-saat');
  await bos.click();
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-saat').inputValue() === saat, 'form: dokunulan saat seçili gelir');
  await s.fill('#f-ad', '<b>Zeki</b> Deneme');
  await s.locator('.islem-sec').nth(1).click(); // Sakal: 15 dk, her boş dilime sığar
  await cek(s, '02-form-acik');
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)');
  const yeni = s.locator('.rnd', { hasText: 'Zeki' });
  denet(await yeni.count() === 1, 'form: kaydedilen randevu listede');
  denet((await yeni.locator('.rnd-ad').innerText()) === '<b>Zeki</b> Deneme', 'güvenlik: isim düz metin olarak görünür');
  denet(await s.locator('.rnd b').count() === 0, 'güvenlik: isimden HTML öğesi oluşmaz');
  const k1 = (await kayit(s)).randevular.find(r => r.ad.includes('Zeki'));
  denet(k1 && k1.saat === saat && k1.islemAd === 'Sakal' && k1.sure === 15 && k1.fiyat === 150, 'form: işlem adı, süre ve fiyat randevuya kopyalanır');

  // boş isimle kaydedilmez
  await s.click('#fab');
  await s.waitForSelector('#sayfa.acik #f-ad');
  await s.click('#f-kaydet');
  denet(await s.locator('#sayfa.acik').count() === 1 && await s.locator('#f-hata').isVisible(), 'form: isimsiz kaydedilmez, uyarı çıkar');
  // çakışma: dolu saate eklerken uyarır, ikinci dokunuşta kaydeder
  await s.fill('#f-ad', 'Çakışan Müşteri');
  await s.selectOption('#f-saat', saat);
  await s.click('#f-kaydet');
  denet(await s.locator('#f-cakisma').isVisible() && (await s.locator('#f-cakisma').innerText()).includes('Zeki'), 'form: çakışmada kimin olduğu yazılır');
  denet((await s.locator('#f-kaydet').innerText()).includes('Yine de'), 'form: düğme "Yine de kaydet" olur');
  await cek(s, '03-form-cakisma');
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)');
  denet(await s.locator('.rnd', { hasText: 'Çakışan Müşteri' }).count() === 1, 'form: onaylanınca çakışan randevu eklenir');

  // randevuya dokun → ayrıntı → gelmedi işaretle → sil
  await s.locator('.rnd', { hasText: 'Çakışan Müşteri' }).click();
  await s.waitForSelector('#sayfa.acik [data-durum="gelmedi"]');
  await cek(s, '04-ayrinti');
  await s.click('[data-durum="gelmedi"]');
  denet((await kayit(s)).randevular.find(r => r.ad === 'Çakışan Müşteri').durum === 'gelmedi', 'ayrıntı: gelmedi işaretlenir ve kaydedilir');
  await s.click('#a-sil');
  await s.click('#a-sil-evet');
  await s.waitForSelector('#sayfa:not(.acik)');
  denet(!(await kayit(s)).randevular.some(r => r.ad === 'Çakışan Müşteri'), 'ayrıntı: silinen randevu depodan kalkar');

  // düzenle: ismi değiştir
  await s.locator('.rnd', { hasText: 'Zeki' }).click();
  await s.click('#a-duzenle');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-ad').inputValue() === '<b>Zeki</b> Deneme', 'düzenle: form mevcut bilgilerle açılır');
  await s.fill('#f-ad', 'Zeki Usta');
  await s.fill('#f-tel', '0532 111 22 33');
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)');
  denet(await s.locator('.rnd', { hasText: 'Zeki Usta' }).count() === 1 && (await kayit(s)).randevular.filter(r => r.ad.includes('Zeki')).length === 1, 'düzenle: aynı randevu güncellenir, kopya oluşmaz');
  await s.locator('.rnd', { hasText: 'Zeki Usta' }).click();
  denet((await s.locator('#a-wa').getAttribute('href')).startsWith('https://wa.me/905321112233?text='), 'ayrıntı: WhatsApp bağlantısı 90 ile başlar');
  denet(await s.locator('#a-ara').getAttribute('href') === 'tel:05321112233', 'ayrıntı: ara bağlantısı');
  await s.click('#sayfa-kapat');

  // öneri: eski müşteriden seçince telefon dolar
  await s.click('#fab');
  await s.fill('#f-ad', 'zeki');
  await s.locator('.oneri', { hasText: 'Zeki Usta' }).click();
  denet(await s.locator('#f-ad').inputValue() === 'Zeki Usta' && await s.locator('#f-tel').inputValue() === '0532 111 22 33', 'form: öneri seçilince isim ve telefon dolar');
  await s.click('#sayfa-kapat');

  // gün değiştirme ve yeniden yüklemede kalıcılık
  await s.click('#sonraki');
  denet((await s.locator('#baslik-tarih').innerText()).includes('22 Kasım'), 'gün: sonraki güne geçilir');
  denet(await s.locator('#kapali-not').isVisible(), 'gün: Pazar için kapalı gün notu');
  denet(await s.locator('.simdi').count() === 0, 'gün: başka günde şimdi çizgisi yok');
  await cek(s, '05-gun-kapali');
  await s.click('#bugun');
  denet((await s.locator('#baslik-tarih').innerText()).includes('21 Kasım'), 'gün: Bugün düğmesi geri getirir');
  await s.reload();
  await s.waitForSelector('.rnd');
  denet(await s.locator('.rnd', { hasText: 'Zeki Usta' }).count() === 1, 'depo: yeniden açılınca randevu duruyor');

  // temiz başla
  await s.click('#temiz-basla');
  await s.click('#temiz-evet');
  await s.waitForSelector('.dilim.bos');
  denet(await s.locator('.rnd').count() === 0 && await s.locator('#ornek-serit').count() === 0, 'örnek: temiz başla tüm örnekleri siler, şerit kalkar');
  const temiz = await kayit(s);
  denet(temiz.randevular.length === 0 && temiz.ayar.ornek === false && temiz.ayar.dukkan === 'By Lider Erkek Kuaförü', 'örnek: temizlenince dükkân adı korunur');
  await tasmaYok(s, 'boş gün');
  await cek(s, '06-gun-bos');
  await baglam.close();
}
{
  // bozuk depo: uygulama yine açılır, bozuk kayıt yedeklenir
  const { baglam, s } = await ac('light', '{bozuk json');
  denet(await s.locator('.rnd').count() >= 9, 'depo: bozuk kayıtla da uygulama açılır');
  denet(await s.evaluate(() => localStorage.getItem('berber-v1-bozuk')) === '{bozuk json', 'depo: bozuk kayıt ayrı anahtarda saklanır');
  await baglam.close();
}
{
  // ızgaraya oturmayan ve saat dışı randevular kaybolmaz
  const veri = { ayar: { dukkan: 'Deneme', acilis: '10:00', kapanis: '12:00', adim: 30, kapali: [], ornek: false },
    islemler: [{ id: 'sac', ad: 'Saç', sure: 30, fiyat: null, renk: '#2F6FDE', sira: 0, silindi: false }],
    randevular: [
      { id: 'a', tarih: '2026-11-21', saat: '08:15', sure: 30, ad: 'Erkenci', islemId: 'sac', islemAd: 'Saç', durum: 'bekliyor' },
      { id: 'b', tarih: '2026-11-21', saat: '10:15', sure: 15, ad: 'Aradaki', islemId: 'sac', islemAd: 'Saç', durum: 'bekliyor' },
      { id: 'c', tarih: '2026-11-21', saat: '11:00', sure: 30, ad: 'İptalci', islemId: 'sac', islemAd: 'Saç', durum: 'iptal' },
      { id: 'd', tarih: '2026-11-21', saat: '21:00', sure: 60, ad: 'Uzun İsimli Bir Müşteri Çok Çok Uzun Bir Soyadla Gelmiş Olsun', islemId: 'x', islemAd: 'Silinmiş İşlem', durum: 'bekliyor' }] };
  const { baglam, s } = await ac('dark', JSON.stringify(veri));
  for (const ad of ['Erkenci', 'Aradaki', 'İptalci', 'Uzun İsimli']) denet(await s.locator('.rnd', { hasText: ad }).count() === 1, 'kenar: "' + ad + '" listede');
  denet(await s.locator('.dilim.bos[data-saat="11:00"]').count() === 1, 'kenar: iptal edilen saat yeniden boş görünür');
  denet(await s.locator('.rnd.iptal', { hasText: 'İptalci' }).count() === 1, 'kenar: iptal üstü çizili satır');
  denet(await s.locator('#ornek-serit').count() === 0, 'kenar: örnek olmayan veride şerit yok');
  denet((await s.locator('#baslik-dukkan').innerText()) === 'Deneme', 'gün: başlıkta dükkân adı');
  await tasmaYok(s, 'kenar');
  await cek(s, '07-gun-koyu-kenar');
  await baglam.close();
}
{
  const { baglam, s } = await ac('dark');
  await cek(s, '08-gun-koyu');
  await s.locator('.rnd').first().click();
  await s.waitForSelector('#sayfa.acik');
  await cek(s, '09-ayrinti-koyu');
  await baglam.close();
}

/* ---------- Task 5: istatistik ---------- */
const BR = require('../../berber/hesap.js'); require('../../berber/ornek.js');
const ORNEK = BR.ornekVeri('2026-11-21'), SIMDI = new Date(2026, 10, 21, 14, 25);
const bekle = (tur, tarih) => BR.istatistik(ORNEK.randevular, tur, tarih, SIMDI);
const tr = n => new Intl.NumberFormat('tr-TR').format(n);
{
  const { baglam, s } = await ac('light');
  await s.click('[data-sekme="ist"]');
  await s.waitForSelector('#ist-kisi');
  const ay = bekle('ay', '2026-11-21');
  denet((await s.locator('#ist-etiket').innerText()) === 'Kasım 2026', 'ist: açılışta bu ay');
  denet((await s.locator('#ist-kisi').innerText()) === String(ay.kisi), 'ist: aylık kişi sayısı hesapla aynı');
  denet(await s.locator('#ist-grafik .cubuk').count() === 30, 'ist: ay grafiğinde 30 çubuk');
  denet(await s.locator('.dagilim-satir').count() === ay.islemler.length, 'ist: işlem dağılımı satır sayısı');
  denet((await s.locator('.dagilim-satir').first().innerText()).includes(ay.islemler[0].ad), 'ist: en çok yapılan işlem en üstte');
  denet((await s.locator('#ist-ciro').innerText()).includes(tr(ay.ciro)), 'ist: ciro hesapla aynı');
  denet((await s.locator('#ist-fark').innerText()).includes(String(Math.abs(ay.kisi - ay.oncekiKisi))), 'ist: önceki aya fark yazılır');
  denet((await s.locator('#ist-gelmedi').innerText()).includes(String(ay.gelmedi)), 'ist: gelmeyen sayısı');
  denet((await s.locator('#ist-yogun').innerText()).includes(ay.enYogunGun.etiket), 'ist: en yoğun gün yazılır');
  await tasmaYok(s, 'ist ay');
  await cek(s, '10-ist-ay');

  await s.click('[data-tur="yil"]');
  const yil = bekle('yil', '2026-11-21');
  denet((await s.locator('#ist-etiket').innerText()) === '2026' && (await s.locator('#ist-kisi').innerText()) === tr(yil.kisi), 'ist: yıllık kişi sayısı');
  denet(await s.locator('#ist-grafik .cubuk').count() === 12, 'ist: yıl grafiğinde 12 çubuk');
  await tasmaYok(s, 'ist yıl');
  await cek(s, '11-ist-yil');
  await s.click('#ist-onceki');
  denet((await s.locator('#ist-etiket').innerText()) === '2025' && (await s.locator('#ist-kisi').innerText()) === tr(bekle('yil', '2025-11-21').kisi), 'ist: önceki yıla geçilir');
  await s.click('#ist-sonraki'); await s.click('#ist-sonraki');
  denet((await s.locator('#ist-etiket').innerText()) === '2027' && (await s.locator('#ist-kisi').innerText()) === '0', 'ist: gelecek yıl sıfır');
  denet(await s.locator('#ist-bos').isVisible() && await s.locator('.dagilim-satir').count() === 0, 'ist: boş dönemde "kayıt yok" yazısı');
  await cek(s, '12-ist-bos');
  await s.click('#ist-onceki');

  await s.click('[data-tur="hafta"]');
  denet((await s.locator('#ist-etiket').innerText()) === '16–22 Kasım 2026' && await s.locator('#ist-grafik .cubuk').count() === 7, 'ist: hafta görünümü 7 çubuk');
  denet((await s.locator('#ist-kisi').innerText()) === String(bekle('hafta', '2026-11-21').kisi), 'ist: haftalık kişi sayısı');
  await cek(s, '13-ist-hafta');
  await s.click('[data-tur="gun"]');
  const gn = bekle('gun', '2026-11-21');
  denet((await s.locator('#ist-etiket').innerText()).includes('21 Kasım 2026') && (await s.locator('#ist-kisi').innerText()) === String(gn.kisi), 'ist: günlük kişi sayısı');
  denet(await s.locator('#ist-grafik .cubuk').count() === gn.seri.length, 'ist: gün grafiği saat saat');
  await tasmaYok(s, 'ist gün');
  await cek(s, '14-ist-gun');
  await baglam.close();
}
{
  // fiyat girilmemişse ciro kutusu görünmez
  const veri = BR.varsayilanVeri();
  veri.randevular.push({ id: 'a', tarih: '2026-11-20', saat: '10:00', sure: 30, ad: 'Fiyatsız', tel: '', islemId: 'sac', islemAd: 'Saç', fiyat: null, durum: 'bekliyor', not: '' });
  const { baglam, s } = await ac('dark', JSON.stringify(veri));
  await s.click('[data-sekme="ist"]');
  await s.waitForSelector('#ist-kisi');
  denet((await s.locator('#ist-kisi').innerText()) === '1' && await s.locator('#ist-ciro').count() === 0, 'ist: fiyat yoksa ciro kutusu yok');
  await baglam.close();
}
{
  const { baglam, s } = await ac('dark');
  await s.click('[data-sekme="ist"]');
  await s.waitForSelector('#ist-kisi');
  await cek(s, '15-ist-koyu');
  await baglam.close();
}

/* ---------- Task 5: ayarlar ---------- */
{
  const { baglam, s } = await ac('light');
  await s.click('[data-sekme="ayar"]');
  await s.waitForSelector('#a-dukkan');
  await tasmaYok(s, 'ayarlar');
  await cek(s, '16-ayar');
  await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await cek(s, '17-ayar-alt');

  await s.fill('#a-dukkan', 'Lider <i>Kuaför</i>'); await s.locator('#a-dukkan').blur();
  denet((await s.locator('#baslik-dukkan').innerText()) === 'Lider <i>Kuaför</i>' && (await kayit(s)).ayar.dukkan === 'Lider <i>Kuaför</i>', 'ayar: dükkân adı kaydedilir ve başlıkta düz metin görünür');

  await s.selectOption('#a-kapanis', '08:00');
  denet(await s.locator('#a-saat-hata').isVisible() && (await kayit(s)).ayar.kapanis === '21:00', 'ayar: kapanış açılıştan önceyse kaydedilmez, uyarı çıkar');
  await s.selectOption('#a-kapanis', '20:00');
  denet(!(await s.locator('#a-saat-hata').isVisible()) && (await kayit(s)).ayar.kapanis === '20:00', 'ayar: geçerli kapanış kaydedilir');

  await s.click('[data-adim="15"]');
  denet((await kayit(s)).ayar.adim === 15 && await s.locator('[data-adim="15"]').getAttribute('aria-pressed') === 'true', 'ayar: 15 dakikalık aralık seçilir');
  await s.click('[data-kapali="6"]');
  denet((await kayit(s)).ayar.kapali.includes(6), 'ayar: Cumartesi kapalı işaretlenir');
  await s.click('[data-sekme="gun"]');
  denet(await s.locator('#kapali-not').isVisible(), 'ayar: kapalı gün gün ekranına yansır');
  denet(await s.locator('.dilim.bos[data-saat$=":15"], .dilim.bos[data-saat$=":45"]').count() > 0, 'ayar: 15 dakikalık dilimler gün ekranında');
  denet(await s.locator('.dilim[data-saat="20:00"]').count() === 0 || await s.locator('.rnd').count() > 0, 'ayar: kapanış sonrası boş dilim yok ya da randevu yüzünden uzamış');
  await s.click('[data-sekme="ayar"]');
  await s.click('[data-kapali="6"]'); await s.click('[data-adim="30"]');
  denet(!(await kayit(s)).ayar.kapali.includes(6) && (await kayit(s)).ayar.adim === 30, 'ayar: kapalı gün ve aralık geri alınır');

  // işlem ekle, düzenle, sırala, sil
  await s.click('#islem-ekle');
  await s.waitForSelector('#sayfa.acik #i-ad');
  await s.click('#i-kaydet');
  denet(await s.locator('#i-hata').isVisible(), 'işlem: adsız kaydedilmez');
  await s.fill('#i-ad', 'Keratin'); await s.selectOption('#i-sure', '60'); await s.fill('#i-fiyat', '900');
  await cek(s, '18-islem-formu');
  await s.click('#i-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)');
  const eklenen = (await kayit(s)).islemler.find(i => i.ad === 'Keratin');
  denet(await s.locator('.islem-satir').count() === 8 && eklenen && eklenen.sure === 60 && eklenen.fiyat === 900, 'işlem: yeni işlem eklenir');

  await s.locator('.islem-satir').first().click();
  await s.waitForSelector('#sayfa.acik #i-ad');
  denet(await s.locator('#i-ad').inputValue() === 'Saç', 'işlem: düzenleme mevcut bilgilerle açılır');
  await s.fill('#i-fiyat', '400'); await s.click('#i-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)');
  const k5 = await kayit(s);
  denet(k5.islemler.find(i => i.id === 'sac').fiyat === 400 && k5.randevular.filter(r => r.islemId === 'sac').every(r => r.fiyat === 350), 'işlem: fiyat değişince eski randevuların fiyatı aynı kalır');

  await s.locator('.islem-satir', { hasText: 'Ağda' }).click();
  await s.click('#i-sil'); await s.click('#i-sil-evet');
  await s.waitForSelector('#sayfa:not(.acik)');
  const k6 = await kayit(s);
  denet(await s.locator('.islem-satir').count() === 7 && k6.islemler.find(i => i.id === 'agda').silindi === true && k6.randevular.some(r => r.islemAd === 'Ağda'), 'işlem: silinen işlem listeden kalkar, eski randevular adını korur');

  await s.locator('[data-asagi]').first().click();
  denet((await s.locator('.islem-satir').first().innerText()).includes('Sakal') && (await s.locator('.islem-satir').nth(1).innerText()).startsWith('Saç'), 'işlem: aşağı taşıma sırayı değiştirir');
  await s.click('[data-sekme="gun"]'); await s.click('#fab');
  await s.waitForSelector('#sayfa.acik .islem-sec');
  denet(await s.locator('.islem-sec').count() === 7 && (await s.locator('.islem-sec').first().innerText()).includes('Sakal') && await s.locator('.islem-sec', { hasText: 'Keratin' }).count() === 1, 'işlem: randevu formu güncel işlem listesini gösterir');
  await s.click('#sayfa-kapat');
  await s.click('[data-sekme="ayar"]');

  // yedek indir
  const adet = (await kayit(s)).randevular.length;
  const [inen] = await Promise.all([s.waitForEvent('download'), s.click('#yedek-indir')]);
  denet(inen.suggestedFilename() === 'berber-yedek-2026-11-21.json', 'yedek: dosya adı tarihli');
  const yedek = JSON.parse(await readFile(await inen.path(), 'utf8'));
  denet(BR.dogrula(yedek) !== null && yedek.randevular.length === adet, 'yedek: indirilen dosya geçerli ve eksiksiz');

  // yanlış dosyalar reddedilir, veri değişmez
  for (const [ad, icerik] of [['json değil', 'merhaba'], ['başka json', '{"a":1}'], ['boş', '']]) {
    await s.setInputFiles('#yedek-dosya', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(icerik) });
    await s.waitForSelector('#yedek-hata:not([hidden])');
    denet((await s.locator('#yedek-hata').innerText()).includes('yedeği değil') && (await kayit(s)).randevular.length === adet, 'yedek: ' + ad + ' dosyası reddedilir, veri değişmez');
    await s.evaluate(() => { document.querySelector('#yedek-hata').hidden = true; });
  }
  // geçerli yedek: onaydan sonra veriyi değiştirir
  const kucuk = BR.varsayilanVeri(); kucuk.ayar.dukkan = 'Yedekten Gelen';
  kucuk.randevular.push({ id: 'y1', tarih: '2026-11-21', saat: '16:00', sure: 30, ad: 'Yedek Müşteri', tel: '', islemId: 'sac', islemAd: 'Saç', fiyat: null, durum: 'bekliyor', not: '' });
  await s.setInputFiles('#yedek-dosya', { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(kucuk)) });
  await s.waitForSelector('#sayfa.acik #yukle-evet');
  denet((await kayit(s)).randevular.length === adet, 'yedek: onaylanmadan veri değişmez');
  await cek(s, '19-yedek-onay');
  await s.click('#yukle-evet');
  await s.waitForSelector('#sayfa:not(.acik)');
  denet((await kayit(s)).randevular.length === 1 && (await s.locator('#baslik-dukkan').innerText()) === 'Yedekten Gelen', 'yedek: onaylanınca yedekteki veri yüklenir');

  // örnek verileri yeniden yükle
  await s.click('#ornek-yukle'); await s.click('#ornek-evet');
  await s.waitForSelector('#sayfa:not(.acik)');
  denet((await kayit(s)).ayar.ornek === true && (await kayit(s)).randevular.length > 1000, 'örnek: ayarlardan yeniden yüklenir');
  await s.click('#ornek-sil'); await s.click('#temiz-evet');
  await s.waitForSelector('#sayfa:not(.acik)');
  denet((await kayit(s)).randevular.length === 0 && await s.locator('#ornek-yukle').isVisible(), 'örnek: ayarlardan silinir');
  await baglam.close();
}
{
  const { baglam, s } = await ac('dark');
  await s.click('[data-sekme="ayar"]');
  await s.waitForSelector('#a-dukkan');
  await cek(s, '20-ayar-koyu');
  await baglam.close();
}

/* ---------- Task 6: ana ekrana ekleme ve çevrimdışı ---------- */
{
  const { baglam, s } = await ac('light', undefined, true);
  const m = await s.evaluate(async () => { const b = document.querySelector('link[rel="manifest"]'); return b ? (await fetch(b.href)).json() : null; });
  denet(m && m.name === 'Berber Randevu' && m.short_name === 'Randevu' && m.display === 'standalone' && m.start_url === './' && m.scope === './' && m.lang === 'tr', 'pwa: manifest alanları');
  denet(m && m.icons.length === 2 && m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512' && /maskable/.test(i.purpose)), 'pwa: 192 ve 512 ikon, maskable');
  denet(await s.locator('link[rel="apple-touch-icon"]').count() === 1 && await s.locator('meta[name="apple-mobile-web-app-capable"]').count() === 1, 'pwa: iPhone ana ekran etiketleri');
  const hazir = await s.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 6000))]));
  denet(hazir, 'pwa: service worker etkinleşir');
  await s.reload(); await s.waitForSelector('.rnd'); // dosyalar önbelleğe girsin
  await s.waitForTimeout(500);
  await baglam.setOffline(true);
  hatalar.length = 0; // çevrimdışıyken ağ hatası günlüğü beklenir
  await s.reload();
  const acildi = await s.waitForSelector('.rnd', { timeout: 6000 }).then(() => true, () => false);
  denet(acildi && (await s.locator('#baslik-tarih').innerText()).includes('21 Kasım'), 'pwa: internet yokken uygulama açılır');
  await s.click('[data-sekme="ist"]');
  denet(await s.locator('#ist-kisi').isVisible(), 'pwa: internet yokken istatistik çalışır');
  hatalar.length = 0;
  await baglam.close();
}

/* EK-DENETIMLER */

await tarayici.close();
sunucu.close();
denet(hatalar.length === 0, 'konsol hatası yok' + (hatalar.length ? ': ' + hatalar.slice(0, 3).join(' | ') : ''));
console.log(`${gecen} denetim geçti, ${dusen.length} düştü. Görüntüler: ${cikti}`);
process.exit(dusen.length ? 1 : 0);
