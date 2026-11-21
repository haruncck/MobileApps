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
async function ac(tema, depo) {
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: tema, serviceWorkers: 'block' });
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

/* EK-DENETIMLER */

await tarayici.close();
sunucu.close();
denet(hatalar.length === 0, 'konsol hatası yok' + (hatalar.length ? ': ' + hatalar.slice(0, 3).join(' | ') : ''));
console.log(`${gecen} denetim geçti, ${dusen.length} düştü. Görüntüler: ${cikti}`);
process.exit(dusen.length ? 1 : 0);
