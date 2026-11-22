// Berber Randevu — saf hesap fonksiyonları (arayüzden bağımsız, Node ile test edilir).
(function (g) {
  const BR = g.BR || (g.BR = {});
  const iki = n => String(n).padStart(2, '0');

  /* ---------- saat ve tarih ---------- */
  BR.dakika = saat => { const [s, d] = saat.split(':').map(Number); return s * 60 + d; };
  BR.saatYaz = dk => iki(Math.floor(dk / 60)) + ':' + iki(dk % 60);
  BR.tarihYaz = d => d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate());
  BR.tarihOku = s => { const [y, a, gun] = s.split('-').map(Number); return new Date(y, a - 1, gun); };
  BR.gunEkle = (s, n) => { const d = BR.tarihOku(s); d.setDate(d.getDate() + n); return BR.tarihYaz(d); };

  /* ---------- dilim ve çakışma ---------- */
  const aktif = r => r.durum !== 'iptal';
  const bas = r => BR.dakika(r.saat);
  const son = r => BR.dakika(r.saat) + (r.sure || 0);

  // Açılıştan kapanışa dilim başlangıçları; saat dışı randevuları kapsayacak şekilde uzar.
  BR.dilimler = (ayar, gunRandevulari) => {
    const adim = ayar.adim;
    let ilk = BR.dakika(ayar.acilis), bitis = BR.dakika(ayar.kapanis);
    for (const r of gunRandevulari || []) {
      while (bas(r) < ilk && ilk - adim >= 0) ilk -= adim;
      while (son(r) > bitis && bitis + adim <= 24 * 60) bitis += adim;
    }
    const liste = [];
    for (let t = ilk; t < bitis; t += adim) liste.push(BR.saatYaz(t));
    return liste;
  };

  BR.cakisanlar = (randevular, aday) => {
    const b = BR.dakika(aday.saat), s = b + aday.sure;
    return randevular.filter(r => r.tarih === aday.tarih && aktif(r) &&
      !(aday.id != null && r.id === aday.id) && bas(r) < s && son(r) > b);
  };

  // simdiDk verilirse (bugün için) yalnızca henüz bitmemiş dilimler boş sayılır.
  BR.gunOzeti = (ayar, randevular, tarih, simdiDk) => {
    const gun = randevular.filter(r => r.tarih === tarih), dolu = gun.filter(aktif);
    const ac = BR.dakika(ayar.acilis), kap = BR.dakika(ayar.kapanis);
    const bosDilim = BR.dilimler(ayar, gun).filter(saat => {
      const b = BR.dakika(saat), s = b + ayar.adim;
      if (b < ac || b >= kap) return false; // saat dışı randevu için uzayan dilimler boş zaman sayılmaz
      if (simdiDk != null && s <= simdiDk) return false;
      return !dolu.some(r => bas(r) < s && son(r) > b);
    }).length;
    return { randevu: dolu.length, bosDilim, bosDakika: bosDilim * ayar.adim };
  };

  // Dakikayı okunur süreye çevirir: 30 → "30 dk", 90 → "1,5 saat", 75 → "1 sa 15 dk".
  BR.sureYaz = dk => {
    const s = Math.floor(dk / 60), kalan = dk % 60;
    if (s === 0) return dk + ' dk';
    return kalan === 0 ? s + ' saat' : kalan === 30 ? s + ',5 saat' : s + ' sa ' + kalan + ' dk';
  };

  /* ---------- sayım ve dönem ---------- */
  BR.AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  BR.AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  // Pazartesi başlangıçlı; Date.getDay() (0 = Pazar) değerinden çevirmek için ptSira kullanılır.
  BR.GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  BR.GUN_KISA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
  BR.ptSira = d => (d.getDay() + 6) % 7;

  // Tıraş edildi sayılır mı: "Geldi" işaretli, ya da başlangıcı geçmiş ve gelmedi/iptal işaretlenmemiş.
  BR.sayilir = (r, simdi) => {
    if (r.durum === 'gelmedi' || r.durum === 'iptal') return false;
    if (r.durum === 'geldi') return true;
    const d = BR.tarihOku(r.tarih); d.setMinutes(BR.dakika(r.saat));
    return d <= simdi;
  };

  const aySonu = (y, a) => new Date(y, a + 1, 0).getDate();

  BR.donem = (tur, tarih) => {
    const d = BR.tarihOku(tarih), y = d.getFullYear(), a = d.getMonth();
    if (tur === 'gun') return { bas: tarih, son: tarih, etiket: d.getDate() + ' ' + BR.AYLAR[a] + ' ' + y + ' ' + BR.GUNLER[BR.ptSira(d)] };
    if (tur === 'hafta') {
      const b = BR.gunEkle(tarih, -BR.ptSira(d)), s = BR.gunEkle(b, 6);
      const bd = BR.tarihOku(b), sd = BR.tarihOku(s);
      const etiket = bd.getMonth() === sd.getMonth()
        ? bd.getDate() + '–' + sd.getDate() + ' ' + BR.AYLAR[sd.getMonth()] + ' ' + sd.getFullYear()
        : bd.getDate() + ' ' + BR.AYLAR[bd.getMonth()] + (bd.getFullYear() === sd.getFullYear() ? '' : ' ' + bd.getFullYear()) +
          ' – ' + sd.getDate() + ' ' + BR.AYLAR[sd.getMonth()] + ' ' + sd.getFullYear();
      return { bas: b, son: s, etiket };
    }
    if (tur === 'ay') return { bas: BR.tarihYaz(new Date(y, a, 1)), son: BR.tarihYaz(new Date(y, a, aySonu(y, a))), etiket: BR.AYLAR[a] + ' ' + y };
    return { bas: y + '-01-01', son: y + '-12-31', etiket: String(y) };
  };

  BR.donemKaydir = (tur, tarih, n) => {
    if (tur === 'gun') return BR.gunEkle(tarih, n);
    if (tur === 'hafta') return BR.gunEkle(tarih, 7 * n);
    const d = BR.tarihOku(tarih), gun = d.getDate();
    const hedef = new Date(d.getFullYear() + (tur === 'yil' ? n : 0), d.getMonth() + (tur === 'ay' ? n : 0), 1);
    hedef.setDate(Math.min(gun, aySonu(hedef.getFullYear(), hedef.getMonth())));
    return BR.tarihYaz(hedef);
  };

  BR.istatistik = (randevular, tur, tarih, simdi) => {
    const dn = BR.donem(tur, tarih), icinde = r => r.tarih >= dn.bas && r.tarih <= dn.son;
    const hepsi = randevular.filter(icinde), sayilan = hepsi.filter(r => BR.sayilir(r, simdi));
    const onceki = BR.donem(tur, BR.donemKaydir(tur, tarih, -1));
    const oncekiler = randevular.filter(r => r.tarih >= onceki.bas && r.tarih <= onceki.son && BR.sayilir(r, simdi));
    const oncekiKisi = oncekiler.length;
    // Süren dönem, önceki dönemin aynı noktasına kadar olan kısmıyla karşılaştırılır (ayın 21'i ile geçen ayın 21'i).
    const bg = BR.tarihYaz(simdi), basladi = dn.bas <= bg, suruyor = basladi && dn.son >= bg;
    const an = r => { const d = BR.tarihOku(r.tarih); d.setMinutes(BR.dakika(r.saat)); return d; };
    const gecen = simdi - BR.tarihOku(dn.bas), oncekiBas = BR.tarihOku(onceki.bas);
    const oncekiAyni = suruyor ? oncekiler.filter(r => an(r) - oncekiBas <= gecen).length : oncekiKisi;
    const yazili = hepsi.filter(r => r.durum !== 'gelmedi' && r.durum !== 'iptal' && !BR.sayilir(r, simdi)).length;

    // seri
    let seri;
    const saatBasi = r => r.saat.slice(0, 2) + ':00';
    if (tur === 'gun') {
      const m = new Map();
      for (const r of sayilan) m.set(saatBasi(r), (m.get(saatBasi(r)) || 0) + 1);
      const saatler = [...m.keys()].sort();
      seri = [];
      if (saatler.length) for (let s = Number(saatler[0].slice(0, 2)); s <= Number(saatler[saatler.length - 1].slice(0, 2)); s++) {
        const k = iki(s) + ':00'; seri.push({ etiket: k, kisi: m.get(k) || 0 });
      }
    } else if (tur === 'hafta') {
      seri = BR.GUN_KISA.map(e => ({ etiket: e, kisi: 0 }));
      for (const r of sayilan) seri[BR.ptSira(BR.tarihOku(r.tarih))].kisi++;
    } else if (tur === 'ay') {
      const gunSayisi = Number(dn.son.slice(8));
      seri = Array.from({ length: gunSayisi }, (_, i) => ({ etiket: String(i + 1), kisi: 0 }));
      for (const r of sayilan) seri[Number(r.tarih.slice(8)) - 1].kisi++;
    } else {
      seri = BR.AY_KISA.map(e => ({ etiket: e, kisi: 0 }));
      for (const r of sayilan) seri[Number(r.tarih.slice(5, 7)) - 1].kisi++;
    }

    // işlem dağılımı
    const im = new Map();
    for (const r of sayilan) { const ad = r.islemAd || 'Diğer'; im.set(ad, (im.get(ad) || 0) + 1); }
    const islemler = [...im.entries()]
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'tr'))
      .map(([ad, kisi]) => ({ ad, kisi, yuzde: Math.floor(kisi * 100 / sayilan.length), kalan: (kisi * 100 / sayilan.length) % 1 }));
    // Toplam 100 etsin: eksik puanlar en büyük kesirli kısımlara dağıtılır.
    let eksik = 100 - islemler.reduce((t, x) => t + x.yuzde, 0);
    for (const x of islemler.slice().sort((a, b) => b.kalan - a.kalan)) { if (eksik-- > 0 && islemler.length) x.yuzde++; }
    for (const x of islemler) delete x.kalan;

    // en yoğun gün ve saat
    let enYogunGun = null, enYogunSaat = null;
    if (sayilan.length) {
      if (tur !== 'gun') {
        const gs = [0, 0, 0, 0, 0, 0, 0];
        for (const r of sayilan) gs[BR.ptSira(BR.tarihOku(r.tarih))]++;
        const i = gs.indexOf(Math.max(...gs));
        enYogunGun = { etiket: BR.GUNLER[i], kisi: gs[i] };
      }
      const sm = new Map();
      for (const r of sayilan) sm.set(saatBasi(r), (sm.get(saatBasi(r)) || 0) + 1);
      const [saat, kisi] = [...sm.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
      enYogunSaat = { saat, kisi };
    }

    const fiyatli = sayilan.filter(r => r.fiyat != null);
    return {
      kisi: sayilan.length,
      ciro: fiyatli.reduce((t, r) => t + Number(r.fiyat), 0),
      ciroVar: fiyatli.length > 0,
      gelmedi: hepsi.filter(r => r.durum === 'gelmedi').length,
      iptal: hepsi.filter(r => r.durum === 'iptal').length,
      oncekiKisi, oncekiAyni, suruyor, basladi, yazili, seri, islemler, enYogunGun, enYogunSaat,
    };
  };

  /* ---------- veri kalıbı ve doğrulama ---------- */
  let sayac = 0;
  BR.yeniId = () => Date.now().toString(36) + (sayac++).toString(36) + Math.random().toString(36).slice(2, 6);

  BR.RENKLER = ['#2F6FDE', '#D9822B', '#1F9D7A', '#8B5CF6', '#D6457A', '#2AA7C9', '#7A8B2E', '#B4532A'];
  const ISLEMLER = [['sac', 'Saç', 30], ['sakal', 'Sakal', 15], ['sacsakal', 'Saç + Sakal', 45], ['cocuk', 'Çocuk Tıraşı', 30],
    ['agda', 'Ağda', 15], ['fon', 'Yıkama + Fön', 15], ['cilt', 'Cilt Bakımı', 30]];
  const VARSAYILAN_AYAR = () => ({ dukkan: '', acilis: '09:00', kapanis: '21:00', adim: 30, kapali: [0], ornek: false, ornekGun: '' });

  BR.varsayilanVeri = () => ({
    ayar: VARSAYILAN_AYAR(),
    islemler: ISLEMLER.map(([id, ad, sure], i) => ({ id, ad, sure, fiyat: null, renk: BR.RENKLER[i], sira: i, silindi: false })),
    randevular: [],
  });

  const SAAT_RE = /^([01]\d|2[0-3]):[0-5]\d$/, TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;
  const DURUMLAR = ['bekliyor', 'geldi', 'gelmedi', 'iptal'];
  const nesne = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const metin = x => (typeof x === 'string' ? x : x == null ? '' : String(x));
  const fiyatOku = x => (x === null || x === undefined || x === '' || !isFinite(Number(x)) || Number(x) < 0 || Number(x) > 1e7 ? null : Number(x));
  const sureOku = x => (Number.isFinite(x) && Math.round(x) >= 1 && x <= 480 ? Math.round(x) : 30);
  const tekBosluk = x => metin(x).replace(/\s+/g, ' ').trim();
  const tarihGecerli = s => typeof s === 'string' && TARIH_RE.test(s) && BR.tarihYaz(BR.tarihOku(s)) === s;

  // Depodan ya da yedek dosyasından gelen veriyi denetler; tanınmıyorsa null, tanınıyorsa onarılmış kopya döner.
  BR.dogrula = x => {
    if (!nesne(x) || !nesne(x.ayar) || !Array.isArray(x.islemler) || !Array.isArray(x.randevular)) return null;
    const v = VARSAYILAN_AYAR(), a = x.ayar;
    const ayar = {
      dukkan: metin(a.dukkan).slice(0, 60),
      acilis: v.acilis, kapanis: v.kapanis,
      adim: a.adim === 15 || a.adim === 30 ? a.adim : v.adim,
      kapali: Array.isArray(a.kapali) ? [...new Set(a.kapali.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))] : v.kapali,
      ornek: a.ornek === true,
      ornekGun: tarihGecerli(a.ornekGun) ? a.ornekGun : '', // örnek verinin hangi güne göre üretildiği
    };
    if (SAAT_RE.test(a.acilis) && SAAT_RE.test(a.kapanis) && BR.dakika(a.kapanis) > BR.dakika(a.acilis)) { ayar.acilis = a.acilis; ayar.kapanis = a.kapanis; }
    const islemler = x.islemler.filter(i => nesne(i) && tekBosluk(i.ad)).map((i, n) => ({
      id: metin(i.id) || BR.yeniId(), ad: tekBosluk(i.ad).slice(0, 40),
      sure: sureOku(i.sure),
      fiyat: fiyatOku(i.fiyat), renk: /^#[0-9a-fA-F]{6}$/.test(i.renk) ? i.renk : BR.RENKLER[n % BR.RENKLER.length],
      sira: Number.isFinite(i.sira) ? i.sira : n, silindi: i.silindi === true,
    }));
    const idler = new Set();
    const tekilId = id => { let y = metin(id) || BR.yeniId(); while (idler.has(y)) y = BR.yeniId(); idler.add(y); return y; }; // aynı id iki kayıtta olmasın
    const randevular = x.randevular.filter(r => nesne(r) && tarihGecerli(r.tarih) && typeof r.saat === 'string' && SAAT_RE.test(r.saat)).map(r => ({
      id: tekilId(r.id), tarih: r.tarih, saat: r.saat,
      sure: sureOku(r.sure),
      ad: tekBosluk(r.ad).slice(0, 60), tel: metin(r.tel).slice(0, 20),
      islemId: metin(r.islemId), islemAd: metin(r.islemAd).slice(0, 40), fiyat: fiyatOku(r.fiyat),
      durum: DURUMLAR.includes(r.durum) ? r.durum : 'bekliyor', not: metin(r.not).slice(0, 200),
      ...(r.ornek === true ? { ornek: true } : {}), // demo verisinden gelen randevu; "temiz başla" yalnızca bunları siler
    }));
    return { ayar, islemler, randevular };
  };

  // Yazılan metne uyan eski müşteriler: en son gelen önce, ada göre tekil, en fazla 5.
  BR.musteriOner = (randevular, yazilan) => {
    const tr = s => metin(s).trim().toLocaleLowerCase('tr');
    const aranan = tr(yazilan);
    if (!aranan) return [];
    const kisiler = new Map();
    const uyar = ad => { const a = tr(ad); return a.startsWith(aranan) || a.includes(' ' + aranan); }; // sözcük başından
    const sirali = randevular.filter(r => uyar(r.ad))
      .sort((x, y) => (y.tarih + y.saat).localeCompare(x.tarih + x.saat));
    for (const r of sirali) {
      const k = tr(r.ad), kisi = kisiler.get(k);
      if (!kisi) kisiler.set(k, { ad: r.ad, tel: r.tel || '' });
      else if (!kisi.tel && r.tel) kisi.tel = r.tel; // son randevuda telefon yazılmadıysa bir öncekinden al
    }
    return [...kisiler.values()].slice(0, 5);
  };

  // Parayı gösterir: 450 → "450 ₺", 99.9 → "99,90 ₺". Yazı alanına koymak için: 99.9 → "99,9" (fiyatCoz geri okur).
  BR.paraYaz = n => new Intl.NumberFormat('tr-TR', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₺';
  BR.fiyatYaz = n => (n == null ? '' : String(n).replace('.', ','));

  // Elle yazılan fiyatı sayıya çevirir: "1.500" → 1500, "99,90" → 99.9. Boşsa null, anlaşılmazsa NaN.
  BR.fiyatCoz = yazi => {
    let s = metin(yazi).replace(/[₺\s]/g, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  };

  /* ---------- metin ---------- */
  const KACIS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  BR.kacis = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => KACIS[c]);

  if (typeof module !== 'undefined') module.exports = BR;
})(globalThis);
