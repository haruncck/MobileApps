const { BR, test, eq, deepEq, ok } = require('./yardim.js');

const simdi = new Date(2026, 10, 24, 17, 0); // 24 Kasım 2026 Salı 17:00
const g = (id, tarih, tutar, tur = 'Diğer', o = {}) => ({ id, tarih, tutar, tur, not: '', ...o });
const rnd = (tarih, saat, fiyat) => ({ id: tarih + saat, tarih, saat, sure: 30, ad: 'X', tel: '', islemId: 'sac', islemAd: 'Saç', fiyat, durum: 'bekliyor', not: '' });

test('varsayilanVeri gider alanlarıyla gelir; gider türleri sabit listedir', () => {
  const v = BR.varsayilanVeri();
  deepEq(v.giderler, []); deepEq(v.sabitGiderler, []);
  deepEq(BR.GIDER_TURLERI, ['Kira', 'Fatura', 'Malzeme', 'Maaş', 'Vergi', 'Diğer']);
});
test('dogrula: gider alanı olmayan eski kayıt açılır', () => {
  const v = BR.dogrula({ ayar: {}, islemler: [], randevular: [] });
  deepEq(v.giderler, []); deepEq(v.sabitGiderler, []);
});
test('dogrula: bozuk giderler atılır, eksikler tamamlanır', () => {
  const v = BR.dogrula({ ayar: {}, islemler: [], randevular: [],
    giderler: [g('a', '2026-11-01', 22000, 'Kira'), g('a', '2026-11-02', 50, 'Uydurma'), g('c', 'bozuk', 10), g('d', '2026-11-03', 0), g('e', '2026-11-03', -5),
      g('f', '2026-11-03', 1e300), g('h', '2026-11-04', '120'), null, 'x', { id: 'i', tarih: '2026-11-05', tutar: 75.5, tur: 'Fatura', not: 'x'.repeat(500), sabitId: 's1', ornek: true }],
    sabitGiderler: [{ id: 's1', tur: 'Kira', tutar: 22000, gun: 1, not: '', baslangic: '2026-09', sonAy: '2026-11' }, { id: 's2', tur: 'Kira', tutar: 100, gun: 0 },
      { id: 's3', tur: 'Kira', tutar: 100, gun: 32 }, { id: 's4', tur: 'Yok', tutar: 100, gun: 15, baslangic: 'bozuk', sonAy: 5 }, { tur: 'Maaş', tutar: 0, gun: 5 }, null] });
  deepEq(v.giderler.map(x => [x.tarih, x.tutar, x.tur]), [['2026-11-01', 22000, 'Kira'], ['2026-11-02', 50, 'Diğer'], ['2026-11-05', 75.5, 'Fatura']]);
  ok(v.giderler[0].id !== v.giderler[1].id); // yinelenen id yenilenir
  eq(v.giderler[2].not.length, 200); eq(v.giderler[2].sabitId, 's1'); eq(v.giderler[2].ornek, true); ok(!('ornek' in v.giderler[0]));
  deepEq(v.sabitGiderler.map(x => [x.id, x.tur, x.gun, x.baslangic, x.sonAy]), [['s1', 'Kira', 1, '2026-09', '2026-11'], ['s4', 'Diğer', 15, '', '']]);
});
test('sabitleriIsle: vadesi gelen aylar için gider yazar, ikinci çağrıda yazmaz', () => {
  const v = BR.varsayilanVeri();
  v.sabitGiderler.push({ id: 's1', tur: 'Kira', tutar: 22000, gun: 1, not: 'Dükkân', baslangic: '2026-09', sonAy: '' });
  const bir = BR.sabitleriIsle(v, '2026-11-24');
  eq(bir.eklenen, 3); deepEq(bir.veri.giderler.map(x => x.tarih), ['2026-09-01', '2026-10-01', '2026-11-01']);
  ok(bir.veri.giderler.every(x => x.tutar === 22000 && x.tur === 'Kira' && x.not === 'Dükkân' && x.sabitId === 's1'));
  eq(new Set(bir.veri.giderler.map(x => x.id)).size, 3); eq(bir.veri.sabitGiderler[0].sonAy, '2026-11');
  eq(v.giderler.length, 0); eq(v.sabitGiderler[0].sonAy, ''); // girdi değişmez
  const iki = BR.sabitleriIsle(bir.veri, '2026-11-30'); eq(iki.eklenen, 0);
  const uc = BR.sabitleriIsle(bir.veri, '2026-12-01'); eq(uc.eklenen, 1); eq(uc.veri.giderler[3].tarih, '2026-12-01');
});
test('sabitleriIsle: günü gelmemiş ay yazılmaz; ayın son günü kısa aylara uyar; yıl döner; silinen geri gelmez', () => {
  const v = BR.varsayilanVeri();
  v.sabitGiderler.push({ id: 'm', tur: 'Maaş', tutar: 26000, gun: 28, not: '', baslangic: '2026-10', sonAy: '' });
  const a = BR.sabitleriIsle(v, '2026-11-24');
  deepEq(a.veri.giderler.map(x => x.tarih), ['2026-10-28']); eq(a.veri.sabitGiderler[0].sonAy, '2026-10');
  const w = BR.varsayilanVeri();
  w.sabitGiderler.push({ id: 'k', tur: 'Kira', tutar: 1, gun: 31, not: '', baslangic: '2027-12', sonAy: '' });
  deepEq(BR.sabitleriIsle(w, '2028-03-05').veri.giderler.map(x => x.tarih), ['2027-12-31', '2028-01-31', '2028-02-29']);
  const sil = a.veri; sil.giderler = [];                       // kullanıcı Ekim maaşını sildi
  eq(BR.sabitleriIsle(sil, '2026-11-27').eklenen, 0);           // geri gelmez
  eq(BR.sabitleriIsle(sil, '2026-11-28').eklenen, 1);
  const bos = BR.varsayilanVeri(); bos.sabitGiderler.push({ id: 'z', tur: 'Kira', tutar: 1, gun: 1, not: '', baslangic: '', sonAy: '' });
  eq(BR.sabitleriIsle(bos, '2026-11-24').eklenen, 1);           // başlangıç yoksa bu aydan başlar
});
test('istatistik: gider toplamı, türlere dağılım, fiyatsız randevu sayısı', () => {
  const rs = [rnd('2026-11-02', '10:00', 400), rnd('2026-11-03', '10:00', null), rnd('2026-11-30', '10:00', 400)];
  const gs = [g('a', '2026-11-01', 22000, 'Kira'), g('b', '2026-11-10', 1500, 'Fatura'), g('c', '2026-11-12', 500, 'Fatura'), g('d', '2026-11-28', 9999, 'Maaş'),
    g('e', '2026-10-01', 22000, 'Kira'), g('f', '2026-11-24', 1000.5, 'Malzeme')];
  const s = BR.istatistik(rs, 'ay', '2026-11-24', simdi, gs);
  eq(s.gider, 25000.5); eq(s.ciro, 400); eq(s.fiyatsiz, 1);
  deepEq(s.giderDagilim, [{ ad: 'Kira', tutar: 22000, yuzde: 88 }, { ad: 'Fatura', tutar: 2000, yuzde: 8 }, { ad: 'Malzeme', tutar: 1000.5, yuzde: 4 }]);
  const y = BR.istatistik(rs, 'yil', '2026-11-24', simdi, gs); eq(y.gider, 47000.5);
  const bos = BR.istatistik(rs, 'ay', '2026-11-24', simdi); eq(bos.gider, 0); deepEq(bos.giderDagilim, []); eq(bos.fiyatsiz, 1);
  eq(BR.istatistik(rs, 'gun', '2026-11-24', simdi, gs).gider, 1000.5);
});
test('örnek veri: giderler ve sabit giderler gelir; dolu bir ayda kâr artıdadır', () => {
  const v = BR.ornekVeri('2026-11-24');
  ok(v.giderler.length > 100 && v.giderler.every(x => x.ornek === true && x.tutar > 0 && BR.GIDER_TURLERI.includes(x.tur)));
  ok(v.sabitGiderler.length >= 2 && v.sabitGiderler.every(x => x.ornek === true));
  eq(BR.dogrula(JSON.parse(JSON.stringify(v))).giderler.length, v.giderler.length);
  eq(BR.sabitleriIsle(v, '2026-11-24').eklenen, 0);             // örnek sabitler zaten yazılmış
  ok(!v.giderler.some(x => x.tarih > '2026-11-24'));
  const ekim = BR.istatistik(v.randevular, 'ay', '2026-10-15', simdi, v.giderler);
  ok(ekim.gider > 30000 && ekim.ciro - ekim.gider > 5000, `ekim ciro ${ekim.ciro} gider ${ekim.gider}`);
  for (const ay of ['2025-03-10', '2026-02-10', '2026-07-10']) { const s = BR.istatistik(v.randevular, 'ay', ay, simdi, v.giderler); ok(s.ciro - s.gider > 0, ay); }
  deepEq(BR.ornekVeri('2026-11-24').giderler, v.giderler);       // her seferinde aynı
});
test('ornekleriSil ve ornekYenile kullanıcının giderlerine dokunmaz', () => {
  const v = BR.ornekVeri('2026-11-24');
  v.giderler.push(g('benim', '2026-11-20', 750, 'Malzeme'));
  v.sabitGiderler.push({ id: 'benimki', tur: 'Fatura', tutar: 300, gun: 10, not: '', baslangic: '2026-11', sonAy: '2026-11' });
  const t = BR.ornekleriSil(v);
  deepEq(t.giderler.map(x => x.id), ['benim']); deepEq(t.sabitGiderler.map(x => x.id), ['benimki']);
  const y = BR.ornekYenile(v, '2026-12-03');
  ok(y.giderler.some(x => x.id === 'benim') && y.sabitGiderler.some(x => x.id === 'benimki'));
  ok(y.giderler.filter(x => x.ornek).length > 100 && y.giderler.some(x => x.ornek && x.tarih === '2026-12-01'));
  eq(new Set(y.giderler.map(x => x.id)).size, y.giderler.length);
  eq(y.sabitGiderler.filter(x => x.ornek).length, v.sabitGiderler.filter(x => x.ornek).length);
});
