# Berber Randevu Defteri — Tasarım

Tarih: 2026-11-21 · Durum: onay bekliyor

## Amaç ve neden

Berber, günlük ve saatlik tıraş randevularını takip etmekte zorlanıyor. Telefonunda,
günün hangi saatinde kime hangi işlem için randevu verdiğini tek bakışta görebileceği
ve ay/yıl sonunda kaç kişiye hizmet verdiğini öğrenebileceği bir uygulama isteniyor.

İlk hedef: Harun'un müşterisine (berbere) telefonda gösterebileceği, çalışan bir demo.

## Kullanıcının söyledikleri (karar)

- Randevuyu yalnızca berber girer.
- Şimdilik tek telefon.
- Müşteri erişimi yok.
- İşlemler yalnızca tıraş değil: saç, saç + sakal, sakal, ağda gibi seçenekler olmalı.
- Günlük/saatlik randevu görünümü ile aylık ve yıllık kişi sayıları görülebilmeli.
- Uygulama `haruncck/MobileApps` deposunda yayınlanacak.

## Hedefler

1. Gün ekranında saat saat randevuları göstermek (kim, hangi işlem, ne kadar sürer).
2. Randevu eklemek birkaç saniye sürmeli: boş saate dokun, isim yaz, işlemi seç, kaydet.
3. Günlük, haftalık, aylık, yıllık kişi sayısı ve işlem dağılımını göstermek.
4. İnternet olmadan çalışmak, ana ekrana eklenebilmek.
5. Demo sırasında dolu görünmek (örnek veriler).

## Kapsam dışı

- Müşterinin kendi randevusunu alması, çevrimiçi rezervasyon.
- Birden fazla telefon arasında eşitleme, hesap/şifre.
- Birden fazla usta/koltuk (tek takvim).
- Otomatik SMS/WhatsApp hatırlatma, ödeme alma.
- Ayrı bir müşteri kartı/sadakat ekranı.

## Olmaması gerekenler

- Randevu girmek kâğıt deftere yazmaktan uzun sürerse uygulama başarısızdır.
- Küçük, tek elle basılamayan düğmeler (berberin eli çoğu zaman doludur).
- Verinin sessizce kaybolması: yedek alma yolu olmalı ve bulunması kolay olmalı.

## Kısıtlar

- Depodaki diğer uygulamalar (mesai, bakim, abkant) gibi: kendi klasöründe, derleme
  adımı olmayan, tek `index.html` + `manifest.webmanifest` + `sw.js` + ikonlar.
  GitHub Pages üzerinden yayınlanır.
- Dış bağımlılık yok (CDN, kütüphane, font indirme yok); çevrimdışı açılmalı.
- Veri `localStorage` içinde tutulur.
- Dil Türkçe, 24 saat biçimi, hafta Pazartesi başlar, para birimi ₺.
- Öncelik telefon (iPhone Safari ve Android Chrome), dikey kullanım.

## Yaklaşımlar

| | Yaklaşım | Artısı | Eksisi |
|---|---|---|---|
| A | **Telefonda duran web uygulaması** (depodaki Mesai gibi) | Hesap yok, anında demo, ücretsiz, çevrimdışı | Veri tek telefonda; telefon değişirse yedekten taşınır |
| B | Bulutlu sürüm (Hesap Defteri'ndeki gibi Supabase) | Birden fazla telefon, otomatik yedek | Giriş ekranı, sunucu bakımı; tek telefon için gereksiz |
| C | Mağazadan inen yerel uygulama | Bildirim, mağaza görünürlüğü | Geliştirici hesabı ücreti, onay süresi; bu depoya uymaz |

**Seçilen: A.** Kullanıcı "tek berber, tek telefon, müşteri erişimi yok" dedi; B ve C'nin
çözdüğü sorunlar şu an yok. Veri dışa aktarılabilir tutulduğu için ileride B'ye geçiş açık.

## Tasarım

### Yer

`berber/` klasörü: `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`,
`icon-512.png`. Uygulama adı: "Berber Randevu" (kısa ad "Randevu"); dükkân adı
Ayarlar'dan girilir ve üst başlıkta görünür.

Depo ana sayfası (`index.html`) "Gala Sahne Uygulamaları" başlıklı olduğu için berber
uygulaması o listeye **eklenmez**; müşteriye doğrudan `…/berber/` bağlantısı verilir.
*(Benim kararım.)*

### Ekranlar (altta üç sekme)

**1. Gün**
- Üstte tarih: önceki/sonraki gün okları, "Bugün" düğmesi, haftanın 7 günü şeridi
  (her günün altında randevu sayısı). Tarihe dokununca takvimden gün seçilir.
- Altında özet satırı: "8 randevu · 3 boş saat".
- Açılıştan kapanışa saat dilimleri listesi (varsayılan 09:00–21:00, 30 dk).
  - Boş dilim: saat + "＋" — dokununca o saat seçili olarak ekleme formu açılır.
  - Dolu dilim: saat, müşteri adı, işlem adı, süre; işlem rengiyle işaretli.
    Süresi bir dilimden uzun randevu kapladığı dilimleri birlikte kaplar.
  - Bugünde şu anki saat çizgisi görünür, ekran açılınca oraya kayar.
  - Geçmiş randevular soluk görünür.
- Sağ altta büyük "＋ Randevu" düğmesi (ilk boş saati önerir).

**Randevu formu** (alttan açılan sayfa)
- İsim (zorunlu; yazarken eski müşterilerden öneri çıkar, seçilince telefon dolar)
- Telefon (isteğe bağlı)
- İşlem: büyük seçenek düğmeleri, tek seçim
- Tarih ve saat (dilim adımıyla), süre (işlemden gelir, değiştirilebilir)
- Fiyat (işlemden gelir, değiştirilebilir, boş kalabilir)
- Not (isteğe bağlı)
- Seçilen saat başka randevuyla çakışıyorsa uyarı gösterilir, yine de kaydetmeye izin
  verilir ("Bu saatte Ahmet var. Yine de ekle?"). *(Benim kararım: araya müşteri
  sıkıştırmak berberde olağan.)*

**Randevuya dokununca**
- Düzenle, Sil
- Durum: Geldi / Gelmedi / İptal
- Telefon varsa: Ara, WhatsApp'tan yaz (hazır hatırlatma metniyle `wa.me` bağlantısı)

**2. İstatistik**
- Dönem seçici: Gün / Hafta / Ay / Yıl, önceki/sonraki okları.
- Büyük rakamlar: tıraş edilen kişi sayısı, ciro (fiyat girilmişse), gelmeyen sayısı.
- Önceki döneme göre fark ("geçen aya göre +12").
- Çubuk grafik: ay görünümünde gün gün, yıl görünümünde ay ay, hafta görünümünde gün gün
  kişi sayısı.
- İşlem dağılımı: her işlem için kişi sayısı ve yüzde çubuğu.
- En yoğun gün ve en yoğun saat.

**Sayım kuralı:** Saati geçmiş ve "Gelmedi" ya da "İptal" işaretlenmemiş her randevu
"tıraş edildi" sayılır. Berberin her müşteri için ayrıca "Geldi" işaretlemesi gerekmez.
İleri tarihli randevular sayıma girmez. *(Benim kararım.)*

**3. Ayarlar**
- Dükkân adı
- Çalışma saatleri (açılış, kapanış), dilim adımı (15 / 30 dk), kapalı günler
- İşlemler listesi: ad, süre, fiyat, renk; ekle, düzenle, sil, sırala.
  Silinen işlemin eski randevuları adını ve fiyatını korur.
- Yedek: "Yedeği indir" (JSON dosyası) ve "Yedekten yükle"
- Örnek veriler: "Örnekleri sil, temiz başla" / "Örnek verileri yükle"

### Varsayılan işlemler

| İşlem | Süre | Fiyat |
|---|---|---|
| Saç | 30 dk | boş |
| Sakal | 15 dk | boş |
| Saç + Sakal | 45 dk | boş |
| Çocuk Tıraşı | 30 dk | boş |
| Ağda | 15 dk | boş |
| Yıkama + Fön | 15 dk | boş |
| Cilt Bakımı | 30 dk | boş |

Fiyatlar boş gelir; berber girerse ciro hesaplanır, girmezse ciro kutusu gizlenir.
Örnek verilerde demo için temsili fiyatlar bulunur.

### Örnek veri

İlk açılışta uygulama, son ~14 ayı ve önümüzdeki birkaç günü kapsayan gerçekçi örnek
randevularla dolu gelir (yıllık istatistik dolu görünsün diye). Gün ekranının üstünde
"Örnek verilerle açıldı — Temiz başla" şeridi durur. Temizlenince şerit kalkar.
Örnek veri sabit tohumla üretilir (her açılışta aynı). *(Benim kararım.)*

### Veri

`localStorage` anahtarı `berber-v1`, tek JSON:

```
{
  ayar:   { dukkan, acilis:"09:00", kapanis:"21:00", adim:30, kapali:[0], ornek:true },
  islemler: [ { id, ad, sure, fiyat|null, renk, sira, silindi } ],
  randevular: [ { id, tarih:"2026-11-21", saat:"14:30", sure:30, ad, tel,
                  islemId, islemAd, fiyat|null, durum:"bekliyor|geldi|gelmedi|iptal", not } ]
}
```

- `islemAd` ve `fiyat` randevuya kopyalanır; işlem sonradan değişse de geçmiş bozulmaz.
- Müşteri önerileri ayrı tablo tutmadan randevulardan (ad + tel) türetilir.
- Tarihler yerel saatle `YYYY-AA-GG` metni olarak tutulur (saat dilimi kayması olmasın).

### Kenar durumları *(benim kararlarım)*

- Kapalı gün (varsayılan Pazar): gün ekranında "Kapalı gün" notu görünür, yine de randevu
  eklenebilir.
- Çalışma saatleri sonradan daraltılırsa, saat dışında kalan mevcut randevular kaybolmaz;
  o gün listesi onları kapsayacak şekilde uzar.
- Bugünkü randevu, başlangıç saati geçtiği anda sayıma girer.
- İptal edilen randevu gün listesinde üstü çizili kalır ve saatini boşaltır (o saate yeni
  randevu çakışma uyarısı olmadan eklenir).
- Yedekten yükleme mevcut veriyi tümüyle değiştirir; öncesinde onay sorulur.

### Görünüm

Açık ve koyu tema telefon ayarını izler. Büyük dokunma alanları (en az 48 px), tek elle
kullanım, alt sekme çubuğu. Renk ve tipografi yapana bırakıldı; berber dükkânına yakışan,
depodaki diğer uygulamalardan ayrı, kendine ait bir kimlik olmalı.

## Yapana bırakılanlar

- Görsel kimlik, ikon, renk paleti.
- Grafiklerin çizim biçimi (kütüphanesiz SVG/CSS).
- Kod düzeni; saf hesap fonksiyonları (istatistik, çakışma, dilim üretimi) arayüzden ayrı
  tutulmalı ve Node ile test edilebilmeli.

## Doğrulama

- Hesap fonksiyonları için Node testleri: sayım kuralı, dönem sınırları (ay sonu, yıl
  sonu, Pazartesi başlangıçlı hafta), çakışma, süre > dilim.
- Telefon boyutunda tarayıcıda açıp ekran görüntüsüyle kontrol: gün, form, istatistik,
  ayarlar; açık ve koyu tema.
- Çevrimdışı açılış ve yedek al/yükle turu.
