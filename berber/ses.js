// Berber Randevu — sesle söylenen cümleyi randevu alanlarına ayırır (saf fonksiyon, Node ile test edilir).
// "Ahmet Kaya yarın saat üç saç sakal" → { ad: 'Ahmet Kaya', tarih: yarın, saat: '15:00', islemId: 'sacsakal' }
// Sıra: ölçü birimleri → tarih → saat → işlem; hiçbirine girmeyen ve dolgu olmayan sözcükler isimdir.
(function (g) {
  const BR = g.BR || (typeof require !== 'undefined' ? require('./hesap.js') : (g.BR = {}));

  const tr = s => s.toLocaleLowerCase('tr');
  const sade = s => tr(s).replace(/tra[sş]/g, 'tıraş').replace(/[+&/]/g, ' ').replace(/\s+/g, ' ').trim();

  const BIRLER = { bir: 1, iki: 2, üç: 3, dört: 4, dörd: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 };
  const ONLAR = { on: 10, yirmi: 20 };
  const SAYI_EKI = ['de', 'da', 'te', 'ta', 'e', 'a', 'ye', 'ya', 'den', 'dan', 'ten', 'tan']; // "üçte", "dörde", "beşten"
  const PARCA = ['de', 'da', 'te', 'ta', 'e', 'a', 'ye', 'ya'];                                 // ayrı yazılan ek: "3 de"
  const GUN_EKI = ['i', 'ı', 'u', 'ü', 'si', 'sı', 'su', 'sü', 'inde', 'ında', 'unda', 'ünde', 'sinde', 'sında', 'sunda', 'sünde',
    'ine', 'ına', 'una', 'üne', 'sine', 'sına', 'suna', 'süne'];                                 // "25'i", "22'sinde": ayın günü
  const BUCUK = ['buçuk', 'bucuk', 'buçukta', 'bucukta', 'buçuğa', 'buçukda'];
  const YARIM = ['yarım', 'yarımda', 'yarıma'];                                                  // 12:30
  const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  const AY_TAMLAMA = ['ocağın', 'şubatın', 'martın', 'nisanın', 'mayısın', 'haziranın', 'temmuzun', 'ağustosun', 'eylülün', 'ekimin', 'kasımın', 'aralığın'];
  const GUNLER = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar']; // Pazartesi = 0
  const YER_EKI = ['', 'da', 'de', 'ta', 'te', 'a', 'e', 'ya', 'ye', 'ki'];
  // Günün bölümü: tam sözcük eşleşir ki "Sabahattin", "Akşamoğlu" gibi isimler yutulmasın.
  const BOLUM = {
    sabah: ['sabah', 'sabaha', 'sabahı', 'sabahleyin', 'sabahtan', 'sabahki'],
    aksam: ['akşam', 'akşama', 'akşamı', 'akşamleyin', 'akşamki', 'akşamüstü', 'akşamüzeri', 'gece', 'geceye', 'gecesi'],
    ogle: ['öğle', 'öğlen', 'öğleyin', 'öğlenleyin', 'öğleye', 'öğlene', 'öğlende'],
  };
  const OLCU = ['kişi', 'kişilik', 'lira', 'liraya', 'liralık', 'tl'];                            // "2 kişi", "350 lira": saat değil
  const DOLGU = new Set(['saat', 'saate', 'saatinde', 'için', 'icin', 'randevu', 'randevusu', 'randevuyu', 'yaz', 'yazalım', 'ekle',
    'kaydet', 'olsun', 'olacak', 'günü', 'kesimi', 'kesim', 'tıraşı', 'tıraş', 've', 'artı', 'bu', 'bir', 'tane', 'lütfen', 'adına', 'ismine',
    'müşteri', 'de', 'da', 'te', 'ta', 'gibi', 'civarı', 'civarında', 'sularında', 'suları', 'üstü', 'üzeri', 'sonra', 'tamam', 'yeni',
    'önümüzdeki', 'gelecek', 'hafta', 'haftası', 'değil']);
  const BAGLAC = ['ve', 'artı'];
  const ISLEM_EKI = ['ı', 'i', 'u', 'ü', 'a', 'e', 'ya', 'ye', 'yı', 'yi', 'yu', 'yü', 'da', 'de', 'ta', 'te', 'sı', 'si'];

  // Sözcüğü köke ve eke ayırır: kesme işaretinden sonrası ektir ("3'te", "Ahmet'e"). Yalnızca işaretten oluşanlar ("+") yutulur.
  function sozcukler(metin) {
    return String(metin || '').replace(/[,;!?()"“”]/g, ' ').split(/\s+/).filter(Boolean).map(ham => {
      const temiz = ham.replace(/\.+$/, ''), m = temiz.match(/^(.+?)['’`](.*)$/);
      const kok = m ? m[1] : temiz, k = sade(kok);
      return { ham: kok, k, ek: m ? tr(m[2]) : '', kullanildi: k === '' };
    }).filter(s => s.ham);
  }

  // i. sözcükten başlayan sayıyı okur. ekli: saat olduğunu belli eden bir ek taşıyor ("üçte", "3'te"). yazi: rakamla değil sözcükle.
  function sayiOku(s, i) {
    const t = s[i];
    if (!t || t.kullanildi) return null;
    if (/^\d{1,2}$/.test(t.k)) return { deger: Number(t.k), uzunluk: 1, ekli: t.ek !== '' && !GUN_EKI.includes(t.ek), yazi: false };
    const birOku = (k, ek) => {
      for (const kok in BIRLER) {
        if (k === kok) return { deger: BIRLER[kok], ekli: ek !== '' };
        if (k.startsWith(kok) && SAYI_EKI.includes(k.slice(kok.length))) return { deger: BIRLER[kok], ekli: true };
      }
      return null;
    };
    for (const kok in ONLAR) {
      if (t.k === kok && t.ek === '') {
        const sonraki = s[i + 1], bir = sonraki && !sonraki.kullanildi ? birOku(sonraki.k, sonraki.ek) : null;
        if (bir) return { deger: ONLAR[kok] + bir.deger, uzunluk: 2, ekli: bir.ekli, yazi: true };
        return { deger: ONLAR[kok], uzunluk: 1, ekli: false, yazi: true };
      }
      if (t.k === kok || (t.k.startsWith(kok) && SAYI_EKI.includes(t.k.slice(kok.length)))) return { deger: ONLAR[kok], uzunluk: 1, ekli: true, yazi: true };
    }
    const bir = birOku(t.k, t.ek);
    return bir ? { deger: bir.deger, uzunluk: 1, ekli: bir.ekli, yazi: true } : null;
  }

  const bos = t => t && !t.kullanildi;
  const kullan = (s, bas, adet) => { for (let i = bas; i < bas + adet; i++) if (s[i]) s[i].kullanildi = true; };
  const parcaYut = (s, i) => { if (bos(s[i]) && PARCA.includes(s[i].k) && !s[i].ek) s[i].kullanildi = true; };

  // "2 kişi", "350 lira": sayı saat sanılmasın, isme de karışmasın.
  function olculeriYut(s) {
    for (let i = 0; i < s.length; i++) {
      if (!bos(s[i])) continue;
      const rakam = /^\d+$/.test(s[i].k), n = rakam ? { uzunluk: 1 } : sayiOku(s, i);
      if (n && bos(s[i + n.uzunluk]) && OLCU.includes(s[i + n.uzunluk].k)) kullan(s, i, n.uzunluk + 1);
    }
  }

  /* ---------- tarih ---------- */
  // Öncelik: açık tarih ("25 kasım", "ayın 25'i", "25'inde") > göreli (bugün, yarın, 3 gün sonra) > gün adı.
  // Eşleşen her sözcük yutulur ki isme karışmasın.
  function tarihBul(s, bugun) {
    const bd = BR.tarihOku(bugun), bugunSira = BR.ptSira(bd);
    const esit = (k, kok) => k.startsWith(kok) && YER_EKI.includes(k.slice(kok.length));
    const rakam = t => bos(t) && /^\d{1,2}$/.test(t.k);
    let acik, acikVar = false;
    const ayGunu = (ay, gun) => { // verilen ay ve gün: bu yıl geçtiyse gelecek yıl
      acikVar = true;
      for (const yil of [bd.getFullYear(), bd.getFullYear() + 1]) {
        const d = new Date(yil, ay, gun);
        if (!acik && d.getMonth() === ay && d.getDate() === gun && BR.tarihYaz(d) >= bugun) acik = BR.tarihYaz(d);
      }
    };
    const ayinGunu = gun => { // yalnızca gün: bu ay geçtiyse gelecek ay
      acikVar = true;
      for (const ek of [0, 1]) {
        const d = new Date(bd.getFullYear(), bd.getMonth() + ek, gun);
        if (!acik && d.getDate() === gun && BR.tarihYaz(d) >= bugun) acik = BR.tarihYaz(d);
      }
    };
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      if (!bos(t)) continue;
      const ay = AYLAR.findIndex(a => esit(t.k, a));
      const tamlama = AYLAR.findIndex((a, n) => (t.k === a && ['ın', 'in', 'un', 'ün'].includes(t.ek)) || t.k === AY_TAMLAMA[n]);
      if (tamlama >= 0 && rakam(s[i + 1])) { ayGunu(tamlama, Number(s[i + 1].k)); kullan(s, i, 2); }                 // "Kasım'ın 25'i"
      else if (ay >= 0 && !t.ek && rakam(s[i - 1]) && !(s[i - 2] && s[i - 2].k.startsWith('saat'))) {                 // "25 Kasım"
        ayGunu(ay, Number(s[i - 1].k)); kullan(s, i - 1, 2);
      } else if (t.k === 'ayın' && rakam(s[i + 1])) { ayinGunu(Number(s[i + 1].k)); kullan(s, i, 2); }               // "ayın 25'i"
    }
    for (const t of s) if (rakam(t) && GUN_EKI.includes(t.ek)) { ayinGunu(Number(t.k)); t.kullanildi = true; }       // "25'inde"

    let goreli, gunSira, haftaya = false, son = null; // son: "değil" gelirse geri alınacak atama
    for (let i = 0; i < s.length; i++) {
      const t = s[i], sonraki = s[i + 1];
      if (!bos(t)) continue;
      if (t.k === 'değil' && son && son.bitis === i) { if (son.tur === 'goreli') goreli = undefined; else gunSira = undefined; t.kullanildi = true; son = null; continue; }
      if (t.k === 'haftaya') { haftaya = true; t.kullanildi = true; continue; }
      if ((t.k === 'gelecek' || t.k === 'önümüzdeki') && bos(sonraki) && sonraki.k.startsWith('hafta')) { haftaya = true; kullan(s, i, 2); continue; }
      const n = sayiOku(s, i); // "3 gün sonra", "iki hafta sonra"
      if (n && bos(s[i + n.uzunluk]) && bos(s[i + n.uzunluk + 1]) && s[i + n.uzunluk + 1].k === 'sonra' && ['gün', 'hafta'].includes(s[i + n.uzunluk].k)) {
        if (goreli === undefined) goreli = n.deger * (s[i + n.uzunluk].k === 'hafta' ? 7 : 1);
        kullan(s, i, n.uzunluk + 2); son = null; continue;
      }
      let g = null, adet = 1;
      if (esit(t.k, 'bugün')) g = 0;
      else if (t.k === 'yarından' && sonraki && sonraki.k === 'sonra') { g = 2; adet = 2; }
      else if (esit(t.k, 'yarın')) g = 1;
      else if ((t.k === 'öbür' || t.k === 'öbürsü') && sonraki && sonraki.k.startsWith('gün')) { g = 2; adet = 2; }
      if (g !== null) {
        kullan(s, i, adet);
        if (goreli === undefined) { goreli = g; son = { tur: 'goreli', bitis: i + adet }; }
        continue;
      }
      const sira = [5, 0, 2, 3, 1, 4, 6].find(x => esit(t.k, GUNLER[x])); // uzun adlar önce: "cumartesi", "cuma"dan önce
      if (sira !== undefined) {
        t.kullanildi = true;
        if (gunSira === undefined) { gunSira = sira; son = { tur: 'gun', bitis: i + 1 }; }
      }
    }
    if (acikVar) return acik || null;
    if (goreli !== undefined) return BR.gunEkle(bugun, goreli + (haftaya ? 7 : 0));
    if (gunSira !== undefined) return BR.gunEkle(bugun, haftaya ? 7 - bugunSira + gunSira : (gunSira - bugunSira + 7) % 7);
    return haftaya ? BR.gunEkle(bugun, 7) : null;
  }

  /* ---------- saat ---------- */
  function saatBul(s, ayar) {
    let bolum = null, buAksam = false;
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      if (!bos(t)) continue;
      let b = null, adet = 1;
      if (t.k === 'öğleden' && s[i + 1] && s[i + 1].k === 'sonra') { b = 'aksam'; adet = 2; }
      else b = Object.keys(BOLUM).find(x => BOLUM[x].includes(t.k)) || null;
      if (!b) continue;
      if (i > 0 && bos(s[i - 1]) && s[i - 1].k === 'bu') { s[i - 1].kullanildi = true; buAksam = true; }
      kullan(s, i, adet); bolum = bolum || b;
    }

    let saat = null, dakika = 0, kesin = false;
    const dakikaAl = (i, serbest) => { // sayıdan sonra "buçuk" ya da dakika
      const t = s[i];
      if (!bos(t)) return i;
      if (BUCUK.includes(t.k)) { dakika = 30; t.kullanildi = true; return i + 1; }
      if ((serbest ? /^[0-5]\d$/ : /^(00|15|30|45)$/).test(t.k) && !t.ek) { dakika = Number(t.k); t.kullanildi = true; return i + 1; }
      return i;
    };
    // "yarım" = 12:30
    for (let i = 0; i < s.length && saat === null; i++) {
      if (bos(s[i]) && YARIM.includes(s[i].k)) { s[i].kullanildi = true; saat = 12; dakika = 30; kesin = true; }
    }
    // "15:30" / "15.30". Baştaki sıfır ya da 12 ve üstü: aynen alınır; "7:30" gibi yazımlarda öğleden sonra kuralı yine geçerli.
    for (let i = 0; i < s.length && saat === null; i++) {
      const m = bos(s[i]) && s[i].k.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m) continue;
      s[i].kullanildi = true; parcaYut(s, i + 1);
      if (Number(m[1]) < 24 && Number(m[2]) < 60) { saat = Number(m[1]); dakika = Number(m[2]); kesin = saat >= 12 || m[1].length === 2; }
      else saat = NaN;
    }
    // sırayla: "saat 3" → "4 buçuk" → "üçte" / "3'te" / "3 de" → tek başına rakam → tek başına sayı sözcüğü ("üç", "on bir")
    const dene = (kosul, serbest) => {
      for (let i = 0; i < s.length && saat === null; i++) {
        const n = sayiOku(s, i);
        if (!n || !kosul(n, i)) continue;
        kullan(s, i, n.uzunluk);
        parcaYut(s, dakikaAl(i + n.uzunluk, serbest));
        saat = n.deger;
      }
    };
    dene((n, i) => i > 0 && s[i - 1].k.startsWith('saat'), true);
    dene((n, i) => { const t = s[i + n.uzunluk]; return bos(t) && BUCUK.includes(t.k); });
    dene((n, i) => n.ekli || (!n.yazi && bos(s[i + n.uzunluk]) && PARCA.includes(s[i + n.uzunluk].k)));
    dene(n => !n.yazi);
    dene(n => n.yazi && !(n.deger === 1 && n.uzunluk === 1)); // tek başına "bir" saat değildir ("bir saç")

    if (saat === null || Number.isNaN(saat) || saat > 23) return { saat: null, buAksam };
    const ac = BR.dakika(ayar.acilis), kap = BR.dakika(ayar.kapanis);
    if (!kesin) {
      if (bolum === 'aksam' && saat < 12) saat += 12;
      else if (bolum === 'ogle' && saat <= 4) saat += 12;
      else if (!bolum && saat < 12 && saat * 60 + dakika < ac && (saat + 12) * 60 + dakika <= kap) saat += 12; // "üç" = 15:00
    }
    return { saat: BR.saatYaz(saat * 60 + dakika), buAksam };
  }

  /* ---------- işlem ---------- */
  function islemBul(s, islemler) {
    const bulunan = [];
    const adaylar = (islemler || []).filter(i => !i.silindi).map(i => ({ i, soz: sade(i.ad).split(' ').filter(Boolean) }))
      .filter(a => a.soz.length).sort((a, b) => b.soz.length - a.soz.length || b.i.ad.length - a.i.ad.length);
    // Sözcük işlem adına uyar mı: aynısı, ek almış hali ("sakala") ya da iyelik eki düşmüş hali ("bakım" ~ "bakımı").
    const uyar = (k, soz) => k === soz ||
      (soz.length >= 4 && k.startsWith(soz) && ISLEM_EKI.includes(k.slice(soz.length))) ||
      (k.length >= 4 && soz.startsWith(k) && ['ı', 'i', 'u', 'ü'].includes(soz.slice(k.length)));
    const diziAra = (soz, islem) => {
      for (let bas = 0; bas < s.length; bas++) {
        let i = bas, n = 0;
        const yerler = [];
        while (n < soz.length && s[i]) {
          if (bos(s[i]) && uyar(s[i].k, soz[n])) { yerler.push(i); n++; i++; }
          else if (n > 0 && (s[i].k === '' || (bos(s[i]) && BAGLAC.includes(s[i].k)))) { yerler.push(i); i++; } // "saç ve sakal", "saç + sakal"
          else break;
        }
        if (n === soz.length) { for (const y of yerler) s[y].kullanildi = true; bulunan.push({ yer: bas, islem }); return true; }
      }
      return false;
    };
    for (const a of adaylar) diziAra(a.soz, a.i) || (a.soz.length > 1 && diziAra(a.soz.slice().reverse(), a.i)); // "sakal saç" da olur
    // Çok sözcüklü bir işlemin yalnızca kendine ait tek sözcüğü: "fön" → Yıkama + Fön, "çocuk" → Çocuk Tıraşı
    for (let i = 0; i < s.length; i++) {
      if (!bos(s[i]) || DOLGU.has(s[i].k)) continue;
      const uyanlar = adaylar.filter(a => a.soz.length > 1 && a.soz.some(w => uyar(s[i].k, w)));
      if (uyanlar.length === 1 && !bulunan.some(b => b.islem === uyanlar[0].i)) { s[i].kullanildi = true; bulunan.push({ yer: i, islem: uyanlar[0].i }); }
    }
    bulunan.sort((x, y) => x.yer - y.yer);
    return bulunan.map(b => b.islem);
  }

  BR.sesCoz = (metin, baglam) => {
    const s = sozcukler(metin);
    olculeriYut(s);
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
