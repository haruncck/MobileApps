// Berber Randevu — demo için sabit tohumlu örnek veri. Aynı gün için her zaman aynı çıktıyı üretir.
(function (g) {
  const BR = g.BR || (typeof require !== 'undefined' ? require('./hesap.js') : (g.BR = {}));

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const tohum = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h; };

  const ADLAR = ['Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'İsmail', 'Osman', 'Yusuf', 'Murat', 'Ömer',
    'Ramazan', 'Halil', 'Süleyman', 'Emre', 'Burak', 'Mert', 'Can', 'Kerem', 'Onur', 'Serkan', 'Volkan', 'Gökhan', 'Tolga', 'Barış',
    'Cem', 'Deniz', 'Eren', 'Furkan', 'Kaan', 'Oğuz', 'Selim', 'Tuncay', 'Uğur', 'Yiğit', 'Berk', 'Enes', 'Harun', 'Kadir', 'Levent',
    'Metin', 'Necati', 'Okan', 'Recep', 'Sinan', 'Taner', 'Ufuk', 'Yasin', 'Zafer'];
  const SOYADLAR = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan',
    'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Erdoğan', 'Güneş', 'Aksoy', 'Tekin'];
  // [işlem id, ağırlık, temsili fiyat]
  const AGIRLIK = [['sac', 30, 350], ['sakal', 12, 150], ['sacsakal', 38, 450], ['cocuk', 8, 250], ['agda', 4, 100], ['fon', 4, 150], ['cilt', 4, 300]];
  // Pazartesi başlangıçlı gün yoğunluğu [en az, en çok]
  const YOGUNLUK = [[6, 9], [7, 11], [7, 11], [7, 11], [9, 13], [10, 14], [0, 0]];
  const AY_GERI = 24, GUN_ILERI = 6;        // iki yıl: yıllık karşılaştırma da dolu görünsün
  const YETISKIN = 300, COCUK = 40, ARA_GUN = 14; // aynı müşteri en erken 14 gün sonra yeniden gelir

  BR.ORNEK_FIYAT = Object.fromEntries(AGIRLIK.map(a => [a[0], a[2]]));

  // "Örnekleri sil": yalnızca örnek randevuları ve değiştirilmemiş örnek fiyatları siler; kullanıcının eklediği her şey kalır.
  BR.ornekleriSil = veri => ({
    ayar: Object.assign({}, veri.ayar, { ornek: false, ornekGun: '' }),
    islemler: veri.islemler.map(i => Object.assign({}, i, BR.ORNEK_FIYAT[i.id] === i.fiyat ? { fiyat: null } : {})),
    randevular: veri.randevular.filter(r => r.ornek !== true),
  });

  // Örnek veriler kayıtlıyken gün değiştiyse: örnekler bugüne göre yeniden üretilir, kullanıcının kendi kayıtları,
  // ayarları ve işlemleri olduğu gibi kalır. Böylece demo bir hafta sonra açıldığında da dolu görünür.
  BR.ornekYenile = (veri, bugun) => ({
    ayar: Object.assign({}, veri.ayar, { ornek: true, ornekGun: bugun }),
    islemler: veri.islemler,
    randevular: BR.ornekVeri(bugun).randevular.concat(veri.randevular.filter(r => r.ornek !== true)),
  });

  BR.ornekVeri = bugun => {
    const veri = BR.varsayilanVeri();
    veri.ayar.ornek = true;
    veri.ayar.ornekGun = bugun;
    veri.ayar.dukkan = 'By Lider Erkek Kuaförü';
    for (const i of veri.islemler) i.fiyat = BR.ORNEK_FIYAT[i.id];
    const islem = id => veri.islemler.find(i => i.id === id);

    // Sabit müşteri havuzları. Örnek kayıtlarda telefon yoktur: uydurma bir numara gerçek birine ait çıkabilir.
    const hr = mulberry32(20261121), adlar = new Set();
    const havuzUret = adet => {
      const liste = [];
      while (liste.length < adet) {
        const ad = ADLAR[Math.floor(hr() * ADLAR.length)] + ' ' + SOYADLAR[Math.floor(hr() * SOYADLAR.length)];
        if (!adlar.has(ad)) { adlar.add(ad); liste.push(ad); }
      }
      return liste;
    };
    const yetiskinler = havuzUret(YETISKIN), cocuklar = havuzUret(COCUK), sonGelis = new Map();

    const bd = BR.tarihOku(bugun);
    const ilk = BR.tarihYaz(new Date(bd.getFullYear(), bd.getMonth() - AY_GERI, bd.getDate()));
    const sonGun = BR.gunEkle(bugun, GUN_ILERI);
    const toplamGun = Math.round((bd - BR.tarihOku(ilk)) / 864e5);
    const ac = BR.dakika(veri.ayar.acilis), kap = BR.dakika(veri.ayar.kapanis);
    let no = 0;

    for (let tarih = ilk, gunNo = 0; tarih <= sonGun; tarih = BR.gunEkle(tarih, 1), gunNo++) {
      const [enAz, enCok] = YOGUNLUK[BR.ptSira(BR.tarihOku(tarih))];
      if (!enCok) continue;
      const r = mulberry32(tohum(tarih));
      let adet = enAz + Math.floor(r() * (enCok - enAz + 1));
      if (tarih < bugun) adet = Math.max(4, Math.round(adet * (0.78 + 0.22 * gunNo / toplamGun))); // zamanla büyüyen dükkân
      if (tarih === bugun) adet = Math.max(adet, 10);
      if (tarih > bugun) adet = Math.max(3, Math.round(adet * (1 - 0.13 * Math.round((BR.tarihOku(tarih) - bd) / 864e5))));

      const gun = [];
      for (let k = 0; k < adet; k++) {
        let zar = r() * 100, secim = AGIRLIK[0];
        for (const a of AGIRLIK) { if (zar < a[1]) { secim = a; break; } zar -= a[1]; }
        const is = islem(secim[0]), havuz = is.id === 'cocuk' ? cocuklar : yetiskinler;
        for (let deneme = 0; deneme < 40; deneme++) {
          const ad = havuz[Math.floor(havuz.length * r())];
          const saat = BR.saatYaz(ac + 30 * Math.floor(r() * ((kap - ac) / 30))), b = BR.dakika(saat);
          if (b + is.sure > kap || (sonGelis.has(ad) && gunNo - sonGelis.get(ad) < ARA_GUN) ||
              gun.some(x => BR.dakika(x.saat) < b + is.sure && BR.dakika(x.saat) + x.sure > b)) continue;
          let durum = 'bekliyor';
          if (tarih < bugun) { const z = r(); durum = z < 0.04 ? 'gelmedi' : z < 0.06 ? 'iptal' : 'bekliyor'; }
          gun.push({ id: 'o' + (no++), tarih, saat, sure: is.sure, ad, tel: '',
            islemId: is.id, islemAd: is.ad, fiyat: is.fiyat, durum, not: '', ornek: true });
          sonGelis.set(ad, gunNo);
          break;
        }
      }
      gun.sort((x, y) => x.saat.localeCompare(y.saat));
      veri.randevular.push(...gun);
    }
    return veri;
  };

  if (typeof module !== 'undefined') module.exports = BR;
})(globalThis);
