# Hesap Defteri – Saha İşleri & Cari Takip (PWA)

Sahada yapılan mühendislik, pano, yazılım ve servis işlerinin müşteri bazlı alacak takibini çoklu döviz (₺ / $ / €) ile yapan, mobil öncelikli ve çevrimdışı çalışan web uygulaması.

## Kurulum

```bash
npm install
npm run dev        # geliştirme sunucusu (telefondan aynı ağdaki IP ile açılabilir)
npm run build      # üretim derlemesi → dist/
npm run preview    # derlenmiş sürümü test et
```

`dist/` klasörü herhangi bir statik sunucuya (Netlify, Vercel, GitHub Pages, Cloudflare Pages) yüklenebilir. HTTPS üzerinde açıldığında telefonda **“Ana Ekrana Ekle”** ile tam ekran uygulama olarak kurulur ve internetsiz çalışır.

## Teknoloji

React 18 + Vite + TypeScript + Tailwind CSS v4 · Lucide-React · Recharts · SheetJS (xlsx) · idb-keyval (IndexedDB) · vite-plugin-pwa

## Hesaplama Mantığı

| Kavram | Açıklama |
|---|---|
| **İş** | Müşteriye kendi dövizinde borç yazar (ör. €1.850). |
| **Ödeme** | Fiilen alınan tutar + döviz. **İşlem anındaki kur** kaydedilir ve mahsup bu kurla dondurulur. |
| **Hangi bakiyeden düşülsün?** | `₺ / $ / €`: tamamı o döviz bakiyesinden düşer. `Otomatik`: ödeme açık döviz bakiyelerine sırayla dağıtılır (ör. TL ödeme → önce kalan € bakiyesi, artan kısım $ bakiyesine). |
| **Ürün / Cihaz Mahsubu** | Nakit girmeyen ayni ödemeler (ör. alınan bir laptop). |
| **Saf döviz bakiyesi** | `İş − Mahsup` her döviz için ayrı: `₺405.000 + $850 + €0` |
| **TL karşılığı** | Saf bakiyeler **güncel kur** ile TL'ye çevrilir. `Toplam Alınan = Toplam İş − Net Kalan` olacak şekilde aynı kurla gösterilir, bu yüzden üç KPI her zaman birbirini tutar. İşlem kuruyla fiili TL tahsilat ayrıca gösterilir. |
| **İş durumu** | Aynı dövizdeki mahsuplar en eski işten başlayarak (FIFO) dağıtılır → *Alacak / Kısmi / Tahsil Edildi*. |

Tüm tutarlar kuruş hassasiyetinde yuvarlanır (`round2`), kayan nokta hatası birikmez.

## Kurlar

Güncel kur, CORS destekli açık API'lerden (ECB/Frankfurter, yedek: ExchangeRate-API) çekilir. TCMB `today.xml` tarayıcıdan CORS nedeniyle doğrudan okunamaz; TCMB kuru isteniyorsa küçük bir proxy eklenip `src/lib/rates.ts` içine yeni sağlayıcı olarak yazılabilir. Kurlar her zaman elle düzenlenebilir.

## Veri & Yedekleme

- Her değişiklik anında **IndexedDB**'ye (yedek kopya LocalStorage'a) yazılır.
- **Ayarlar → Excel'e Aktar**: Genel Özet + her müşteri için ayrı sekme + Hareketler. Dosyadaki gizli `_customers/_jobs/_payments/_settings` sekmeleri sayesinde aynı Excel dosyası **geri yüklenebilir**.
- **JSON yedeği** de alınıp geri yüklenebilir.

### Uzak senkronizasyon (opsiyonel)

`src/services/storage.ts` içinde `StorageAdapter` arayüzü, hazır `SupabaseAdapter` ve `GoogleSheetsAdapter` şablonları bulunur. Etkinleştirmek için dosyanın sonundaki satırı değiştirin:

```ts
export const storage = new SyncedStorage(
  new LocalStorageAdapter(),
  new SupabaseAdapter('https://xxxx.supabase.co', 'ANON_KEY'),
);
```

Yerel öncelikli çalışır: önce cihaza yazar, çevrimiçiyse arka planda uzak servise gönderir.

## Klasör Yapısı

```
src/
  types.ts                 Veri modelleri
  lib/money.ts             Bakiye, mahsup, FIFO, aylık seri hesapları
  lib/format.ts            ₺/$/€ biçimlendirme, sayı girişi ayrıştırma
  lib/rates.ts             Güncel kur çekme
  lib/seed.ts              Boş başlangıç verisi ve varsayılan kurlar
  services/storage.ts      Depolama katmanı (IndexedDB + uzak adaptör şablonları)
  services/normalize.ts    İçe aktarılan verinin doğrulanması
  services/excel.ts        Excel/JSON dışa-içe aktarım
  store/AppStore.tsx       Uygulama durumu + otomatik kayıt
  pages/                   Özet, Müşteriler (liste + kart), Hareketler, Ayarlar
  components/forms/        İş, Ödeme, Müşteri formları
```
