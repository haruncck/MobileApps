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
