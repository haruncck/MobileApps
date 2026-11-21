# Berber Randevu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Berberin gün içindeki randevularını saat saat gördüğü ve günlük/aylık/yıllık kişi sayılarını izlediği, telefonda çalışan çevrimdışı web uygulaması.

**Architecture:** `berber/` klasöründe derleme adımı olmayan PWA. Saf hesap fonksiyonları `hesap.js` ve `ornek.js` içinde `globalThis.BR` nesnesine bağlanır (Node'da `module.exports`), arayüz `index.html` içindedir ve yalnızca `BR` üzerinden hesap yapar. Veri `localStorage` anahtarı `berber-v1`.

**Tech Stack:** Düz HTML/CSS/JS (kütüphane yok), `node:test` (Node 22), Playwright + Chrome ile ekran doğrulaması, Pillow ile ikon üretimi.

**Spec:** `_kaynak/berber/2026-11-21-berber-randevu-design.md`

## Global Constraints

- Dış bağımlılık yok: CDN, kütüphane, uzak font yok; çevrimdışı açılmalı.
- Veri: `localStorage["berber-v1"]`, tek JSON; tarihler yerel `YYYY-AA-GG`, saatler `SS:DD`.
- Dil Türkçe, 24 saat, hafta Pazartesi başlar, para birimi ₺.
- Dokunma alanları en az 48 px; telefon dikey öncelikli; açık/koyu tema sistem ayarını izler.
- Varsayılanlar: açılış `09:00`, kapanış `21:00`, adım `30`, kapalı gün `[0]` (Pazar).
- Sayım kuralı: başlangıcı geçmiş ve durumu `gelmedi`/`iptal` olmayan randevu sayılır.
- Depo ana sayfası `index.html` değiştirilmez.
- Kullanıcı metni HTML'e her zaman kaçışlı (`BR.kacis`) ya da `textContent` ile yazılır.

## Review Focus

1. Bozuk/boş `localStorage` ya da depolama kapalı (gizli sekme): uygulama boş ekran yerine varsayılan veriyle açılır. → Task 3 `dogrula` testleri, Task 4 yükleme sarmalı.
2. Yanlış dosyadan yedek yükleme (JSON değil, alan eksik): reddedilir, mevcut veri dokunulmaz. → Task 3.
3. Ay/yıl sonu ve 29 Şubat'ta gün kaydırma ve dönem sınırları. → Task 1 ve 2.
4. İsimde Türkçe büyük/küçük harf (İ/i, I/ı) ve HTML karakterleri: öneri eşleşir, isim metin olarak görünür. → Task 3.
5. Randevusu olan işlem silinir/yeniden adlandırılır: geçmiş adını ve fiyatını korur; boş dönemde yüzde hesabı sıfıra bölmez. → Task 2.

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `berber/hesap.js` | Saf fonksiyonlar: saat/tarih, dilim, çakışma, sayım, dönem, istatistik, doğrulama, öneri |
| `berber/ornek.js` | Sabit tohumlu örnek veri üretici |
| `berber/index.html` | Arayüz, depolama, olaylar (üç sekme + alttan açılan sayfalar) |
| `berber/sw.js`, `berber/manifest.webmanifest`, `berber/icon-192.png`, `berber/icon-512.png` | PWA kabuğu |
| `_kaynak/berber/test/*.test.js` | `node:test` testleri |
| `_kaynak/berber/ikon.py`, `_kaynak/berber/ekran.mjs` | İkon üretimi, ekran görüntüsü betiği |

Testler: `node --test _kaynak/berber/test/`

---

### Task 1: Saat, tarih, dilim, çakışma

**Files:** Create `berber/hesap.js`, `_kaynak/berber/test/zaman.test.js`

**Interfaces — Produces** (hepsi `BR.` altında):
- `dakika(saat: string) -> number`, `saatYaz(dk: number) -> string`
- `tarihYaz(d: Date) -> string`, `tarihOku(s: string) -> Date` (yerel gece yarısı), `gunEkle(s: string, n: number) -> string`
- `dilimler(ayar, gunRandevulari) -> string[]` — açılıştan kapanışa adım adım başlangıç saatleri; saat dışı randevuları kapsayacak şekilde uzar
- `cakisanlar(randevular, aday: {id?, tarih, saat, sure}) -> randevu[]` — aynı `id` ve `iptal` hariç
- `gunOzeti(ayar, randevular, tarih) -> {randevu: number, bosDilim: number}` — `iptal` sayılmaz
- `kacis(s: string) -> string` — `& < > " '` kaçışı

- [ ] **Step 1: Failing tests**

```js
test('dakika/saatYaz', () => { eq(BR.dakika('09:30'), 570); eq(BR.saatYaz(570), '09:30'); });
test('gunEkle ay, yıl ve 29 Şubat', () => {
  eq(BR.gunEkle('2026-11-30', 1), '2026-12-01');
  eq(BR.gunEkle('2026-12-31', 1), '2027-01-01');
  eq(BR.gunEkle('2028-02-28', 1), '2028-02-29');
  eq(BR.gunEkle('2026-03-01', -1), '2026-02-28');
});
test('dilimler varsayılan', () => {
  const d = BR.dilimler({acilis:'09:00', kapanis:'21:00', adim:30}, []);
  eq(d.length, 24); eq(d[0], '09:00'); eq(d[23], '20:30');
});
test('dilimler saat dışı randevuya uzar', () => {
  const d = BR.dilimler({acilis:'09:00', kapanis:'21:00', adim:30},
    [{saat:'08:00', sure:30, durum:'bekliyor'}, {saat:'21:30', sure:45, durum:'bekliyor'}]);
  eq(d[0], '08:00'); eq(d[d.length-1], '22:00');
});
test('cakisanlar', () => {
  const rs = [{id:'a', tarih:'2026-11-21', saat:'10:00', sure:45, durum:'bekliyor'},
              {id:'b', tarih:'2026-11-21', saat:'11:00', sure:30, durum:'iptal'}];
  eq(BR.cakisanlar(rs, {tarih:'2026-11-21', saat:'10:30', sure:30}).length, 1);
  eq(BR.cakisanlar(rs, {tarih:'2026-11-21', saat:'10:45', sure:15}).length, 0); // bitişik
  eq(BR.cakisanlar(rs, {tarih:'2026-11-21', saat:'11:00', sure:30}).length, 0); // iptal
  eq(BR.cakisanlar(rs, {id:'a', tarih:'2026-11-21', saat:'10:00', sure:45}).length, 0); // kendisi
  eq(BR.cakisanlar(rs, {tarih:'2026-11-22', saat:'10:00', sure:45}).length, 0);
});
test('gunOzeti', () => {
  const ayar = {acilis:'09:00', kapanis:'11:00', adim:30};
  const rs = [{id:'a', tarih:'2026-11-21', saat:'09:00', sure:45, durum:'bekliyor'},
              {id:'b', tarih:'2026-11-21', saat:'10:30', sure:30, durum:'iptal'}];
  deepEq(BR.gunOzeti(ayar, rs, '2026-11-21'), {randevu:1, bosDilim:2}); // 10:00 ve 10:30 boş
});
test('kacis', () => eq(BR.kacis(`<b>"A&B'</b>`), '&lt;b&gt;&quot;A&amp;B&#39;&lt;/b&gt;'));
```

- [ ] **Step 2:** `node --test _kaynak/berber/test/` → FAIL (`BR` yok)
- [ ] **Step 3:** `berber/hesap.js` içinde yukarıdaki fonksiyonları yaz. Sarmal: `(function(g){ const BR = g.BR || (g.BR = {}); … if (typeof module !== 'undefined') module.exports = BR; })(globalThis)`. Tarih aritmetiği `new Date(y, m-1, d)` ile yerel yapılır, `toISOString` kullanılmaz.
- [ ] **Step 4:** testler PASS
- [ ] **Step 5:** Commit `Berber Randevu: saat, dilim ve çakışma hesapları`

### Task 2: Sayım, dönem, istatistik

**Files:** Modify `berber/hesap.js`; Create `_kaynak/berber/test/istatistik.test.js`

**Interfaces — Produces:**
- `sayilir(r, simdi: Date) -> boolean`
- `donem(tur: 'gun'|'hafta'|'ay'|'yil', tarih: string) -> {bas: string, son: string, etiket: string}` (uçlar dahil; etiket örn. `21 Kasım 2026 Cumartesi`, `16–22 Kasım 2026`, `Kasım 2026`, `2026`)
- `donemKaydir(tur, tarih, n) -> string` (ayda gün taşarsa ayın son gününe sabitlenir)
- `istatistik(randevular, tur, tarih, simdi) -> { kisi, ciro, ciroVar, gelmedi, iptal, oncekiKisi, seri: [{etiket, kisi}], islemler: [{ad, kisi, yuzde}], enYogunGun: {etiket, kisi}|null, enYogunSaat: {saat, kisi}|null }`
  - `seri`: gün → saat saat (yalnızca randevu olan saatler), hafta → 7 gün (`Pt`…`Pz`), ay → ayın her günü (`1`…), yıl → 12 ay (`Oca`…`Ara`)
  - `islemler`: `islemAd`'a göre, kişi sayısına göre azalan; `yuzde` tam sayı, `kisi===0` iken liste boş
  - `enYogunGun`: dönem içinde haftanın günü toplamı (`gun` türünde `null`); `enYogunSaat`: başlangıç saatinin saat başı (`'14:00'`)
  - `ciroVar`: sayılan randevulardan en az birinde `fiyat != null`

- [ ] **Step 1: Failing tests** (`simdi = new Date(2026, 10, 21, 15, 0)`)

```js
const r = (tarih, saat, o = {}) => ({id: tarih+saat, tarih, saat, sure:30, ad:'X', islemAd:'Saç', fiyat:null, durum:'bekliyor', ...o});
test('sayilir', () => {
  ok(BR.sayilir(r('2026-11-21','14:30'), simdi));
  ok(!BR.sayilir(r('2026-11-21','15:30'), simdi));          // henüz başlamadı
  ok(!BR.sayilir(r('2026-11-20','10:00',{durum:'gelmedi'}), simdi));
  ok(!BR.sayilir(r('2026-11-20','10:00',{durum:'iptal'}), simdi));
  ok(BR.sayilir(r('2026-11-20','10:00',{durum:'geldi'}), simdi));
});
test('donem sınırları', () => {
  deepEq(pick(BR.donem('hafta','2026-11-21')), {bas:'2026-11-16', son:'2026-11-22'}); // Pt–Pz
  deepEq(pick(BR.donem('hafta','2026-11-22')), {bas:'2026-11-16', son:'2026-11-22'}); // Pazar
  deepEq(pick(BR.donem('ay','2028-02-10')), {bas:'2028-02-01', son:'2028-02-29'});
  deepEq(pick(BR.donem('yil','2026-11-21')), {bas:'2026-01-01', son:'2026-12-31'});
  eq(BR.donem('ay','2026-11-21').etiket, 'Kasım 2026');
});
test('donemKaydir', () => {
  eq(BR.donemKaydir('ay','2026-01-31', 1), '2026-02-28');
  eq(BR.donemKaydir('yil','2028-02-29', 1), '2029-02-28');
  eq(BR.donemKaydir('hafta','2026-12-30', 1), '2027-01-06');
});
test('istatistik ay', () => {
  const rs = [ r('2026-11-02','10:00',{fiyat:300}), r('2026-11-02','10:30',{islemAd:'Sakal',fiyat:150}),
               r('2026-11-09','10:10'), r('2026-11-10','12:00',{durum:'gelmedi'}),
               r('2026-11-11','12:00',{durum:'iptal'}), r('2026-11-28','10:00'), // gelecek
               r('2026-10-15','10:00'), r('2026-10-16','10:00') ];
  const s = BR.istatistik(rs, 'ay', '2026-11-21', simdi);
  eq(s.kisi, 3); eq(s.ciro, 450); ok(s.ciroVar); eq(s.gelmedi, 1); eq(s.iptal, 1); eq(s.oncekiKisi, 2);
  eq(s.seri.length, 30); eq(s.seri[1].kisi, 2); eq(s.seri[1].etiket, '2');
  deepEq(s.islemler, [{ad:'Saç', kisi:2, yuzde:67}, {ad:'Sakal', kisi:1, yuzde:33}]);
  deepEq(s.enYogunGun, {etiket:'Pazartesi', kisi:3}); deepEq(s.enYogunSaat, {saat:'10:00', kisi:3});
});
test('istatistik boş dönem', () => {
  const s = BR.istatistik([], 'yil', '2026-11-21', simdi);
  eq(s.kisi, 0); eq(s.ciro, 0); ok(!s.ciroVar); deepEq(s.islemler, []);
  eq(s.enYogunGun, null); eq(s.enYogunSaat, null); eq(s.seri.length, 12);
});
test('silinen işlemin geçmişi adını korur', () => {
  const s = BR.istatistik([r('2026-11-03','10:00',{islemId:'yok', islemAd:'Eski İşlem', fiyat:200})], 'ay', '2026-11-21', simdi);
  deepEq(s.islemler, [{ad:'Eski İşlem', kisi:1, yuzde:100}]); eq(s.ciro, 200);
});
```

- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS
- [ ] **Step 5:** Commit `Berber Randevu: sayım kuralı ve istatistik`

### Task 3: Veri kalıbı, doğrulama, müşteri önerisi, örnek veri

**Files:** Modify `berber/hesap.js`; Create `berber/ornek.js`, `_kaynak/berber/test/veri.test.js`

**Interfaces — Produces:**
- `varsayilanVeri() -> veri` — `{ayar:{dukkan:'', acilis:'09:00', kapanis:'21:00', adim:30, kapali:[0], ornek:false}, islemler:[…7 işlem], randevular:[]}`; işlemler tasarımdaki tablo (Saç 30, Sakal 15, Saç + Sakal 45, Çocuk Tıraşı 30, Ağda 15, Yıkama + Fön 15, Cilt Bakımı 30), `fiyat:null`, her birine ayrı `renk`
- `dogrula(x: any) -> veri | null` — nesne değilse, `ayar`/`islemler`/`randevular` eksik ya da dizi değilse `null`; geçerliyse eksik ayar alanlarını varsayılanla tamamlar, `tarih`/`saat` biçimi bozuk randevuları atar
- `musteriOner(randevular, metin: string) -> [{ad, tel}]` — en fazla 5, en son randevusu olan önce, ada göre tekil, `toLocaleLowerCase('tr')` ile "içerir" eşleşmesi; boş metinde `[]`
- `yeniId() -> string`
- `ornekVeri(bugun: string) -> veri` (`ornek.js`) — `ayar.ornek:true`, `dukkan:'Örnek Berber'`, işlemlere temsili fiyat; `bugun`'den 14 ay geriye ve 6 gün ileriye, Pazar hariç günde 6–14 randevu; aynı `bugun` için birebir aynı çıktı (mulberry32, tohum sabit); geçmişte ~%4 `gelmedi`, ~%2 `iptal`; çakışma yok; `bugun` Pazar değilse o gün en az 8 randevu (Pazar ise boş kalır)

- [ ] **Step 1: Failing tests**

```js
test('varsayilanVeri', () => { const v = BR.varsayilanVeri(); eq(v.islemler.length, 7); eq(v.ayar.adim, 30); deepEq(v.ayar.kapali, [0]); });
test('dogrula bozuk girdileri reddeder', () => {
  for (const x of [null, 'abc', 42, [], {}, {ayar:{}, islemler:{}, randevular:[]}]) eq(BR.dogrula(x), null);
});
test('dogrula tamamlar ve bozuk randevuyu atar', () => {
  const v = BR.dogrula({ayar:{dukkan:'A'}, islemler:[], randevular:[{id:'1', tarih:'2026-11-21', saat:'10:00', sure:30, ad:'X'}, {id:'2', tarih:'bozuk', saat:'10:00'}]});
  eq(v.ayar.acilis, '09:00'); eq(v.ayar.dukkan, 'A'); eq(v.randevular.length, 1); eq(v.randevular[0].durum, 'bekliyor');
});
test('musteriOner Türkçe harf', () => {
  const rs = [{ad:'İsmail Işık', tel:'0532', tarih:'2026-11-01', saat:'10:00'}, {ad:'ismail ışık', tel:'', tarih:'2026-10-01', saat:'10:00'}, {ad:'Mert', tel:'', tarih:'2026-11-05', saat:'10:00'}];
  deepEq(BR.musteriOner(rs, 'IŞI'), [{ad:'İsmail Işık', tel:'0532'}]);
  deepEq(BR.musteriOner(rs, 'ism'), [{ad:'İsmail Işık', tel:'0532'}]);
  deepEq(BR.musteriOner(rs, ''), []);
});
test('ornekVeri', () => {
  const a = BR.ornekVeri('2026-11-21'), b = BR.ornekVeri('2026-11-21');
  deepEq(a, b); ok(a.ayar.ornek); eq(BR.dogrula(a).randevular.length, a.randevular.length);
  ok(a.randevular.filter(r => r.tarih === '2026-11-21').length >= 8);
  ok(a.randevular.some(r => r.tarih < '2025-10-01')); ok(a.randevular.some(r => r.tarih > '2026-11-21'));
  ok(!a.randevular.some(r => BR.tarihOku(r.tarih).getDay() === 0));
  for (const r of a.randevular) eq(BR.cakisanlar(a.randevular, r).length, 0);
});
```

- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS
- [ ] **Step 5:** Commit `Berber Randevu: veri kalıbı, yedek doğrulama, örnek veri`

### Task 4: Kabuk, Gün ekranı, randevu formu

**Files:** Create `berber/index.html`, `_kaynak/berber/ekran.mjs`

**Interfaces — Consumes:** Task 1–3 `BR.*`. **Produces:** `window.uyg = {veri, kaydet(), ciz()}` (Task 5 aynı dosyada kullanır); `ekran.mjs <çıktı-klasörü>` 390×844 görünümde, açık ve koyu temada her ekranın PNG'sini yazar ve konsol hatası varsa sıfırdan farklı kodla çıkar.

- [ ] **Step 1:** `anthropic-skills:frontend-design` becerisini yükle; berber dükkânına yakışan, depodaki uygulamalardan ayrı görsel kimliği belirle.
- [ ] **Step 2:** Yükleme: `localStorage` okuması `try/catch` içinde; `BR.dogrula` `null` dönerse ya da anahtar yoksa `BR.ornekVeri(bugün)` ile başla. `kaydet()` yazma hatasında ekranda uyarı gösterir, uygulama çalışmaya devam eder.
- [ ] **Step 3:** Gün ekranı: tarih başlığı (‹ › , Bugün, takvimden seçim), 7 günlük şerit (gün başına randevu sayısı), özet satırı (`gunOzeti`), dilim listesi (`dilimler`; çok dilimli randevu tek blok), şimdi çizgisi ve açılışta oraya kaydırma, geçmiş soluk, iptal üstü çizili, kapalı gün notu, örnek veri şeridi ("Örnek verilerle açıldı — Temiz başla"), sağ altta "＋ Randevu".
- [ ] **Step 4:** Randevu sayfası (alttan açılır): isim + öneriler (`musteriOner`), telefon, işlem düğmeleri, tarih, saat (adım aralıklı), süre, fiyat, not; çakışmada onay (`cakisanlar`); kayıt `islemAd` ve `fiyat`'ı randevuya kopyalar. Var olan randevuda: Düzenle, Sil (onaylı), durum (Geldi/Gelmedi/İptal/Bekliyor), Ara (`tel:`), WhatsApp (`https://wa.me/90…?text=`; numara 0 ile başlıyorsa 0 atılır, 90 eklenir).
- [ ] **Step 5:** `node _kaynak/berber/ekran.mjs /tmp/berber-ekran` → çıkış kodu 0; gün ve form PNG'lerini aç, taşma/üst üste binme olmadığını gözle doğrula. Betikte ayrıca: boş dilime tıkla → isim yaz → kaydet → listede isim görünür; ismi `<b>x</b>` olan randevu metin olarak görünür (DOM'da `b` öğesi oluşmaz).
- [ ] **Step 6:** Commit `Berber Randevu: gün ekranı ve randevu formu`

### Task 5: İstatistik ve Ayarlar

**Files:** Modify `berber/index.html`, `_kaynak/berber/ekran.mjs`

- [ ] **Step 1:** İstatistik sekmesi: dönem seçici (Gün/Hafta/Ay/Yıl) + ‹ › (`donemKaydir`), başlık `donem().etiket`; büyük rakamlar (kişi, ciro yalnızca `ciroVar` ise, gelmeyen); önceki döneme fark (`kisi - oncekiKisi`, işaretli); `seri` çubuk grafiği (SVG/CSS, kütüphanesiz, eksen etiketleri taşmadan); işlem dağılımı çubukları; en yoğun gün ve saat; boş dönemde "Bu dönemde kayıt yok".
- [ ] **Step 2:** Ayarlar sekmesi: dükkân adı; açılış/kapanış; adım 15/30; kapalı günler; işlemler (ekle, düzenle, sil, yukarı/aşağı sırala; silme `silindi:true` işaretler); "Yedeği indir" (`berber-yedek-YYYY-AA-GG.json`), "Yedekten yükle" (`dogrula` `null` ise "Bu dosya bir Berber Randevu yedeği değil" ve veri değişmez; geçerliyse onaydan sonra değiştirir); "Örnekleri sil, temiz başla" (`varsayilanVeri`, dükkân adı korunur) / "Örnek verileri yükle" (onaylı).
- [ ] **Step 3:** `ekran.mjs`: istatistik (4 dönem) ve ayarlar PNG'leri; kapanış < açılış girilirse kaydedilmez ve uyarı çıkar; bozuk JSON yüklemede veri sayısı değişmez. Çıkış kodu 0, PNG'leri gözle doğrula.
- [ ] **Step 4:** Commit `Berber Randevu: istatistik ve ayarlar`

### Task 6: PWA kabuğu ve son doğrulama

**Files:** Create `berber/manifest.webmanifest`, `berber/sw.js`, `berber/icon-192.png`, `berber/icon-512.png`, `_kaynak/berber/ikon.py`

- [ ] **Step 1:** `manifest.webmanifest`: `name:"Berber Randevu"`, `short_name:"Randevu"`, `start_url:"./"`, `scope:"./"`, `display:"standalone"`, `lang:"tr"`, ikonlar 192 ve 512 (`purpose:"any maskable"`). `index.html` başlığına manifest, `apple-touch-icon`, `theme-color`, `apple-mobile-web-app-capable`.
- [ ] **Step 2:** `sw.js`: `mesai/sw.js` ile aynı desen (önce ağ, düşerse önbellek), önbellek adı `berber-v1`, dosya listesi `./, index.html, hesap.js, ornek.js, manifest.webmanifest, icon-192.png, icon-512.png`.
- [ ] **Step 3:** `python3 _kaynak/berber/ikon.py` ikonları üretir (maskable güvenli alan içinde).
- [ ] **Step 4:** `ekran.mjs`'e çevrimdışı turu: yerel sunucudan aç, service worker etkinleşince bağlamı çevrimdışı yap, yeniden yükle → gün ekranı görünür.
- [ ] **Step 5:** `node --test _kaynak/berber/test/` ve `node _kaynak/berber/ekran.mjs /tmp/berber-ekran` ikisi de 0; tüm PNG'leri son kez gözden geçir; `git status` ile `index.html` (depo ana sayfası) değişmediğini doğrula.
- [ ] **Step 6:** Commit `Berber Randevu: ana ekrana eklenebilir ve çevrimdışı`
