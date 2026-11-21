// Berber Randevu — sesle söylenen cümleyi randevu alanlarına ayırır (saf fonksiyon, Node ile test edilir).
// "Ahmet Kaya yarın saat üç saç sakal" → { ad: 'Ahmet Kaya', tarih: yarın, saat: '15:00', islemId: 'sacsakal' }
(function (g) {
  const BR = g.BR || (typeof require !== 'undefined' ? require('./hesap.js') : (g.BR = {}));

  const tr = s => s.toLocaleLowerCase('tr');
  const sade = s => tr(s).replace(/tra[sş]/g, 'tıraş').replace(/[+&/]/g, ' ').replace(/\s+/g, ' ').trim();

  const BIRLER = { bir: 1, iki: 2, üç: 3, dört: 4, dörd: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 };
  const ONLAR = { on: 10, yirmi: 20 };
  const SAYI_EKI = ['de', 'da', 'te', 'ta', 'e', 'a', 'ye', 'ya'];           // "üçte", "dörde", "altıya"
  const PARCA = ['de', 'da', 'te', 'ta', 'e', 'a', 'ye', 'ya'];              // ayrı yazılan ek: "3 de"
  const BUCUK = ['buçuk', 'bucuk', 'buçukta', 'bucukta', 'buçuğa', 'buçukda'];
  const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  const GUNLER = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar']; // Pazartesi = 0
  const YER_EKI = ['', 'da', 'de', 'ta', 'te', 'a', 'e', 'ya', 'ye', 'ki'];
  const DOLGU = new Set(['saat', 'saate', 'saatinde', 'için', 'icin', 'randevu', 'randevusu', 'randevuyu', 'yaz', 'yazar', 'yazalım', 'ekle',
    'kaydet', 'olsun', 'olacak', 'günü', 'gün', 'kesimi', 'kesim', 'tıraşı', 'tıraş', 've', 'bu', 'bir', 'tane', 'lütfen', 'adına', 'ismine',
    'müşteri', 'de', 'da', 'te', 'ta']);

  // Sözcüğü köke ve eke ayırır: kesme işaretinden sonrası ektir ("3'te", "Ahmet'e").
  function sozcukler(metin) {
    return String(metin || '').replace(/[,;!?()"“”]/g, ' ').split(/\s+/).filter(Boolean).map(ham => {
      const temiz = ham.replace(/\.+$/, ''), m = temiz.match(/^(.+?)['’`](.*)$/);
      const kok = m ? m[1] : temiz;
      return { ham: kok, k: sade(kok), ek: m ? tr(m[2]) : '', kullanildi: false };
    }).filter(s => s.ham);
  }

  // i. sözcükten başlayan sayıyı okur. ekli: saat olduğunu belli eden bir ek taşıyor ("üçte", "3'te").
  function sayiOku(s, i) {
    const t = s[i];
    if (!t || t.kullanildi) return null;
    if (/^\d{1,2}$/.test(t.k)) return { deger: Number(t.k), uzunluk: 1, ekli: t.ek !== '' };
    const cozBir = (k, ek) => {
      for (const kok in BIRLER) {
        if (k === kok) return { deger: BIRLER[kok], ekli: ek !== '' };
        if (k.startsWith(kok) && SAYI_EKI.includes(k.slice(kok.length))) return { deger: BIRLER[kok], ekli: true };
      }
      return null;
    };
    for (const kok in ONLAR) {
      if (t.k === kok && t.ek === '') {
        const sonraki = s[i + 1], bir = sonraki && !sonraki.kullanildi ? cozBir(sonraki.k, sonraki.ek) : null;
        if (bir) return { deger: ONLAR[kok] + bir.deger, uzunluk: 2, ekli: bir.ekli };
        return { deger: ONLAR[kok], uzunluk: 1, ekli: false };
      }
      if (t.k === kok || (t.k.startsWith(kok) && SAYI_EKI.includes(t.k.slice(kok.length)))) return { deger: ONLAR[kok], uzunluk: 1, ekli: true };
    }
    const bir = cozBir(t.k, t.ek);
    return bir ? { deger: bir.deger, uzunluk: 1, ekli: bir.ekli } : null;
  }

  const kullan = (s, bas, adet) => { for (let i = bas; i < bas + adet; i++) if (s[i]) s[i].kullanildi = true; };
  const parcaYut = (s, i) => { if (s[i] && !s[i].kullanildi && PARCA.includes(s[i].k) && !s[i].ek) s[i].kullanildi = true; };

  /* ---------- tarih ---------- */
  // Öncelik: açık tarih ("25 kasım", "ayın 25'i") > bugün/yarın > gün adı. Eşleşen her sözcük yutulur ki isme karışmasın.
  function tarihBul(s, bugun) {
    const bd = BR.tarihOku(bugun), bugunSira = BR.ptSira(bd);
    const esit = (k, kok) => k.startsWith(kok) && YER_EKI.includes(k.slice(kok.length));
    const rakam = t => t && !t.kullanildi && /^\d{1,2}$/.test(t.k);
    let acik, goreli, gunSira, haftaya = false, acikVar = false;

    for (let i = 0; i < s.length; i++) { // açık tarih
      const t = s[i];
      if (t.kullanildi) continue;
      const ay = AYLAR.findIndex(a => esit(t.k, a));
      if (ay >= 0 && rakam(s[i - 1])) {
        const gun = Number(s[i - 1].k);
        kullan(s, i - 1, 2); acikVar = true;
        for (const yil of [bd.getFullYear(), bd.getFullYear() + 1]) {
          const d = new Date(yil, ay, gun);
          if (!acik && d.getMonth() === ay && d.getDate() === gun && BR.tarihYaz(d) >= bugun) acik = BR.tarihYaz(d);
        }
      } else if (t.k === 'ayın' && rakam(s[i + 1])) {
        const gun = Number(s[i + 1].k);
        kullan(s, i, 2); acikVar = true;
        for (const ek of [0, 1]) {
          const d = new Date(bd.getFullYear(), bd.getMonth() + ek, gun);
          if (!acik && d.getDate() === gun && BR.tarihYaz(d) >= bugun) acik = BR.tarihYaz(d);
        }
      }
    }
    for (let i = 0; i < s.length; i++) { // bugün, yarın, öbür gün, haftaya, gün adı
      const t = s[i], sonraki = s[i + 1];
      if (t.kullanildi) continue;
      let g = null, adet = 1;
      if (t.k === 'haftaya') { haftaya = true; t.kullanildi = true; continue; }
      if (esit(t.k, 'bugün')) g = 0;
      else if (t.k === 'yarından' && sonraki && sonraki.k === 'sonra') { g = 2; adet = 2; }
      else if (esit(t.k, 'yarın')) g = 1;
      else if ((t.k === 'öbür' || t.k === 'öbürsü') && sonraki && sonraki.k.startsWith('gün')) { g = 2; adet = 2; }
      if (g !== null) { kullan(s, i, adet); if (goreli === undefined) goreli = g; continue; }
      const sira = [5, 0, 2, 3, 1, 4, 6].find(n => esit(t.k, GUNLER[n])); // uzun adlar önce: "cumartesi", "cuma"dan önce
      if (sira !== undefined) { t.kullanildi = true; if (gunSira === undefined) gunSira = sira; }
    }
    if (acikVar) return acik || null;
    if (goreli !== undefined) return BR.gunEkle(bugun, goreli);
    if (gunSira !== undefined) return BR.gunEkle(bugun, haftaya ? 7 - bugunSira + gunSira : (gunSira - bugunSira + 7) % 7);
    return haftaya ? BR.gunEkle(bugun, 7) : null;
  }

  /* ---------- saat ---------- */
  function saatBul(s, ayar) {
    // günün bölümü: sabah / öğlen / akşam
    let bolum = null, buAksam = false;
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      if (t.kullanildi) continue;
      let b = null, adet = 1;
      if (t.k.startsWith('sabah')) b = 'sabah';
      else if (t.k.startsWith('akşam') || t.k.startsWith('gece')) b = 'aksam';
      else if (t.k === 'öğleden' && s[i + 1] && s[i + 1].k === 'sonra') { b = 'aksam'; adet = 2; }
      else if (t.k.startsWith('öğle')) b = 'ogle';
      if (!b) continue;
      if (i > 0 && !s[i - 1].kullanildi && s[i - 1].k === 'bu') { s[i - 1].kullanildi = true; buAksam = true; }
      kullan(s, i, adet); bolum = bolum || b;
    }

    let saat = null, dakika = 0;
    const dakikaAl = i => { // sayıdan sonra "buçuk" ya da "30"
      const t = s[i];
      if (!t || t.kullanildi) return i;
      if (BUCUK.includes(t.k)) { dakika = 30; t.kullanildi = true; return i + 1; }
      if (/^(00|15|30|45)$/.test(t.k) && !t.ek) { dakika = Number(t.k); t.kullanildi = true; return i + 1; }
      return i;
    };
    // 1) "15:30" / "15.30"
    for (let i = 0; i < s.length && saat === null; i++) {
      const m = !s[i].kullanildi && s[i].k.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m) continue;
      s[i].kullanildi = true; parcaYut(s, i + 1);
      if (Number(m[1]) < 24 && Number(m[2]) < 60) { saat = Number(m[1]); dakika = Number(m[2]); bolum = 'kesin'; }
      else saat = NaN;
    }
    // 2) "saat 3", 3) "4 buçuk", 4) "üçte" / "3'te" / "3 de", 5) tek başına rakam
    const dene = kosul => {
      for (let i = 0; i < s.length && saat === null; i++) {
        const n = sayiOku(s, i);
        if (!n || !kosul(n, i)) continue;
        kullan(s, i, n.uzunluk);
        const sonra = dakikaAl(i + n.uzunluk);
        parcaYut(s, sonra);
        saat = n.deger;
      }
    };
    dene((n, i) => i > 0 && s[i - 1].k.startsWith('saat'));
    dene((n, i) => { const t = s[i + n.uzunluk]; return t && !t.kullanildi && BUCUK.includes(t.k); });
    dene((n, i) => n.ekli || (s[i + n.uzunluk] && !s[i + n.uzunluk].kullanildi && PARCA.includes(s[i + n.uzunluk].k) && /^\d/.test(s[i].k)));
    dene((n, i) => /^\d{1,2}$/.test(s[i].k));

    if (saat === null || Number.isNaN(saat) || saat > 23) return { saat: null, buAksam };
    const ac = BR.dakika(ayar.acilis), kap = BR.dakika(ayar.kapanis);
    if (bolum === 'aksam' && saat < 12) saat += 12;
    else if (bolum === 'ogle' && saat <= 4) saat += 12;
    else if (!bolum && saat < 12 && saat * 60 + dakika < ac && (saat + 12) * 60 + dakika < kap) saat += 12; // "üç" = 15:00
    return { saat: BR.saatYaz(saat * 60 + dakika), buAksam };
  }

  /* ---------- işlem ---------- */
  function islemBul(s, islemler) {
    const bulunan = [];
    const adaylar = (islemler || []).filter(i => !i.silindi).map(i => ({ i, soz: sade(i.ad).split(' ').filter(Boolean) }))
      .filter(a => a.soz.length).sort((a, b) => b.soz.length - a.soz.length || b.i.ad.length - a.i.ad.length);
    const uyar = (k, soz) => k === soz || (k.length >= 4 && soz.length >= 4 && (k.startsWith(soz) || soz.startsWith(k)));
    for (const a of adaylar) {
      for (let bas = 0; bas < s.length; bas++) {
        let i = bas, n = 0;
        const yerler = [];
        while (n < a.soz.length && s[i] && !s[i].kullanildi) {
          if (uyar(s[i].k, a.soz[n])) { yerler.push(i); n++; i++; }
          else if (n > 0 && s[i].k === 've') { yerler.push(i); i++; }
          else break;
        }
        if (n === a.soz.length) { for (const y of yerler) s[y].kullanildi = true; bulunan.push({ yer: bas, islem: a.i }); break; }
      }
    }
    bulunan.sort((x, y) => x.yer - y.yer);
    return bulunan.map(b => b.islem);
  }

  BR.sesCoz = (metin, baglam) => {
    const s = sozcukler(metin);
    const tarih = tarihBul(s, baglam.bugun);
    const zaman = saatBul(s, baglam.ayar);
    const islemler = islemBul(s, baglam.islemler);
    const ad = s.filter(t => !t.kullanildi && !DOLGU.has(t.k))
      .map(t => t.ham.charAt(0).toLocaleUpperCase('tr') + tr(t.ham.slice(1))).join(' ');
    return {
      ad,
      tarih: tarih || (zaman.buAksam ? baglam.bugun : null),
      saat: zaman.saat,
      islemId: islemler.length ? islemler[0].id : null,
      ekIslemler: islemler.slice(1).map(i => i.ad),
    };
  };

  if (typeof module !== 'undefined') module.exports = BR;
})(globalThis);
