# Berber Randevu — yapım notları

Tasarım: `2026-11-21-berber-randevu-design.md` · Plan: `2026-11-21-berber-randevu-plan.md`

## Çalıştırma ve test

- Uygulama: `berber/` (derleme adımı yok; GitHub Pages'te `…/berber/`).
- Hesap testleri: `node --test _kaynak/berber/test/*.test.js`
- Ekran denetimleri ve görüntüler: `PW=/yol/playwright node _kaynak/berber/ekran.mjs /tmp/berber-ekran`
- İkonlar: `python3 _kaynak/berber/ikon.py`
- Yeni sürüm yayınlarken `berber/sw.js` içindeki önbellek adını (`berber-v1`) artırmak gerekmez; önce ağ denenir.

## Yapım sırasında verilen kararlar

| # | Karar | Yanlışsa bedeli |
|---|---|---|
| 1 | Ayrı çalışma kopyası açılmadı; taze klon + `berber-randevu` dalı kullanıldı | Yok |
| 2 | Örnek veride dükkân adı "By Lider Erkek Kuaförü" | Ayarlardan değişir |
| 3 | Test komutu dosya kalıbıyla çalışır (`test/*.test.js`) | Yok |
| 4 | İkonlar planlanandan önce üretildi | Yok |
| 5 | Randevu satırının yüksekliği süreyle orantılı (45 dk = 1,5 satır) | Tek satırlık değişiklik |
| 6 | Örnek veriler her gün "bugün"e göre yeniden üretilir (kayıtlı olsa da); kullanıcının kendi kayıtları korunur | Örnek kayıtlarda yapılan işaretlemeler (Geldi/Gelmedi) ertesi gün kaybolur |
| 7 | Okunamayan kayıt `berber-v1-bozuk` anahtarına kopyalanır | Yok |
| 8 | Ekran betiği Playwright yolunu `PW` değişkeninden alır | Yalnızca geliştirme |
| 9 | Açılış/kapanış yarım saatlik listeden seçilir (telefon dili ne olursa olsun 24 saat) | Kapanış en geç 23:30; gece yarısı kapanan dükkâna yetmez |
| 10 | "Temiz başla" yalnızca örnek randevuları ve değiştirilmemiş örnek fiyatları siler | Tesadüfen aynı fiyatı isteyen yeniden girer |
| 11 | Öneriden müşteri seçilince telefon alanı o müşterinin telefonuyla değişir (boşsa boşalır) | Elle yazılmış telefon silinebilir |
| 12 | Diğer uygulamaların (mesai, bakim, abkant, devreye) service worker'ı aynı adresteki `berber-v1` önbelleğini siler; dokunulmadı | O uygulamalar da kurulu telefonda berber bir kez internet ister |
| 13 | iPhone'da ana ekran uygulamasının verisi Safari'den ayrıdır; Safari kurulmamış sitenin verisini 7 gün kullanılmazsa silebilir | Önce ana ekrana eklenmeli, sonra veri girilmeli |
| 14 | Dönem ortası karşılaştırma "Bu dönem henüz bitmedi" notuyla gösterilir | Yok |

## Gözden geçirmede bulunup düzeltilenler

- "Temiz başla" kullanıcının kendi randevularını ve işlemlerini de siliyordu.
- Uygulama gece açık kalınca dünü bugün sanıyor, yeni randevu yanlış güne yazılıyordu.
- Bazı düğmeler 48 px'ten küçüktü (Bugün, Temiz başla, öneriler, dönem ve aralık seçimi, iptal satırı).
- iPhone'da yedek artık paylaşım sayfasıyla veriliyor. **Gerçek iPhone'da denenmedi.**
- Öneriden seçilen müşterinin telefonu başka müşteriye taşınabiliyor, telefon önerilerden kaybolabiliyordu.
- "1.500" yazılan fiyat 1,5 ₺ olarak kaydediliyordu.

## Ertelenen küçük konular

İlk listedeki yedi konu 22 Kasım denetiminde düzeltildi (aşağıya bakın). Bilinip bırakılanlar:

1. İptal edilen randevu, dolu bir saate geri alınırsa çakışma uyarısı çıkmaz.
2. 320 px genişlikte hafta şeridindeki günler ve kapalı gün düğmeleri 48 px'ten dar (yükseklikleri 48 px).
3. İstatistikte uzak bir döneme gidildikten sonra "bugüne dön" kısayolu yok.
4. Depolama dolmaya yaklaşırken uyarı yok (sınır yaklaşık 27.000 randevu); dolunca kayıt uyarısı çıkar.
5. Sesle eklemede geçmiş bir tarih ("20 Kasım", bugün 21 Kasım ise) gelecek yıla yazılır; formda görünür.
6. Sesle eklemede cümle içinde söylenen telefon numarası isme karışır.

## Gerçek telefonda bakılacaklar

- iPhone: ana ekrana ekleme, tarih seçici görünümü, Ayarlar → Yedeği indir.
- Android: ana ekrana ekleme, yedek dosyasının İndirilenler'e düşmesi.

## Sesle ekleme (21 Kasım 2026 eki)

Gün ekranındaki mikrofon düğmesi tarayıcının ses tanımasını (`SpeechRecognition` / `webkitSpeechRecognition`, `tr-TR`) başlatır;
söylenen cümleyi `berber/ses.js` içindeki `BR.sesCoz` isim, tarih, saat ve işleme ayırır ve randevu formunu doldurur.
Kaydetmek için berberin **Kaydet**'e basması gerekir; sesle hiçbir şey onaysız kaydedilmez.

Anlaşılan kalıplar:
- Gün: bugün, yarın, öbür gün, gün adları (cuma, cumaya, cuma günü), haftaya, "25 kasım", "ayın 25'i". Söylenmezse ekranda açık olan gün kalır.
- Saat: "saat 3", "3'te", "üçte", "on birde", "4 buçuk", "15:30", "15.30", "saat 16 30", sabah / öğlen / akşam.
  Bölüm söylenmezse dükkân açılmadan önceki saatler öğleden sonra sayılır (09:00'da açılan dükkânda "üç" = 15:00, "sekiz" = 20:00).
- İşlem: ayarlardaki işlem adları ("saç sakal" = "Saç + Sakal", "traş" = "tıraş"). İkinci bir işlem söylenirse nota "Ek: …" yazılır.
- Kayıtlı bir müşterinin adı söylenirse kayıttaki yazımı ve telefonu gelir.

Kararlar ve sınırlar:
| Karar / sınır | Bedeli |
|---|---|
| Basılı tutmak yerine "bas, konuş, kendiliğinden durur" | iPhone basılı tutmayı kullanıcı hareketi saymayabiliyor; tek dokunuş iki platformda da çalışır |
| Ses tanıma yoksa düğme hiç görünmez; var ama çalışmıyorsa klavye mikrofonu önerilir | iPhone'da ana ekran uygulamasında çalışıp çalışmadığı cihazda denenmeli |
| İnternet ister (ses, tarayıcının bulut servisine gider) | İnternetsizken yalnızca elle ekleme |
| "Çeyrek geçe / çeyrek kala" tanınmaz | Söylenirse isme karışır; formda düzeltilir |
| Adı gün adı olan müşteri ("Cuma Yılmaz") gün sanılır | Formda düzeltilir |
| Yalnızca taklit ses tanımayla sınandı (43 hesap testi, 139 ekran denetimi) | Gerçek mikrofonla Android ve iPhone'da denenmedi |


## Müşteriye gitmeden önceki denetim (22 Kasım 2026)

Dört ayrı denetçi uygulamayı telefon boyutunda tarayıcıda kullandı (gün ekranı ve form; istatistik, ayarlar ve yedek; sesle ekleme;
ilk açılış, kurulum ve çevrimdışı). Yeniden üretilebilen bulgular düzeltildi; her düzeltmenin testi var
(62 hesap testi, 199 ekran denetimi).

Veri güvenliği:
- İki pencere (ya da tarayıcı sekmesi + ana ekran uygulaması) açıkken biri diğerinin kaydını eziyordu; artık her pencere diğerinin
  kaydını alıyor.
- İsim yazılırken otomatik gelen telefon, isim başka bir müşteriye dönünce eski müşteride kalıyordu.
- Kayıt telefona yazılamazsa (yer yok) durum değişikliği sessiz kalıyor, yedek yükleme yarım görünüyordu.
- Çift dokunuş, kapanan sayfanın altından çıkan düğmeye gidiyordu (sekme değişiyor, çakışma uyarısı okunmadan onaylanıyor,
  randevu "Gelmedi" oluyordu). Sayfa açılıp kapanırken dokunuşlar 0,4 saniye yok sayılır; çakışma onayı 0,6 saniyeden önce kabul edilmez.
- Perdeye dokunmak yarım kalmış formu kapatmaz.
- Yedek dosyasında aynı kimlikli kayıtlar, metin olmayan tarih/saat, aşırı fiyat düzeltilir ya da atılır.

Demo görünümü:
- Kapalı günde (Pazar) açılan demo boş görünüyordu; ilk açık gün gösterilir ve nedeni yazılır.
- İlk dokunuştan sonra örnekler o güne donuyordu; her gün bugüne göre yenilenir.
- Örnek müşteriler inandırıcı değildi (aynı kişi birkaç günde bir geliyordu); aynı müşteri en erken 14 gün sonra gelir, çocuk tıraşı
  ayrı bir müşteri kümesinden gelir, örnekler iki yıl geriye gider.
- Örnek kayıtlarda telefon yok: uydurma numara gerçek birine ait çıkabilirdi.
- "Bunlar örnek randevular" şeridi artık başlıkta, her zaman görünür. Düğme her yerde "Örnekleri sil".

Gün ekranı ve form:
- "+ Randevu" geçmiş bir saat önerebiliyordu; şimdiden sonraki ilk boş saati, yer yoksa sonraki açık günü önerir.
- Yeni kaydedilen randevu ekrana kaydırılır. Çalışma saatinin iki saat öncesi ve sonrası da seçilebilir.
- Android geri tuşu açık sayfayı kapatır. "24 boş saat" yerine gerçek süre ("12 saat boş"), yalnızca çalışma saatleri içinde.
- Mikrofon düğmesi son satırı örtmez. Tam saat başında şimdi çizgisi doğru yerde. Kuruşlu fiyat "99,90 ₺" yazılır.

İstatistik:
- Süren dönem, önceki dönemin aynı zamanına kadar olan kısmıyla karşılaştırılır ("Geçen ayın bu zamanına göre").
- Başlamamış dönemde karşılaştırma yerine "henüz başlamadı, N randevu yazılı" yazar. Ekran açıkken sayılar güncellenir.
- İşlem yeniden adlandırılınca istatistik bölünmez. "Geldi" işaretlenen, saati gelmeden de sayılır. Yüzdeler 100 eder.

Sesle ekleme:
- "7:30", "3:30" gibi yazımlarda öğleden sonra kuralı uygulanmıyordu (akşam 7:30 → 07:30 oluyordu).
- "Sabahattin", "Akşamoğlu" gibi isimler gün bölümü sanılıp yutuluyordu.
- Yeni anlaşılanlar: "haftaya bugün/yarın", "yarın değil öbür gün", "gelecek hafta cuma", "3 gün sonra", "25'inde", "Kasım'ın 25'i",
  "üç" (eksiz), "yarım", "3 gibi", "fön" / "çocuk" (tek sözcükle işlem), "saç artı sakal", "sakal saç".
- Gün söylenmezse formda belirtilir ve geçmiş güne yazılmaz.

Çevrimdışı:
- "?fbclid=…" gibi eklerle açılan bağlantılar eski sayfa + yeni betik karışımına düşebiliyordu; sayfa tek anahtar altında tutulur.
- Zayıf bağlantıda 4 saniyede yanıt gelmezse önbellekteki kopya açılır. Bir dosya yüklenemezse boş ekran yerine açıklama çıkar.

Bu denetimde verilen kararlar:
| Karar | Yanlışsa bedeli |
|---|---|
| Örnek kayıtlardan telefon kaldırıldı | Demoda Ara / WhatsApp düğmeleri ancak kendi eklenen kayıtta görünür |
| Kapalı günde açılan demo ilk açık günü gösterir | Müşteri "bugün" yerine başka bir gün görür; şeritte nedeni yazar |
| Dokunuşlar sayfa geçişinde 0,4 sn yok sayılır | Çok hızlı kullanan biri dokunuşunu tekrarlamak zorunda kalabilir |
| Müşteri önerisi sözcük başından eşleşir ("ah" → Ahmet; "Şahin" değil) | İsmin ortasından arama yapılamaz |
| İşlem adı değişince eski randevular da yeni adla anılır (fiyatları aynı kalır) | Eski adla istatistik görülemez |


## Gider takibi (24 Kasım 2026 eki)

Alt çubuğa dördüncü sekme eklendi: **Gider**. Veri yine telefonda, aynı kayıtta ve aynı yedek dosyasında durur
(`giderler`, `sabitGiderler`; bu alanları olmayan eski kayıtlar ve yedekler sorunsuz açılır).

- **Gider:** tutar, tür (Kira, Fatura, Malzeme, Maaş, Vergi, Diğer), tarih, not. Ay ay gezilir, ayın toplamı üstte yazar.
- **Her ay tekrar edenler:** gider eklerken "Her ay tekrarla" açılırsa sabit gider oluşur. Uygulama açıldığında vadesi gelmiş
  aylar için sıradan gider satırı yazılır (`BR.sabitleriIsle`). Yazılan satır sonradan düzeltilebilir ya da silinebilir; silinen
  yeniden yazılmaz. Sabit giderin tutarı değişirse yalnızca sonraki aylar etkilenir.
- **Kasa (İstatistik):** her dönem için ciro, gider, kalan ve giderlerin türlere dağılımı. Yalnızca gider yazılmışsa görünür.
  Giderler bugüne kadar olanlarla sayılır.
- **Örnek veriler:** kira ve maaş (sabit gider olarak), faturalar, malzeme ve üç ayda bir vergi; tutarlar temsilidir.
  "Örnekleri sil" örnek giderleri de siler, kullanıcının eklediği giderlere dokunmaz.

Kararlar ve sınırlar:
| Karar / sınır | Bedeli |
|---|---|
| Gider türleri sabit altı tür; kullanıcı yeni tür ekleyemez | Farklı bir tür "Diğer" + not ile yazılır |
| Ciro yalnızca fiyatı girilmiş randevulardan gelir; randevusuz gelen müşteri sayılmaz | Kalan olduğundan düşük görünebilir; fiyatı boş randevu varsa Kasa'da uyarı çıkar |
| Sabit gider ayrı bir ekrandan değil, gider eklerken "Her ay tekrarla" ile oluşturulur | İlk ay için tarih seçmek gerekir |
| Sabit gider seçilen tarihin ayından başlar; ay kısaysa ayın son günü yazılır | 31'i seçilen gider Şubat'ta 28/29'una yazılır |
| Muhasebe özellikleri yok: fiş numarası, KDV, Excel'e aktarma | İstenirse ayrı iş |
| Giderler için sesle ekleme yok | Elle girilir |

Kontroller: 70 hesap testi, 239 ekran denetimi. Gerçek telefonda denenmedi.
