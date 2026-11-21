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

  BR.gunOzeti = (ayar, randevular, tarih) => {
    const gun = randevular.filter(r => r.tarih === tarih), dolu = gun.filter(aktif);
    const bosDilim = BR.dilimler(ayar, gun).filter(saat => {
      const b = BR.dakika(saat), s = b + ayar.adim;
      return !dolu.some(r => bas(r) < s && son(r) > b);
    }).length;
    return { randevu: dolu.length, bosDilim };
  };

  /* ---------- sayım ve dönem ---------- */
  BR.AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  BR.AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  // Pazartesi başlangıçlı; Date.getDay() (0 = Pazar) değerinden çevirmek için ptSira kullanılır.
  BR.GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  BR.GUN_KISA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
  BR.ptSira = d => (d.getDay() + 6) % 7;

  // Tıraş edildi sayılır mı: başlangıcı geçmiş ve gelmedi/iptal işaretlenmemiş.
  BR.sayilir = (r, simdi) => {
    if (r.durum === 'gelmedi' || r.durum === 'iptal') return false;
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
        : bd.getDate() + ' ' + BR.AYLAR[bd.getMonth()] + ' – ' + sd.getDate() + ' ' + BR.AYLAR[sd.getMonth()] + ' ' + sd.getFullYear();
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
    const oncekiKisi = randevular.filter(r => r.tarih >= onceki.bas && r.tarih <= onceki.son && BR.sayilir(r, simdi)).length;

    // seri
    let seri;
    const saatBasi = r => r.saat.slice(0, 2) + ':00';
    if (tur === 'gun') {
      const m = new Map();
      for (const r of sayilan) m.set(saatBasi(r), (m.get(saatBasi(r)) || 0) + 1);
      seri = [...m.keys()].sort().map(k => ({ etiket: k, kisi: m.get(k) }));
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
      .map(([ad, kisi]) => ({ ad, kisi, yuzde: Math.round(kisi * 100 / sayilan.length) }));

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
      oncekiKisi, seri, islemler, enYogunGun, enYogunSaat,
    };
  };

  /* ---------- metin ---------- */
  const KACIS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  BR.kacis = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => KACIS[c]);

  if (typeof module !== 'undefined') module.exports = BR;
})(globalThis);
