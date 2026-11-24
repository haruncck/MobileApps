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
async function ac(tema, depo, sw, ilk, saat) {
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: tema, serviceWorkers: sw ? 'allow' : 'block', acceptDownloads: true });
  const s = await baglam.newPage();
  s.on('console', m => { if (m.type() === 'error') hatalar.push(m.text()); });
  s.on('pageerror', e => hatalar.push(String(e)));
  s.on('response', y => { if (y.status() >= 400) hatalar.push(y.status() + ' ' + y.url()); });
  await s.clock.install({ time: new Date(saat || '2026-11-21T14:25:00+03:00') });
  if (depo !== undefined) await s.addInitScript(d => { if (!sessionStorage.getItem('ekildi')) { localStorage.setItem('berber-v1', d); sessionStorage.setItem('ekildi', '1'); } }, depo);
  if (ilk) await s.addInitScript(ilk);
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
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
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
  await s.waitForTimeout(450); // uyarı çıktıktan hemen sonraki dokunuş onay sayılmaz
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(await s.locator('.rnd', { hasText: 'Çakışan Müşteri' }).count() === 1, 'form: onaylanınca çakışan randevu eklenir');

  // randevuya dokun → ayrıntı → gelmedi işaretle → sil
  await s.locator('.rnd', { hasText: 'Çakışan Müşteri' }).click();
  await s.waitForSelector('#sayfa.acik [data-durum="gelmedi"]');
  await cek(s, '04-ayrinti');
  await s.click('[data-durum="gelmedi"]');
  denet((await kayit(s)).randevular.find(r => r.ad === 'Çakışan Müşteri').durum === 'gelmedi', 'ayrıntı: gelmedi işaretlenir ve kaydedilir');
  await s.click('#a-sil');
  await s.click('#a-sil-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(!(await kayit(s)).randevular.some(r => r.ad === 'Çakışan Müşteri'), 'ayrıntı: silinen randevu depodan kalkar');

  // düzenle: ismi değiştir
  await s.locator('.rnd', { hasText: 'Zeki' }).click();
  await s.click('#a-duzenle');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-ad').inputValue() === '<b>Zeki</b> Deneme', 'düzenle: form mevcut bilgilerle açılır');
  await s.fill('#f-ad', 'Zeki Usta');
  await s.fill('#f-tel', '0532 111 22 33');
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
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
  denet((await s.locator('#temiz-basla').boundingBox()).height >= 48, 'dokunma: Temiz başla düğmesi en az 48 px');
  await s.click('#temiz-basla');
  denet((await s.locator('#sayfa .metin').innerText()).includes('Kendi eklediğiniz 1 randevu'), 'örnek: onay yazısı kendi randevularının kalacağını söyler');
  await s.click('#temiz-evet');
  await s.waitForSelector('.dilim.bos');
  denet(await s.locator('.rnd').count() === 1 && await s.locator('.rnd', { hasText: 'Zeki Usta' }).count() === 1 && await s.locator('#ornek-serit').count() === 0, 'örnek: temiz başla örnekleri siler, kendi randevusu kalır, şerit kalkar');
  const temiz = await kayit(s);
  denet(temiz.randevular.length === 1 && temiz.ayar.ornek === false && temiz.ayar.dukkan === 'By Lider Erkek Kuaförü' && temiz.islemler.find(i => i.id === 'sac').fiyat === null, 'örnek: temizlenince dükkân adı korunur, örnek fiyatlar silinir');
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
  denet((await s.locator('#ist-fark').innerText()).includes(String(Math.abs(ay.kisi - ay.oncekiAyni))) && (await s.locator('#ist-fark').innerText()).includes('Geçen ayın bu zamanına'), 'ist: süren ay, geçen ayın aynı zamanıyla karşılaştırılır');
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
  denet((await s.locator('#ist-fark').innerText()).includes('henüz başlamadı') && await s.locator('.dagilim-satir').count() === 0, 'ist: başlamamış dönemde karşılaştırma yerine bilgi yazısı');
  for (let i = 0; i < 4; i++) await s.click('#ist-onceki');
  denet((await s.locator('#ist-etiket').innerText()) === '2023' && await s.locator('#ist-bos').isVisible() && (await s.locator('#ist-bos').innerText()).includes('kayıt yok'), 'ist: geçmiş boş dönemde "kayıt yok" yazısı');
  await cek(s, '12-ist-bos');
  for (let i = 0; i < 3; i++) await s.click('#ist-sonraki');

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
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const eklenen = (await kayit(s)).islemler.find(i => i.ad === 'Keratin');
  denet(await s.locator('.islem-satir').count() === 8 && eklenen && eklenen.sure === 60 && eklenen.fiyat === 900, 'işlem: yeni işlem eklenir');

  await s.locator('.islem-satir').first().click();
  await s.waitForSelector('#sayfa.acik #i-ad');
  denet(await s.locator('#i-ad').inputValue() === 'Saç', 'işlem: düzenleme mevcut bilgilerle açılır');
  await s.fill('#i-fiyat', '400'); await s.click('#i-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const k5 = await kayit(s);
  denet(k5.islemler.find(i => i.id === 'sac').fiyat === 400 && k5.randevular.filter(r => r.islemId === 'sac').every(r => r.fiyat === 350), 'işlem: fiyat değişince eski randevuların fiyatı aynı kalır');

  await s.locator('.islem-satir', { hasText: 'Ağda' }).click();
  await s.click('#i-sil'); await s.click('#i-sil-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
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
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).randevular.length === 1 && (await s.locator('#baslik-dukkan').innerText()) === 'Yedekten Gelen', 'yedek: onaylanınca yedekteki veri yüklenir');

  // örnek verileri yeniden yükle
  await s.click('#ornek-yukle'); await s.click('#ornek-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).ayar.ornek === true && (await kayit(s)).randevular.length > 1000, 'örnek: ayarlardan yeniden yüklenir');
  await s.click('#ornek-sil'); await s.click('#temiz-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
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

/* ---------- son gözden geçirme bulguları ---------- */
{
  // gece yarısı: uygulama açık kalınca "bugün" yeni güne geçer
  const { baglam, s } = await ac('light');
  const tarihGirisi = await s.$('#tarih-sec');
  await s.clock.fastForward('00:01:00');
  denet(await tarihGirisi.evaluate(e => e.isConnected), 'tazeleme: başlıktaki tarih girişi 30 saniyede bir yeniden kurulmaz');
  denet((await s.locator('.simdi span').innerText()) === '14:26', 'tazeleme: şimdi çizgisi ilerler');
  await s.clock.fastForward('10:00:00');
  denet((await s.locator('#baslik-tarih').innerText()).includes('22 Kasım') && await s.locator('#bugun.gizli').count() === 1 && await s.locator('.simdi').count() === 1, 'gece yarısı: açık kalan uygulama yeni güne geçer');
  await s.click('[data-sekme="ist"]'); await s.click('[data-tur="gun"]');
  denet((await s.locator('#ist-etiket').innerText()).includes('22 Kasım'), 'gece yarısı: istatistik de yeni günü gösterir');
  await s.click('[data-sekme="gun"]');
  await s.click('#onceki'); // kullanıcı başka güne bakıyorsa gün dönünce yerinde kalır
  await s.clock.fastForward('24:00:00');
  denet((await s.locator('#baslik-tarih').innerText()).includes('21 Kasım') && await s.locator('#bugun.gizli').count() === 0, 'gece yarısı: başka güne bakılıyorsa görünüm değişmez');
  denet((await s.locator('#bugun').boundingBox()).height >= 48, 'dokunma: Bugün düğmesi en az 48 px');
  await baglam.close();
}
{
  // dokunma alanları ve müşteri önerisi / fiyat yazımı
  const veri = BR.varsayilanVeri();
  const r = (id, ad, tel, tarih, durum) => ({ id, tarih, saat: '10:00', sure: 30, ad, tel, islemId: 'sac', islemAd: 'Saç', fiyat: null, durum: durum || 'bekliyor', not: '' });
  veri.randevular.push(r('a', 'Ali Telefonlu', '0532 000 00 01', '2026-11-10'), r('b', 'Ali Telefonsuz', '', '2026-11-11'),
    r('c', 'Ali Telefonlu', '', '2026-11-12'), r('d', 'İptal Edilen', '', '2026-11-21', 'iptal'));
  const { baglam, s } = await ac('light', JSON.stringify(veri));
  denet((await s.locator('.rnd.iptal').boundingBox()).height >= 48, 'dokunma: iptal satırı en az 48 px');
  await s.click('#fab');
  await s.fill('#f-ad', 'ali');
  denet((await s.locator('.oneri').first().boundingBox()).height >= 48, 'dokunma: öneri düğmeleri en az 48 px');
  denet((await s.locator('.oneri', { hasText: 'Ali Telefonlu' }).innerText()).includes('0532 000 00 01'), 'öneri: son randevuda telefon boş olsa da eski telefon bulunur');
  await s.locator('.oneri', { hasText: 'Ali Telefonlu' }).click();
  denet(await s.locator('#f-tel').inputValue() === '0532 000 00 01', 'öneri: telefonlu müşteri seçilince telefon dolar');
  await s.fill('#f-ad', 'ali');
  await s.locator('.oneri', { hasText: 'Ali Telefonsuz' }).click();
  denet(await s.locator('#f-tel').inputValue() === '', 'öneri: telefonsuz müşteriye geçince önceki telefon taşınmaz');
  await s.fill('#f-ad', 'Ali Telefonlu');
  denet(await s.locator('#f-tel').inputValue() === '0532 000 00 01', 'öneri: isim tam yazılınca telefon kendiliğinden dolar');
  await s.fill('#f-fiyat', '1.500');
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).randevular.find(x => x.ad === 'Ali Telefonlu' && x.tarih === '2026-11-21').fiyat === 1500, 'fiyat: "1.500" bin beş yüz olarak kaydedilir');
  await s.click('[data-sekme="ayar"]');
  denet((await s.locator('[data-adim="15"]').boundingBox()).height >= 48, 'dokunma: aralık seçimi en az 48 px');
  await s.locator('.islem-satir').first().click();
  await s.fill('#i-fiyat', '2.250'); await s.click('#i-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).islemler[0].fiyat === 2250, 'fiyat: işlem fiyatında da binlik nokta anlaşılır');
  await s.click('[data-sekme="ist"]');
  denet((await s.locator('[data-tur="ay"]').boundingBox()).height >= 48, 'dokunma: dönem seçimi en az 48 px');
  await baglam.close();
}
{
  // örnek randevuyu düzenleyen kullanıcı onu sahiplenmiş olur; temiz başla silmez
  const { baglam, s } = await ac('light');
  await s.locator('.rnd').first().click(); await s.click('#a-duzenle');
  await s.fill('#f-ad', 'Sahiplenilen'); await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  await s.click('[data-sekme="ayar"]'); await s.click('#ornek-sil'); await s.click('#temiz-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const k = await kayit(s);
  denet(k.randevular.length === 1 && k.randevular[0].ad === 'Sahiplenilen', 'örnek: düzenlenen örnek randevu kullanıcının sayılır ve silinmez');
  await baglam.close();
}
{
  // iPhone: yedek paylaşım sayfasıyla verilir (ana ekran uygulamasında dosya indirme güvenilir değil)
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const s = await baglam.newPage();
  s.on('pageerror', e => hatalar.push(String(e)));
  await s.clock.install({ time: new Date('2026-11-21T14:25:00+03:00') });
  await s.addInitScript(() => { navigator.canShare = () => true; navigator.share = async x => { window.__paylasilan = x.files[0].name + '|' + x.files[0].type + '|' + (await x.files[0].text()).length; }; });
  await s.goto(adres); await s.waitForSelector('.rnd');
  await s.click('[data-sekme="ayar"]');
  let indi = false; s.on('download', () => { indi = true; });
  await s.click('#yedek-indir');
  await s.waitForFunction(() => window.__paylasilan);
  const p = (await s.evaluate(() => window.__paylasilan)).split('|');
  denet(p[0] === 'berber-yedek-2026-11-21.json' && p[1] === 'application/json' && Number(p[2]) > 100000 && !indi, 'yedek: iPhone\'da dosya paylaşım sayfasına verilir');
  await baglam.close();
}

/* ---------- sesle ekleme ---------- */
// Taklit ses tanıma: test "konus" diyene kadar dinler. Gerçek telefon mikrofonu burada sınanamaz.
const SAHTE_SES = `
  class SahteTanima {
    constructor() { window.__ses = this; window.__sesAdet = (window.__sesAdet || 0) + 1; }
    start() {
      this.basladi = true;
      if (window.__sesHata) { const h = window.__sesHata; Promise.resolve().then(() => { this.onerror && this.onerror({ error: h }); this.onend && this.onend(); }); }
    }
    stop() { this.onend && this.onend(); }
    abort() { this.iptal = true; this.onend && this.onend(); }
    konus(yazi, ara) { this.onresult && this.onresult({ results: [[{ transcript: yazi }]] }); if (!ara) this.onend && this.onend(); }
  }
  delete window.SpeechRecognition; window.webkitSpeechRecognition = SahteTanima;`;
const konus = (s, yazi, ara) => s.evaluate(([y, a]) => window.__ses.konus(y, a), [yazi, !!ara]);
{
  const { baglam, s } = await ac('light', undefined, false, SAHTE_SES);
  denet(await s.locator('#mikrofon').isVisible() && (await s.locator('#mikrofon').boundingBox()).height >= 48, 'ses: mikrofon düğmesi görünür ve en az 48 px');
  await s.click('#mikrofon');
  await s.waitForSelector('#sayfa.acik #ses-yazi');
  denet(await s.evaluate(() => window.__ses.basladi === true && window.__ses.lang === 'tr-TR'), 'ses: dinleme Türkçe olarak başlar');
  await konus(s, 'ahmet kaya yarın', true);
  denet((await s.locator('#ses-yazi').innerText()).includes('ahmet kaya yarın'), 'ses: söylenen anında ekranda görünür');
  await cek(s, '21-ses-dinliyor');
  await konus(s, 'Ahmet Kaya yarın saat 3 saç sakal');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-ad').inputValue() === 'Ahmet Kaya' && await s.locator('#f-tarih').inputValue() === '2026-11-22' && await s.locator('#f-saat').inputValue() === '15:00', 'ses: isim, tarih ve saat forma dolar');
  denet((await s.locator('.islem-sec[aria-pressed="true"]').innerText()).includes('Saç + Sakal') && await s.locator('#f-sure').inputValue() === '45' && await s.locator('#f-fiyat').inputValue() === '450', 'ses: işlem seçilir, süre ve fiyat gelir');
  denet((await s.locator('#f-duyulan').innerText()).includes('Ahmet Kaya yarın saat 3 saç sakal'), 'ses: duyulan cümle formda gösterilir');
  await cek(s, '22-ses-form');
  denet(!(await kayit(s)), 'ses: onaylanmadan hiçbir şey kaydedilmez');
  await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const k = (await kayit(s)).randevular.find(r => r.ad === 'Ahmet Kaya' && r.tarih === '2026-11-22');
  denet(k && k.saat === '15:00' && k.islemAd === 'Saç + Sakal' && !k.ornek, 'ses: Kaydet ile randevu yazılır');
  denet((await s.locator('#baslik-tarih').innerText()).includes('22 Kasım'), 'ses: kayıttan sonra o güne geçilir');

  // saat anlaşılmazsa söyler; ek işlem nota yazılır
  await s.click('#mikrofon'); await s.waitForSelector('#sayfa.acik #ses-yazi');
  await konus(s, 'Hasan saç ve ağda');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-ad').inputValue() === 'Hasan' && (await s.locator('#f-duyulan').innerText()).includes('Saat anlaşılmadı'), 'ses: saat anlaşılmazsa formda uyarır');
  denet(await s.locator('#f-not').inputValue() === 'Ek: Ağda' && await s.locator('#f-tarih').inputValue() === '2026-11-22', 'ses: ikinci işlem nota yazılır, tarih söylenmezse bakılan gün kalır');
  await s.click('#sayfa-kapat');

  // güvenlik: duyulan metin düz yazı olarak gösterilir
  await s.click('#mikrofon'); await s.waitForSelector('#sayfa.acik #ses-yazi');
  await konus(s, '<img src=x onerror=window.__patladi=1> yarın 3', true);
  await konus(s, '<img src=x onerror=window.__patladi=1> yarın 3');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#sayfa img').count() === 0 && !(await s.evaluate(() => window.__patladi)), 'ses: duyulan metin HTML olarak işlenmez');
  await s.click('#sayfa-kapat');

  // vazgeç: dinleme durur, geç gelen sonuç form açmaz
  await s.click('#mikrofon'); await s.waitForSelector('#sayfa.acik #ses-yazi');
  await s.click('#ses-vazgec');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(await s.evaluate(() => window.__ses.iptal === true), 'ses: vazgeçince dinleme durdurulur');
  await s.evaluate(() => { window.__ses.onresult && window.__ses.onresult({ results: [[{ transcript: 'Geç Kalan yarın 3' }]] }); window.__ses.onend && window.__ses.onend(); });
  denet(await s.locator('#sayfa.acik').count() === 0, 'ses: vazgeçtikten sonra gelen sonuç form açmaz');

  // ses duyulmazsa: yeniden dene
  await s.click('#mikrofon'); await s.waitForSelector('#sayfa.acik #ses-yazi');
  const once = await s.evaluate(() => window.__sesAdet);
  await s.click('#ses-bitti');
  await s.waitForSelector('#ses-hata');
  denet((await s.locator('#ses-hata').innerText()).includes('duyulmadı'), 'ses: bir şey söylenmezse "duyulmadı" der');
  await s.click('#ses-yeniden');
  await s.waitForSelector('#sayfa.acik #ses-yazi');
  denet(await s.evaluate(() => window.__sesAdet) === once + 1, 'ses: Yeniden dene yeni bir dinleme başlatır');
  await s.click('#ses-vazgec');

  // izin yok / bu telefonda çalışmıyor: klavye mikrofonuna yönlendirir, elle eklemeye geçilir
  await s.evaluate(() => { window.__sesHata = 'service-not-allowed'; });
  await s.click('#mikrofon');
  await s.waitForSelector('#ses-hata');
  denet((await s.locator('#ses-hata').innerText()).includes('klavye'), 'ses: çalışmayan telefonda klavye mikrofonu önerilir');
  await cek(s, '23-ses-calismadi');
  await s.click('#ses-elle');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-ad').inputValue() === '' && await s.locator('#f-duyulan').count() === 0, 'ses: "Elle ekle" boş formu açar');
  await s.click('#sayfa-kapat');
  await s.evaluate(() => { window.__sesHata = 'network'; });
  await s.click('#mikrofon');
  await s.waitForSelector('#ses-hata');
  denet((await s.locator('#ses-hata').innerText()).includes('İnternet'), 'ses: internet yoksa bunu söyler');
  await s.click('#sayfa-kapat');
  await s.click('[data-sekme="ist"]');
  denet(!(await s.locator('#mikrofon').isVisible()), 'ses: mikrofon yalnızca gün ekranında');
  await baglam.close();
}
{
  // bilinen müşteri: isim kayıttaki yazımıyla ve telefonuyla gelir
  const veri = BR.varsayilanVeri();
  veri.randevular.push({ id: 'a', tarih: '2026-11-10', saat: '10:00', sure: 30, ad: 'Ali Telefonlu', tel: '0532 000 00 01', islemId: 'sac', islemAd: 'Saç', fiyat: null, durum: 'bekliyor', not: '' });
  const { baglam, s } = await ac('dark', JSON.stringify(veri), false, SAHTE_SES);
  await s.click('#mikrofon'); await s.waitForSelector('#sayfa.acik #ses-yazi');
  await cek(s, '24-ses-dinliyor-koyu');
  await konus(s, 'ali telefonlu bugün 5 buçuk sakal');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-ad').inputValue() === 'Ali Telefonlu' && await s.locator('#f-tel').inputValue() === '0532 000 00 01' && await s.locator('#f-saat').inputValue() === '17:30', 'ses: bilinen müşterinin telefonu da gelir');
  await tasmaYok(s, 'ses formu');
  await baglam.close();
}
{
  // ses tanıma olmayan tarayıcı: düğme hiç görünmez
  const { baglam, s } = await ac('light', undefined, false, 'delete window.SpeechRecognition; delete window.webkitSpeechRecognition;');
  denet(await s.locator('#mikrofon').count() === 0 || !(await s.locator('#mikrofon').isVisible()), 'ses: desteklemeyen tarayıcıda mikrofon düğmesi yok');
  denet(await s.locator('#fab').isVisible(), 'ses: desteklemeyen tarayıcıda elle ekleme düğmesi durur');
  await baglam.close();
}

/* ---------- müşteriye gitmeden önceki denetimde düzeltilenler ---------- */
{
  const { baglam, s } = await ac('light');
  // özet: "24 boş saat" yerine gerçek süre; bugün için kalan
  denet((await s.locator('.ozet').innerText()).includes('saat boş') && !/\b\d+ boş saat\b/.test(await s.locator('.ozet').innerText()), 'özet: boş zaman süre olarak yazılır');
  await s.click('#sonraki');
  denet((await s.locator('#ozet-bos').innerText()).replace(/\s+/g, ' ') === '12 saat boş', 'özet: boş Pazar günü 12 saat boş (24 değil)');
  await s.click('#bugun');

  // Android geri tuşu: açık sayfayı kapatır, uygulamadan çıkmaz
  const adres0 = s.url();
  await s.locator('.rnd').first().click();
  await s.waitForSelector('#sayfa.acik');
  denet(await s.evaluate(() => document.querySelector('#sayfa').contains(document.activeElement)), 'odak: sayfa açılınca odak sayfaya geçer');
  denet(await s.evaluate(() => document.querySelector('#govde').inert === true && document.querySelector('#sekmeler').inert === true), 'odak: sayfa açıkken arka plan etkisiz');
  await s.goBack();
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(s.url() === adres0 && await s.locator('.rnd').count() > 0, 'geri tuşu: açık sayfayı kapatır, uygulamada kalır');
  denet(await s.evaluate(() => document.querySelector('#govde').inert === false), 'odak: sayfa kapanınca arka plan yeniden etkin');
  const uzunluk = async () => s.evaluate(() => history.length);
  await s.click('#fab'); await s.waitForSelector('#sayfa.acik'); await s.click('#sayfa-kapat'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  await s.waitForTimeout(200);
  const u1 = await uzunluk();
  for (let i = 0; i < 3; i++) { await s.click('#fab'); await s.waitForSelector('#sayfa.acik'); await s.click('#sayfa-kapat'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' }); await s.waitForTimeout(200); }
  denet(await uzunluk() === u1, 'geri tuşu: aç-kapa tekrarları geçmişi şişirmez');
  // ayrıntı → düzenle → geri: tek geri tuşu kapatır
  await s.locator('.rnd').first().click(); await s.click('#a-duzenle'); await s.waitForSelector('#sayfa.acik #f-ad');
  await s.goBack(); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(s.url() === adres0, 'geri tuşu: iç içe açılan sayfada da tek geri yeter');

  // Enter klavyeyi kapatır, kaydetmez
  await s.click('#fab'); await s.waitForSelector('#sayfa.acik #f-ad');
  await s.fill('#f-ad', 'Enter Deneme'); await s.press('#f-ad', 'Enter');
  denet(await s.evaluate(() => document.activeElement.id !== 'f-ad') && await s.locator('#sayfa.acik').count() === 1 && !(await kayit(s)), 'Enter: isim alanında klavyeyi kapatır, kaydetmez');
  // uzun isimde bildirim taşmaz
  await s.fill('#f-ad', 'A'.repeat(60)); await s.locator('.islem-sec').nth(1).click();
  await s.selectOption('#f-saat', (await s.locator('#f-saat option').last().innerText()));
  await s.click('#f-kaydet');
  if (await s.locator('#f-cakisma').isVisible()) { await s.waitForTimeout(700); await s.click('#f-kaydet'); }
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(await s.evaluate(() => { const b = document.querySelector('#bildirim'); return b.classList.contains('acik') && b.scrollWidth <= b.clientWidth && b.getBoundingClientRect().right <= innerWidth; }), 'bildirim: çok uzun isimde taşmaz');
  await cek(s, '25-bildirim-uzun');
  await baglam.close();
}
{
  // okunamayan kayıt: sessiz kalmaz
  const { baglam, s } = await ac('light', '{bozuk json');
  denet(await s.locator('#bildirim.acik').count() === 1 && (await s.locator('#bildirim').innerText()).includes('okunamadı'), 'depo: okunamayan kayıt için uyarı gösterilir');
  await baglam.close();
}

{
  // sesle ekleme: gün söylenmezse belirtir, geçmiş güne yazmaz, uzun ismi keser, mikrofon son satırı örtmez
  const { baglam, s } = await ac('light', undefined, false, SAHTE_SES);
  await s.click('#onceki'); await s.click('#onceki'); // 19 Kasım'a bak
  await s.click('#mikrofon'); await s.waitForSelector('#sayfa.acik #ses-yazi');
  await konus(s, 'x'.repeat(300), true);
  denet((await s.locator('#ses-yazi').boundingBox()).height <= 150, 'ses: çok uzun cümle dinleme sayfasını taşırmaz');
  await konus(s, 'Abdurrahman'.repeat(9) + ' saat 3 saç');
  await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-tarih').inputValue() === '2026-11-21' && (await s.locator('#f-duyulan').innerText()).includes('Gün söylenmedi'), 'ses: gün söylenmezse bugüne yazar ve bunu belirtir (geçmiş güne değil)');
  denet((await s.locator('#f-ad').inputValue()).length === 60, 'ses: 60 karakterden uzun isim kesilir');
  await s.click('#sayfa-kapat');
  denet(await s.evaluate(() => { const m = document.querySelector('#mikrofon'); m.click(); const ilk = window.__ses; m.click(); return ilk.iptal === true && window.__ses !== ilk; }), 'ses: ikinci başlatma ilk dinlemeyi durdurur');
  await s.click('#ses-vazgec');
  await s.click('#bugun'); await s.click('#sonraki'); // boş Pazar
  await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  denet(await s.evaluate(() => { const a = [...document.querySelectorAll('.dilim.bos .arti')].pop().getBoundingClientRect(); const e = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2); return !!e && !!e.closest('.dilim.bos'); }), 'ses: mikrofon son boş saatin + düğmesini örtmez');
  await cek(s, '26-gun-alt');
  await baglam.close();
}
{
  // istatistik: işlem yeniden adlandırma, canlı tazeleme, gelecek dönem, "Geldi"
  const { baglam, s } = await ac('light');
  await s.click('[data-sekme="ist"]'); await s.waitForSelector('#ist-kisi');
  const sacOnce = (await s.locator('.dagilim-satir', { hasText: /^Saç\s*\d/ }).first().innerText()).match(/(\d+) kişi/)[1];
  await s.click('[data-sekme="ayar"]');
  await s.locator('.islem-satir').first().click(); await s.fill('#i-ad', 'Saç   Kesimi'); await s.click('#i-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).islemler[0].ad === 'Saç Kesimi', 'işlem: addaki fazla boşluklar teke iner');
  await s.click('[data-sekme="ist"]');
  const satir = s.locator('.dagilim-satir', { hasText: 'Saç Kesimi' });
  denet(await satir.count() === 1 && (await satir.innerText()).includes(sacOnce + ' kişi') && await s.locator('.dagilim-satir', { hasText: /^Saç\s*\d/ }).count() === 0, 'işlem: yeniden adlandırınca istatistik bölünmez');
  denet(await satir.locator('.dagilim-iz div').evaluate(e => getComputedStyle(e).backgroundColor) === 'rgb(47, 111, 222)', 'işlem: yeniden adlandırılan işlem rengini korur');

  await s.click('[data-tur="gun"]');
  const once = Number(await s.locator('#ist-kisi').innerText());
  await s.clock.fastForward('03:00:00');
  denet(Number(await s.locator('#ist-kisi').innerText()) === bekle('gun', '2026-11-21').kisi + 0 || Number(await s.locator('#ist-kisi').innerText()) > once, 'istatistik: ekran açıkken saat ilerleyince sayı güncellenir');
  await s.click('[data-tur="ay"]'); await s.click('#ist-sonraki');
  const gelecek = await s.locator('#govde').innerText();
  denet(gelecek.includes('henüz başlamadı') && !/\d+ az\b/.test(gelecek) && !gelecek.includes('kayıt yok'), 'istatistik: gelecek dönemde yanıltıcı karşılaştırma yok');
  await s.click('#ist-onceki'); await s.click('[data-tur="hafta"]'); await s.click('#ist-sonraki'); // 23–29 Kasım
  denet((await s.locator('#ist-etiket').innerText()) === '23–29 Kasım 2026' && /\d+ randevu yazılı/.test(await s.locator('#ist-fark').innerText()), 'istatistik: gelecek haftadaki yazılı randevu sayısı gösterilir');
  await cek(s, '27-ist-gelecek');
  await baglam.close();
}
{
  // "Geldi" saati gelmeden işaretlenirse sayılır; fiyat yazımı
  const veri = BR.varsayilanVeri();
  veri.islemler[0].fiyat = 99.9;
  veri.randevular.push({ id: 'g', tarih: '2026-11-21', saat: '18:00', sure: 30, ad: 'Erken Gelen', tel: '', islemId: 'sac', islemAd: 'Saç', fiyat: 99.9, durum: 'bekliyor', not: '' });
  const { baglam, s } = await ac('light', JSON.stringify(veri));
  await s.locator('.rnd', { hasText: 'Erken Gelen' }).click();
  denet((await s.locator('.bilgi').innerText()).includes('99,90 ₺'), 'fiyat: kuruşlu fiyat iki haneli gösterilir');
  await s.click('[data-durum="geldi"]');
  await s.click('#a-duzenle'); await s.waitForSelector('#sayfa.acik #f-ad');
  denet(await s.locator('#f-fiyat').inputValue() === '99,9', 'fiyat: düzenleme alanında virgülle yazılır');
  await s.click('#f-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).randevular[0].fiyat === 99.9, 'fiyat: dokunmadan kaydedince değişmez');
  await s.click('[data-sekme="ist"]'); await s.click('[data-tur="gun"]');
  denet((await s.locator('#ist-kisi').innerText()) === '1' && (await s.locator('#ist-ciro').innerText()) === '99,90 ₺', 'istatistik: saati gelmeden "Geldi" işaretlenen sayılır');
  // dükkân adı yazarken kaydedilir
  await s.click('[data-sekme="ayar"]');
  await s.fill('#a-dukkan', 'Yazarken Kaydet');
  denet((await kayit(s)).ayar.dukkan === 'Yazarken Kaydet' && (await s.locator('#baslik-dukkan').innerText()) === 'Yazarken Kaydet', 'ayar: dükkân adı yazılırken kaydedilir');
  // kayıt başarısız olursa sessiz kalmaz, yedek yükleme yarım kalmaz
  await s.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('dolu', 'QuotaExceededError'); }; });
  await s.click('[data-sekme="gun"]');
  await s.locator('.rnd', { hasText: 'Erken Gelen' }).click();
  await s.click('[data-durum="gelmedi"]');
  denet(await s.locator('#bildirim.acik').count() === 1 && (await s.locator('#bildirim').innerText()).includes('Kaydedilemedi'), 'depo: durum değişikliği kaydedilemezse uyarı görünür');
  await s.click('#sayfa-kapat');
  await s.click('[data-sekme="ayar"]');
  const kucuk = BR.varsayilanVeri(); kucuk.ayar.dukkan = 'Yüklenemeyen';
  await s.setInputFiles('#yedek-dosya', { name: 'y.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(kucuk)) });
  await s.waitForSelector('#sayfa.acik #yukle-evet');
  await s.click('#yukle-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await s.locator('#baslik-dukkan').innerText()) === 'Yazarken Kaydet' && (await s.locator('#bildirim').innerText()).includes('değiştirilmedi'), 'depo: yedek kaydedilemezse eski veri ekranda kalır');
  await baglam.close();
}
{
  const { baglam, s } = await ac('light');
  await s.click('[data-sekme="ayar"]');
  const kucuk = BR.varsayilanVeri();
  await s.setInputFiles('#yedek-dosya', { name: 'y.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(kucuk)) });
  await s.waitForSelector('#sayfa.acik #yukle-evet');
  denet((await s.locator('#sayfa .metin').innerText()).includes('örnek'), 'yedek: örnek veriler açıkken onay yazısı örnek verilerden söz eder');
  await baglam.close();
}

{
  // telefon otomatik doldurma, saat seçenekleri, perde, çift dokunuş
  const veri = BR.varsayilanVeri();
  const m = (id, ad, tel, tarih) => ({ id, tarih, saat: '10:00', sure: 30, ad, tel, islemId: 'sac', islemAd: 'Saç', fiyat: null, durum: 'bekliyor', not: '' });
  veri.randevular.push(m('a', 'Ahmet', '0532 111 11 11', '2026-11-10'), m('b', 'Ahmet Kaya', '0544 222 22 22', '2026-11-11'));
  const { baglam, s } = await ac('light', JSON.stringify(veri));
  // sayfa açıldıktan hemen sonraki dokunuşlar bilerek yok sayılır; insan hızında bekle
  const dokun = async (sec, kez, ara) => { await s.waitForTimeout(500); const k = await s.locator(sec).first().boundingBox(); for (let i = 0; i < kez; i++) { await s.mouse.click(k.x + k.width / 2, k.y + k.height / 2); if (i < kez - 1) await s.waitForTimeout(ara); } };
  await s.click('#fab'); await s.waitForSelector('#sayfa.acik #f-ad');
  await s.fill('#f-ad', 'Ahmet');
  denet(await s.locator('#f-tel').inputValue() === '0532 111 11 11', 'telefon: tam eşleşen müşterinin telefonu gelir');
  await s.fill('#f-ad', 'Ahmet Kaya');
  denet(await s.locator('#f-tel').inputValue() === '0544 222 22 22', 'telefon: isim uzayınca doğru müşterinin telefonuna döner');
  await s.fill('#f-ad', 'Ahmet Demir');
  denet(await s.locator('#f-tel').inputValue() === '', 'telefon: yeni bir isimde otomatik gelen telefon silinir');
  await s.fill('#f-tel', '0555 000'); await s.fill('#f-ad', 'Ahmet');
  denet(await s.locator('#f-tel').inputValue() === '0555 000', 'telefon: elle yazılan telefon değiştirilmez');
  const secenek = await s.locator('#f-saat option').allInnerTexts();
  denet(secenek.includes('07:00') && secenek.includes('22:30') && secenek.includes('09:00'), 'form: çalışma saati dışı da seçilebilir');
  denet(await s.locator('#f-tarih').getAttribute('min') === '2000-01-01' && await s.locator('#f-tarih').getAttribute('max') === '2099-12-31', 'form: tarih alanında yıl sınırı var');
  await s.waitForTimeout(450); await s.mouse.click(195, 20); await s.waitForTimeout(450);
  denet(await s.locator('#sayfa.acik #f-ad').count() === 1, 'form: perdeye dokunmak yarım formu kapatmaz');
  await s.click('#sayfa-kapat'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });

  await s.locator('.dilim.bos[data-saat="16:00"]').click(); await s.waitForSelector('#sayfa.acik #f-ad');
  await s.fill('#f-ad', 'Çift Dokunuş'); await s.locator('#f-ad').blur();
  await dokun('#f-kaydet', 2, 250);
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' }); await s.waitForTimeout(500);
  denet(await s.locator('#sekmeler [data-sekme="gun"]').getAttribute('aria-current') === 'page' && (await kayit(s)).randevular.filter(r => r.ad === 'Çift Dokunuş').length === 1, 'çift dokunuş: Kaydet\'e iki kez basmak sekme değiştirmez, tek kayıt oluşur');
  await s.click('#fab'); await s.waitForSelector('#sayfa.acik #f-ad');
  await s.fill('#f-ad', 'Çakışan'); await s.selectOption('#f-saat', '16:00'); await s.locator('#f-ad').blur();
  await dokun('#f-kaydet', 2, 150);
  await s.waitForTimeout(300);
  denet(await s.locator('#f-cakisma').isVisible() && !(await kayit(s)).randevular.some(r => r.ad === 'Çakışan'), 'çift dokunuş: çakışma uyarısı okunmadan kaydedilmez');
  await s.waitForTimeout(700); await dokun('#f-kaydet', 1, 0);
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' }); await s.waitForTimeout(500);
  denet((await kayit(s)).randevular.filter(r => r.ad === 'Çakışan').length === 1, 'çift dokunuş: uyarıdan sonra bilinçli dokunuş kaydeder');
  await dokun('.rnd', 2, 150); await s.waitForTimeout(500);
  denet((await kayit(s)).randevular.every(r => r.durum === 'bekliyor'), 'çift dokunuş: randevuya iki kez dokunmak durumunu değiştirmez');
  await s.click('#sayfa-kapat');
  // yeni kaydedilen randevu ekranda görünür
  await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await s.click('#fab'); await s.waitForSelector('#sayfa.acik #f-ad');
  await s.fill('#f-ad', 'Sabah Erken'); await s.fill('#f-tarih', '2026-11-23'); await s.selectOption('#f-saat', '09:00'); await s.click('#f-kaydet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' }); await s.waitForTimeout(400);
  const kutu = await s.locator('.rnd', { hasText: 'Sabah Erken' }).boundingBox();
  denet(kutu && kutu.y > 150 && kutu.y + kutu.height < 780, 'form: yeni kaydedilen randevu ekrana kaydırılır');
  await baglam.close();
}
{
  // "+ Randevu" geçmiş saat önermez
  const a = await ac('light', JSON.stringify(BR.varsayilanVeri()), false, null, '2026-11-21T21:10:00+03:00');
  await a.s.click('#fab'); await a.s.waitForSelector('#sayfa.acik #f-ad');
  denet(await a.s.locator('#f-tarih').inputValue() === '2026-11-23' && await a.s.locator('#f-saat').inputValue() === '09:00', 'form: kapanıştan sonra "+ Randevu" bir sonraki açık günü önerir');
  await a.baglam.close();
  const b = await ac('light');
  await b.s.click('#fab'); await b.s.waitForSelector('#sayfa.acik #f-ad');
  denet(await b.s.locator('#f-tarih').inputValue() === '2026-11-21' && await b.s.locator('#f-saat').inputValue() === '14:30', 'form: gün içinde "+ Randevu" şimdiden sonraki ilk boş saati önerir');
  await b.s.click('#sayfa-kapat');
  // örnek kayıtlar ve metinler
  denet(await b.s.locator('#ornek-serit').isVisible() && (await b.s.locator('#ornek-serit').boundingBox()).y < 400, 'örnek: açıklama şeridi ilk açılışta ekranda');
  denet((await b.s.locator('#temiz-basla').innerText()) === 'Örnekleri sil', 'metin: örnekleri silme düğmesi her yerde aynı adı taşır');
  await b.s.locator('.rnd').first().click(); await b.s.waitForSelector('#sayfa.acik');
  denet(await b.s.locator('#a-ara').count() === 0 && await b.s.locator('#a-wa').count() === 0, 'örnek: örnek kayıtlarda arama ve WhatsApp bağlantısı yok');
  await b.s.click('#sayfa-kapat');
  denet(await b.s.locator('meta[name="description"]').count() === 1 && await b.s.locator('meta[name="color-scheme"]').count() === 1, 'sayfa: açıklama ve renk şeması etiketleri var');
  await b.s.click('[data-sekme="ayar"]');
  denet((await b.s.locator('#ornek-sil').innerText()) === 'Örnekleri sil', 'metin: ayarlardaki düğme de "Örnekleri sil"');
  await b.baglam.close();
  const c = await ac('light', undefined, false, null, '2026-11-21T11:00:00+03:00');
  denet(await c.s.evaluate(() => document.querySelector('.simdi').nextElementSibling.querySelector('.saat').textContent) === '11:00', 'gün: tam saat başında şimdi çizgisi o saatin üstünde durur');
  await c.baglam.close();
}
{
  // Pazar günü açılan demo boş görünmez
  const { baglam, s } = await ac('light', undefined, false, null, '2026-11-22T12:00:00+03:00');
  denet((await s.locator('#baslik-tarih').innerText()).includes('23 Kasım') && await s.locator('.rnd').count() >= 3, 'örnek: kapalı günde açılan demo ilk açık günü gösterir');
  denet((await s.locator('#ornek-serit').innerText()).includes('kapalı'), 'örnek: neden başka günün gösterildiği yazılır');
  await cek(s, '28-demo-pazar');
  await baglam.close();
}
{
  // demo donmaz: bir değişiklikten günler sonra açılınca örnekler bugüne göre yenilenir, kullanıcının kaydı kalır
  const a = await ac('light');
  await a.s.locator('.dilim.bos').first().click(); await a.s.waitForSelector('#sayfa.acik #f-ad');
  await a.s.fill('#f-ad', 'Benim Müşterim'); await a.s.click('#f-kaydet'); await a.s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const depo = await a.s.evaluate(() => localStorage.getItem('berber-v1'));
  await a.baglam.close();
  const { baglam, s } = await ac('light', depo, false, null, '2026-11-30T10:00:00+03:00');
  denet((await s.locator('#baslik-tarih').innerText()).includes('30 Kasım') && await s.locator('.rnd').count() >= 6, 'örnek: günler sonra açılan demo yine dolu');
  await s.fill('#tarih-sec', '2026-11-21');
  denet(await s.locator('.rnd', { hasText: 'Benim Müşterim' }).count() === 1, 'örnek: yenilenirken kullanıcının kendi randevusu korunur');
  await baglam.close();
}
{
  // iki pencere: biri diğerinin kaydını ezmez
  const { baglam, s: A } = await ac('light', JSON.stringify(BR.varsayilanVeri()));
  const B = await baglam.newPage();
  await B.clock.install({ time: new Date('2026-11-21T14:25:00+03:00') });
  await B.goto(adres); await B.waitForSelector('.dilim');
  const ekle = async (sayfa, ad, saat) => { await sayfa.locator(`.dilim.bos[data-saat="${saat}"]`).click(); await sayfa.waitForSelector('#sayfa.acik #f-ad'); await sayfa.fill('#f-ad', ad); await sayfa.click('#f-kaydet'); await sayfa.waitForSelector('#sayfa:not(.acik)', { state: 'attached' }); };
  await ekle(A, 'A Penceresi', '15:00');
  await B.waitForSelector('.rnd');
  denet(await B.locator('.rnd', { hasText: 'A Penceresi' }).count() === 1, 'iki pencere: diğer pencerede yapılan kayıt bu pencerede de görünür');
  await ekle(B, 'B Penceresi', '16:00');
  const adlar = (await kayit(B)).randevular.map(r => r.ad).sort();
  denet(adlar.length === 2 && adlar[0] === 'A Penceresi' && adlar[1] === 'B Penceresi', 'iki pencere: iki pencerenin kayıtları da saklanır');
  await baglam.close();
}
{
  // bir dosya yüklenemezse boş ekran yerine açıklama
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const s = await baglam.newPage();
  await s.route('**/hesap.js', r => r.abort());
  await s.goto(adres);
  await s.waitForSelector('#yuklenemedi', { timeout: 5000 }).catch(() => {});
  denet(await s.locator('#yuklenemedi').count() === 1 && !(await s.locator('#fab').isVisible()) && !(await s.locator('#sekmeler').isVisible()), 'açılış: dosya yüklenemezse açıklama gösterilir, ölü düğmeler görünmez');
  await baglam.close();
}
{
  // çevrimdışı kopya: adres parametreli açılışlar tek kayıt altında tutulur
  const { baglam, s } = await ac('light', undefined, true);
  await s.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 6000))]));
  await s.goto(adres + '?fbclid=WA1'); await s.waitForSelector('.rnd'); await s.waitForTimeout(600);
  const anahtarlar = await s.evaluate(async () => { const ad = (await caches.keys()).find(k => k.startsWith('berber-')); return [ad, ...(await (await caches.open(ad)).keys()).map(r => r.url)]; });
  denet(anahtarlar[0] === 'berber-v3' && !anahtarlar.some(u => u.includes('?')), 'çevrimdışı: önbellekte parametreli adres tutulmaz');
  await baglam.setOffline(true); hatalar.length = 0;
  await s.goto(adres + '?fbclid=WA2').catch(() => {});
  denet(await s.waitForSelector('.rnd', { timeout: 6000 }).then(() => true, () => false), 'çevrimdışı: parametreli bağlantı internetsiz de açılır');
  hatalar.length = 0;
  await baglam.close();
}

/* ---------- giderler ---------- */
{
  const { baglam, s } = await ac('light');
  denet(await s.locator('#sekmeler button').count() === 4, 'gider: alt çubukta dört sekme var');
  await s.click('#sekmeler [data-sekme="gider"]'); await s.waitForSelector('#gider-toplam');
  const ayToplam = ay => Math.round(ORNEK.giderler.filter(g => g.tarih.startsWith(ay)).reduce((t, g) => t + g.tutar, 0) * 100) / 100;
  const kasim = ORNEK.giderler.filter(g => g.tarih.startsWith('2026-11'));
  denet((await s.locator('#gider-ay').innerText()) === 'Kasım 2026' && (await s.locator('#gider-toplam').innerText()) === BR.paraYaz(ayToplam('2026-11')), 'gider: açılışta bu ayın toplamı');
  denet(await s.locator('.gider').count() === kasim.length && kasim.length >= 5, 'gider: ayın giderleri listelenir');
  denet(await s.locator('.sabit').count() === 2 && (await s.locator('.sabit').first().innerText()).includes('Her ayın 1’i'), 'gider: her ay tekrar edenler listelenir');
  denet((await s.locator('.gider').first().boundingBox()).height >= 48 && (await s.locator('#gider-fab').boundingBox()).height >= 48, 'gider: satırlar ve düğme en az 48 px');
  denet(!(await s.locator('#fab').isVisible()) && !(await s.locator('#mikrofon').isVisible()), 'gider: randevu düğmeleri bu sekmede görünmez');
  await tasmaYok(s, 'giderler');
  await cek(s, '29-gider');

  await s.click('#gider-fab'); await s.waitForSelector('#sayfa.acik #gd-tutar');
  denet(await s.locator('#gd-tarih').inputValue() === '2026-11-21', 'gider formu: tarih bugün gelir');
  await s.click('#gd-kaydet');
  denet(await s.locator('#gd-hata').isVisible() && await s.locator('#sayfa.acik').count() === 1, 'gider formu: tutarsız kaydedilmez');
  await s.fill('#gd-tutar', '1.250');
  denet(!(await s.locator('#gd-hata').isVisible()), 'gider formu: tutar yazılınca uyarı kalkar');
  await s.click('.tur-sec[data-gtur="Vergi"]'); await s.click('.tur-sec[data-gtur="Malzeme"]'); await s.fill('#gd-not', '<i>Makas</i>');
  denet(await s.locator('.tur-sec[aria-pressed="true"]').count() === 1 && await s.locator('.tur-sec[data-gtur="Malzeme"]').getAttribute('aria-pressed') === 'true', 'gider formu: tür seçimi tek ve doğru');
  await cek(s, '30-gider-form');
  await s.click('#gd-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const yeni = (await kayit(s)).giderler.find(g => g.not === '<i>Makas</i>');
  denet(yeni && yeni.tutar === 1250 && yeni.tur === 'Malzeme' && yeni.tarih === '2026-11-21' && !yeni.ornek && !yeni.sabitId, 'gider formu: gider kaydedilir ("1.250" bin iki yüz elli)');
  denet(await s.locator('.gider', { hasText: '<i>Makas</i>' }).count() === 1 && await s.locator('.gider i').count() === 0, 'gider: not düz metin olarak görünür');
  denet((await s.locator('#gider-toplam').innerText()) === BR.paraYaz(ayToplam('2026-11') + 1250), 'gider: toplam güncellenir');

  await s.locator('.gider', { hasText: '<i>Makas</i>' }).click(); await s.waitForSelector('#sayfa.acik #gd-tutar');
  denet(await s.locator('#gd-tutar').inputValue() === '1250' && await s.locator('.tur-sec[data-gtur="Malzeme"]').getAttribute('aria-pressed') === 'true' && await s.locator('#gd-tekrar').count() === 0, 'gider formu: düzenleme mevcut bilgilerle açılır');
  await s.fill('#gd-tutar', '1.300,50'); await s.click('#gd-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet((await kayit(s)).giderler.filter(g => g.not === '<i>Makas</i>').length === 1 && (await kayit(s)).giderler.find(g => g.not === '<i>Makas</i>').tutar === 1300.5 && (await s.locator('.gider', { hasText: 'Makas' }).innerText()).includes('1.300,50 ₺'), 'gider formu: düzenleme aynı kaydı günceller');
  // yedekte giderler de var
  const adet = (await kayit(s)).giderler.length;
  await s.click('#sekmeler [data-sekme="ayar"]');
  const [inen] = await Promise.all([s.waitForEvent('download'), s.click('#yedek-indir')]);
  const yedek = JSON.parse(await readFile(await inen.path(), 'utf8'));
  denet(yedek.giderler.length === adet && yedek.sabitGiderler.length === 2, 'yedek: giderler ve sabit giderler yedekte');
  await s.click('#sekmeler [data-sekme="gider"]');
  await s.locator('.gider', { hasText: 'Makas' }).click(); await s.click('#gd-sil'); await s.click('#gd-sil-evet');
  await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  denet(!(await kayit(s)).giderler.some(g => g.not === '<i>Makas</i>') && await s.locator('.gider', { hasText: 'Makas' }).count() === 0, 'gider: silinen gider kalkar');

  await s.click('#gider-onceki');
  denet((await s.locator('#gider-ay').innerText()) === 'Ekim 2026' && (await s.locator('#gider-toplam').innerText()) === BR.paraYaz(ayToplam('2026-10')), 'gider: önceki aya geçilir');
  await s.click('#gider-sonraki'); await s.click('#gider-sonraki');
  denet((await s.locator('#gider-ay').innerText()) === 'Aralık 2026' && await s.locator('#gider-bos').isVisible() && await s.locator('.gider').count() === 0, 'gider: gider olmayan ayda açıklama çıkar');

  // istatistikte kasa: ciro, gider, kalan
  await s.click('#sekmeler [data-sekme="ist"]'); await s.waitForSelector('#ist-kisi');
  const st = BR.istatistik(ORNEK.randevular, 'ay', '2026-11-21', SIMDI, ORNEK.giderler);
  denet((await s.locator('#kasa-ciro').innerText()) === BR.paraYaz(st.ciro) && (await s.locator('#kasa-gider').innerText()) === BR.paraYaz(st.gider) && (await s.locator('#kasa-kalan').innerText()) === BR.paraYaz(st.ciro - st.gider), 'kasa: ciro, gider ve kalan hesapla aynı');
  denet(await s.locator('.kasa-satir').count() === st.giderDagilim.length && (await s.locator('.kasa-satir').first().innerText()).includes(st.giderDagilim[0].ad), 'kasa: giderlerin türlere dağılımı');
  denet(await s.locator('#kasa-not').count() === 0, 'kasa: bütün fiyatlar giriliyse uyarı yok');
  await s.locator('#kasa-kalan').scrollIntoViewIfNeeded();
  await tasmaYok(s, 'kasa');
  await cek(s, '31-ist-kasa');
  await s.click('[data-tur="yil"]');
  const yl = BR.istatistik(ORNEK.randevular, 'yil', '2026-11-21', SIMDI, ORNEK.giderler);
  denet((await s.locator('#kasa-kalan').innerText()) === BR.paraYaz(yl.ciro - yl.gider) && yl.ciro - yl.gider > 0, 'kasa: yıllık kalan hesapla aynı');
  await baglam.close();
}
{
  // her ay tekrarlanan gider
  const { baglam, s } = await ac('light', JSON.stringify(BR.varsayilanVeri()));
  await s.click('#sekmeler [data-sekme="gider"]'); await s.waitForSelector('#gider-toplam');
  denet(await s.locator('#gider-bos').isVisible() && await s.locator('.sabit').count() === 0, 'gider: boş defterde açıklama çıkar');
  await s.click('#sekmeler [data-sekme="ist"]');
  denet(await s.locator('#kasa-gider').count() === 0, 'kasa: gider yoksa kasa bölümü görünmez');
  await s.click('#sekmeler [data-sekme="gider"]');
  await s.click('#gider-fab'); await s.waitForSelector('#sayfa.acik #gd-tutar');
  await s.fill('#gd-tutar', '500'); await s.click('.tur-sec[data-gtur="Fatura"]'); await s.fill('#gd-tarih', '2026-11-10'); await s.fill('#gd-not', 'İnternet');
  await s.click('#gd-tekrar');
  denet(await s.locator('#gd-tekrar').getAttribute('aria-pressed') === 'true', 'gider formu: "Her ay tekrarla" açılır');
  await s.click('#gd-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  let k = await kayit(s);
  denet(k.sabitGiderler.length === 1 && k.sabitGiderler[0].gun === 10 && k.sabitGiderler[0].tutar === 500 && k.sabitGiderler[0].tur === 'Fatura' && k.sabitGiderler[0].sonAy === '2026-11', 'tekrar: sabit gider oluşur');
  denet(k.giderler.length === 1 && k.giderler[0].tarih === '2026-11-10' && k.giderler[0].sabitId === k.sabitGiderler[0].id, 'tekrar: bu ayın gideri de yazılır');
  denet((await s.locator('.sabit').innerText()).includes('Her ayın 10’u') && (await s.locator('.sabit').innerText()).includes('500 ₺'), 'tekrar: listede gün ve tutar görünür');
  await s.locator('.sabit').click(); await s.waitForSelector('#sayfa.acik #sb-tutar');
  denet(await s.locator('#sb-tutar').inputValue() === '500' && await s.locator('#sb-gun').inputValue() === '10', 'tekrar: düzenleme mevcut bilgilerle açılır');
  await s.fill('#sb-tutar', '700'); await s.click('#sb-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  k = await kayit(s);
  denet(k.sabitGiderler[0].tutar === 700 && k.giderler[0].tutar === 500, 'tekrar: tutar değişince yazılmış ay değişmez');
  const depo = await s.evaluate(() => localStorage.getItem('berber-v1'));
  await baglam.close();

  const b = await ac('light', depo, false, null, '2027-01-15T10:00:00+03:00');
  k = await kayit(b.s);
  denet(k.giderler.length === 3 && k.giderler.map(g => g.tarih + ' ' + g.tutar).sort().join('|') === '2026-11-10 500|2026-12-10 700|2027-01-10 700' && k.sabitGiderler[0].sonAy === '2027-01', 'tekrar: iki ay sonra açılınca aradaki aylar yeni tutarla yazılır ve kaydedilir');
  await b.s.click('#sekmeler [data-sekme="gider"]');
  denet((await b.s.locator('#gider-ay').innerText()) === 'Ocak 2027' && await b.s.locator('.gider').count() === 1 && (await b.s.locator('.gider').innerText()).includes('her ay'), 'tekrar: yeni ayın gideri listede, "her ay" işaretiyle');
  await b.s.locator('.sabit').click(); await b.s.click('#sb-sil'); await b.s.click('#sb-sil-evet');
  await b.s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  k = await kayit(b.s);
  denet(k.sabitGiderler.length === 0 && k.giderler.length === 3, 'tekrar: sabit gider silinince yazılmış aylar kalır');
  await b.baglam.close();
}
{
  // gider alanı olmayan eski kayıt; fiyatı girilmemiş randevu uyarısı
  const eski = { ayar: { dukkan: 'Eski Kayıt', kapali: [] }, islemler: BR.varsayilanVeri().islemler, randevular: [
    { id: 'a', tarih: '2026-11-05', saat: '10:00', sure: 30, ad: 'Fiyatlı', tel: '', islemId: 'sac', islemAd: 'Saç', fiyat: 400, durum: 'bekliyor', not: '' },
    { id: 'b', tarih: '2026-11-06', saat: '10:00', sure: 30, ad: 'Fiyatsız', tel: '', islemId: 'sac', islemAd: 'Saç', fiyat: null, durum: 'bekliyor', not: '' }] };
  const { baglam, s } = await ac('dark', JSON.stringify(eski));
  await s.click('#sekmeler [data-sekme="gider"]'); await s.waitForSelector('#gider-toplam');
  denet(await s.locator('#gider-bos').isVisible() && (await s.locator('#gider-toplam').innerText()) === '0 ₺', 'gider: gider alanı olmayan eski kayıt sorunsuz açılır');
  await s.click('#gider-fab'); await s.waitForSelector('#sayfa.acik #gd-tutar');
  await s.fill('#gd-tutar', '150'); await s.click('#gd-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  await cek(s, '32-gider-koyu');
  await s.click('#sekmeler [data-sekme="ist"]'); await s.waitForSelector('#kasa-kalan');
  denet((await s.locator('#kasa-kalan').innerText()) === '250 ₺' && (await s.locator('#kasa-not').innerText()).includes('1 randevunun fiyatı'), 'kasa: fiyatı girilmemiş randevu varsa bunu söyler');
  await baglam.close();
}
{
  // örnekleri sil: örnek giderler gider, kendi eklenen kalır
  const { baglam, s } = await ac('light');
  await s.click('#sekmeler [data-sekme="gider"]'); await s.waitForSelector('#gider-toplam');
  await s.click('#gider-fab'); await s.waitForSelector('#sayfa.acik #gd-tutar');
  await s.fill('#gd-tutar', '99,90'); await s.click('#gd-kaydet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  await s.click('#sekmeler [data-sekme="ayar"]'); await s.click('#ornek-sil');
  denet((await s.locator('#sayfa .metin').innerText()).includes('gider'), 'örnek: onay yazısı giderlerden de söz eder');
  await s.click('#temiz-evet'); await s.waitForSelector('#sayfa:not(.acik)', { state: 'attached' });
  const k = await kayit(s);
  denet(k.giderler.length === 1 && k.giderler[0].tutar === 99.9 && k.sabitGiderler.length === 0, 'örnek: örnek giderler silinir, kendi eklenen kalır');
  await baglam.close();
}

/* EK-DENETIMLER */

await tarayici.close();
sunucu.close();
denet(hatalar.length === 0, 'konsol hatası yok' + (hatalar.length ? ': ' + hatalar.slice(0, 3).join(' | ') : ''));
console.log(`${gecen} denetim geçti, ${dusen.length} düştü. Görüntüler: ${cikti}`);
process.exit(dusen.length ? 1 : 0);
