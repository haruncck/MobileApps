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
    giderler: (veri.giderler || []).filter(g => g.ornek !== true),
    sabitGiderler: (veri.sabitGiderler || []).filter(s => s.ornek !== true),
  });

  // Örnek veriler kayıtlıyken gün değiştiyse: örnekler bugüne göre yeniden üretilir, kullanıcının kendi kayıtları,
  // ayarları ve işlemleri olduğu gibi kalır. Böylece demo bir hafta sonra açıldığında da dolu görünür.
  BR.ornekYenile = (veri, bugun) => {
    const yeni = BR.ornekVeri(bugun);
    return {
      ayar: Object.assign({}, veri.ayar, { ornek: true, ornekGun: bugun }),
      islemler: veri.islemler,
      randevular: yeni.randevular.concat(veri.randevular.filter(r => r.ornek !== true)),
      giderler: yeni.giderler.concat((veri.giderler || []).filter(g => g.ornek !== true)),
      sabitGiderler: yeni.sabitGiderler.concat((veri.sabitGiderler || []).filter(s => s.ornek !== true)),
    };
  };

  // Örnek giderler: kira ve maaş her ay (sabit gider olarak), faturalar, malzeme ve üç ayda bir vergi. Tutarlar temsilidir.
  function ornekGiderler(veri, ilk, bugun) {
    const buAy = bugun.slice(0, 7), buYil = Number(bugun.slice(0, 4)), ilkAy = ilk.slice(0, 7);
    const MALZEME = ['Jilet, tıraş köpüğü', 'Havlu, önlük', 'Wax, saç spreyi', 'Kolonya, losyon', 'Makine başlığı, tarak'];
    const iki = n => String(n).padStart(2, '0');
    let no = 0;
    const yaz = (tarih, tutar, tur, not, sabitId) => {
      if (tarih < ilk || tarih > bugun) return;
      veri.giderler.push(Object.assign({ id: 'og' + (no++), tarih, tutar, tur, not }, sabitId ? { sabitId } : {}, { ornek: true }));
    };
    for (let ay = ilkAy; ay <= buAy; ay = (Number(ay.slice(5)) === 12 ? (Number(ay.slice(0, 4)) + 1) + '-01' : ay.slice(0, 5) + iki(Number(ay.slice(5)) + 1))) {
      const r = mulberry32(tohum('gider' + ay)), yil = Number(ay.slice(0, 4)), a = Number(ay.slice(5));
      const arasi = (az, cok, adim) => az + adim * Math.floor(r() * ((cok - az) / adim + 1));
      const gun = (az, cok) => ay + '-' + iki(az + Math.floor(r() * (cok - az + 1)));
      yaz(ay + '-01', yil < buYil ? 15000 : 18000, 'Kira', 'Dükkân kirası', 'ornek-kira');
      yaz(gun(8, 12), arasi(400, 700, 50), 'Fatura', 'Su');
      yaz(gun(13, 18), arasi(1800, 2600, 100), 'Fatura', 'Elektrik');
      yaz(gun(15, 19), [11, 12, 1, 2, 3].includes(a) ? arasi(900, 1800, 100) : arasi(150, 300, 50), 'Fatura', 'Doğalgaz');
      yaz(ay + '-20', 450, 'Fatura', 'İnternet');
      for (let k = 0, adet = 2 + Math.floor(r() * 2); k < adet; k++) yaz(gun(2, 27), arasi(900, 2400, 100), 'Malzeme', MALZEME[Math.floor(r() * MALZEME.length)]);
      if (a % 3 === 1) yaz(ay + '-17', 3000, 'Vergi', 'Geçici vergi');
      yaz(ay + '-28', 20000, 'Maaş', 'Kalfa maaşı', 'ornek-maas');
    }
    veri.giderler.sort((x, y) => x.tarih.localeCompare(y.tarih));
    const oncekiAy = buAy.slice(5) === '01' ? (buYil - 1) + '-12' : buAy.slice(0, 5) + iki(Number(buAy.slice(5)) - 1);
    veri.sabitGiderler.push(
      { id: 'ornek-kira', tur: 'Kira', tutar: 18000, gun: 1, not: 'Dükkân kirası', baslangic: ilkAy, sonAy: buAy, ornek: true },
      { id: 'ornek-maas', tur: 'Maaş', tutar: 20000, gun: 28, not: 'Kalfa maaşı', baslangic: ilkAy, sonAy: bugun.slice(8) >= '28' ? buAy : oncekiAy, ornek: true });
  }

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
    ornekGiderler(veri, ilk, bugun);
    return veri;
  };

  if (typeof module !== 'undefined') module.exports = BR;
})(globalThis);
