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

  /* ---------- metin ---------- */
  const KACIS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  BR.kacis = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => KACIS[c]);

  if (typeof module !== 'undefined') module.exports = BR;
})(globalThis);
