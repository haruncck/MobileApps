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
| 6 | Örnek veri ilk değişikliğe kadar telefona yazılmaz; demo her gün "bugün"e göre dolu açılır | `yukle()` içinde bir satır |
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

1. İsim alanında Enter klavyeyi kapatmıyor, kaydetmiyor.
2. "Boş saat" aslında boş dilim sayısı; 15 dakikalık aralıkta "45 boş saat" yazabiliyor, geçmiş dilimler de sayılıyor.
3. Bildirim şeridi çok uzun isimde taşabiliyor.
4. Sayfa açılınca klavye odağı arka planda kalıyor.
5. Android geri tuşu açık formu kapatmak yerine uygulamadan çıkıyor.
6. Okunamayan kayıt sessizce örnek veriye düşüyor; kurtarma için arayüz yok.
7. Zayıf internette açılış gecikebilir (önce ağ deneniyor, zaman aşımı yok).

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
