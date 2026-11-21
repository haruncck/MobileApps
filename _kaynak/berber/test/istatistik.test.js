const { BR, test, eq, deepEq, ok } = require('./yardim.js');

const simdi = new Date(2026, 10, 21, 15, 0);
const pick = d => ({ bas: d.bas, son: d.son });
const r = (tarih, saat, o = {}) => ({id: tarih+saat, tarih, saat, sure:30, ad:'X', islemAd:'Saç', fiyat:null, durum:'bekliyor', ...o});

test('sayilir', () => {
  ok(BR.sayilir(r('2026-11-21','14:30'), simdi));
  ok(!BR.sayilir(r('2026-11-21','15:30'), simdi));          // henüz başlamadı
  ok(!BR.sayilir(r('2026-11-20','10:00',{durum:'gelmedi'}), simdi));
  ok(!BR.sayilir(r('2026-11-20','10:00',{durum:'iptal'}), simdi));
  ok(BR.sayilir(r('2026-11-20','10:00',{durum:'geldi'}), simdi));
});
test('donem sınırları', () => {
  deepEq(pick(BR.donem('hafta','2026-11-21')), {bas:'2026-11-16', son:'2026-11-22'}); // Pt–Pz
  deepEq(pick(BR.donem('hafta','2026-11-22')), {bas:'2026-11-16', son:'2026-11-22'}); // Pazar
  deepEq(pick(BR.donem('ay','2028-02-10')), {bas:'2028-02-01', son:'2028-02-29'});
  deepEq(pick(BR.donem('yil','2026-11-21')), {bas:'2026-01-01', son:'2026-12-31'});
  deepEq(pick(BR.donem('gun','2026-11-21')), {bas:'2026-11-21', son:'2026-11-21'});
});
test('donem etiketleri', () => {
  eq(BR.donem('ay','2026-11-21').etiket, 'Kasım 2026');
  eq(BR.donem('yil','2026-11-21').etiket, '2026');
  eq(BR.donem('gun','2026-11-21').etiket, '21 Kasım 2026 Cumartesi');
  eq(BR.donem('hafta','2026-11-21').etiket, '16–22 Kasım 2026');
  eq(BR.donem('hafta','2026-12-30').etiket, '28 Aralık – 3 Ocak 2027');
});
test('donemKaydir', () => {
  eq(BR.donemKaydir('ay','2026-01-31', 1), '2026-02-28');
  eq(BR.donemKaydir('yil','2028-02-29', 1), '2029-02-28');
  eq(BR.donemKaydir('hafta','2026-12-30', 1), '2027-01-06');
  eq(BR.donemKaydir('gun','2026-12-31', 1), '2027-01-01');
  eq(BR.donemKaydir('ay','2026-01-15', -1), '2025-12-15');
});
test('istatistik ay', () => {
  const rs = [ r('2026-11-02','10:00',{fiyat:300}), r('2026-11-02','10:30',{islemAd:'Sakal',fiyat:150}),
               r('2026-11-09','10:10'), r('2026-11-10','12:00',{durum:'gelmedi'}),
               r('2026-11-11','12:00',{durum:'iptal'}), r('2026-11-28','10:00'), // gelecek
               r('2026-10-15','10:00'), r('2026-10-16','10:00') ];
  const s = BR.istatistik(rs, 'ay', '2026-11-21', simdi);
  eq(s.kisi, 3); eq(s.ciro, 450); ok(s.ciroVar); eq(s.gelmedi, 1); eq(s.iptal, 1); eq(s.oncekiKisi, 2);
  eq(s.seri.length, 30); eq(s.seri[1].kisi, 2); eq(s.seri[1].etiket, '2');
  deepEq(s.islemler, [{ad:'Saç', kisi:2, yuzde:67}, {ad:'Sakal', kisi:1, yuzde:33}]);
  deepEq(s.enYogunGun, {etiket:'Pazartesi', kisi:3}); deepEq(s.enYogunSaat, {saat:'10:00', kisi:3});
});
test('istatistik seri: hafta, yıl, gün', () => {
  const rs = [ r('2026-11-16','10:00'), r('2026-11-21','09:00'), r('2026-11-21','09:30'), r('2026-11-21','14:00'), r('2026-03-05','10:00') ];
  const h = BR.istatistik(rs, 'hafta', '2026-11-21', simdi);
  deepEq(h.seri.map(x => x.etiket), ['Pt','Sa','Ça','Pe','Cu','Ct','Pz']); deepEq(h.seri.map(x => x.kisi), [1,0,0,0,0,3,0]);
  const y = BR.istatistik(rs, 'yil', '2026-11-21', simdi);
  eq(y.seri[0].etiket, 'Oca'); eq(y.seri[11].etiket, 'Ara'); eq(y.seri[2].kisi, 1); eq(y.seri[10].kisi, 4); eq(y.kisi, 5);
  const gn = BR.istatistik(rs, 'gun', '2026-11-21', simdi);
  deepEq(gn.seri, [{etiket:'09:00', kisi:2}, {etiket:'14:00', kisi:1}]); eq(gn.enYogunGun, null); eq(gn.oncekiKisi, 0);
});
test('istatistik boş dönem', () => {
  const s = BR.istatistik([], 'yil', '2026-11-21', simdi);
  eq(s.kisi, 0); eq(s.ciro, 0); ok(!s.ciroVar); deepEq(s.islemler, []);
  eq(s.enYogunGun, null); eq(s.enYogunSaat, null); eq(s.seri.length, 12);
});
test('silinen işlemin geçmişi adını korur', () => {
  const s = BR.istatistik([r('2026-11-03','10:00',{islemId:'yok', islemAd:'Eski İşlem', fiyat:200})], 'ay', '2026-11-21', simdi);
  deepEq(s.islemler, [{ad:'Eski İşlem', kisi:1, yuzde:100}]); eq(s.ciro, 200);
});
