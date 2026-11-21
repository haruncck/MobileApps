const { BR, test, eq, deepEq, ok } = require('./yardim.js');

test('varsayilanVeri', () => {
  const v = BR.varsayilanVeri();
  eq(v.islemler.length, 7); eq(v.ayar.adim, 30); deepEq(v.ayar.kapali, [0]); eq(v.ayar.ornek, false);
  deepEq(v.islemler.map(i => [i.ad, i.sure, i.fiyat]), [['Saç',30,null], ['Sakal',15,null], ['Saç + Sakal',45,null],
    ['Çocuk Tıraşı',30,null], ['Ağda',15,null], ['Yıkama + Fön',15,null], ['Cilt Bakımı',30,null]]);
  eq(new Set(v.islemler.map(i => i.renk)).size, 7); eq(new Set(v.islemler.map(i => i.id)).size, 7);
  deepEq(v.randevular, []);
});
test('dogrula bozuk girdileri reddeder', () => {
  for (const x of [null, undefined, 'abc', 42, [], {}, {ayar:{}, islemler:{}, randevular:[]}, {ayar:null, islemler:[], randevular:[]}])
    eq(BR.dogrula(x), null);
});
test('dogrula tamamlar ve bozuk randevuyu atar', () => {
  const v = BR.dogrula({ayar:{dukkan:'A'}, islemler:[], randevular:[
    {id:'1', tarih:'2026-11-21', saat:'10:00', sure:30, ad:'X'}, {id:'2', tarih:'bozuk', saat:'10:00'},
    {id:'3', tarih:'2026-11-21', saat:'25:99', ad:'Y'}, null, 'x']});
  eq(v.ayar.acilis, '09:00'); eq(v.ayar.dukkan, 'A'); eq(v.randevular.length, 1); eq(v.randevular[0].durum, 'bekliyor');
});
test('dogrula bozuk ayar değerlerini varsayılana çeker', () => {
  const v = BR.dogrula({ayar:{acilis:'xx', kapanis:'08:00', adim:7, kapali:'pazar'}, islemler:[{ad:'Saç'}, null], randevular:[]});
  eq(v.ayar.acilis, '09:00'); eq(v.ayar.kapanis, '21:00'); eq(v.ayar.adim, 30); deepEq(v.ayar.kapali, [0]);
  eq(v.islemler.length, 1); eq(v.islemler[0].sure, 30); ok(v.islemler[0].id);
});
test('musteriOner Türkçe harf', () => {
  const rs = [{ad:'İsmail Işık', tel:'0532', tarih:'2026-11-01', saat:'10:00'}, {ad:'ismail ışık', tel:'', tarih:'2026-10-01', saat:'10:00'}, {ad:'Mert', tel:'', tarih:'2026-11-05', saat:'10:00'}];
  deepEq(BR.musteriOner(rs, 'IŞI'), [{ad:'İsmail Işık', tel:'0532'}]);
  deepEq(BR.musteriOner(rs, 'ism'), [{ad:'İsmail Işık', tel:'0532'}]);
  deepEq(BR.musteriOner(rs, ''), []);
});
test('musteriOner en fazla 5, en yeni önce', () => {
  const rs = Array.from({length: 8}, (_, i) => ({ad:'Ali ' + i, tel:'', tarih:'2026-11-0' + (i + 1), saat:'10:00'}));
  const o = BR.musteriOner(rs, 'ali'); eq(o.length, 5); eq(o[0].ad, 'Ali 7');
});
test('yeniId tekil', () => { const s = new Set(Array.from({length: 500}, () => BR.yeniId())); eq(s.size, 500); });
test('ornekVeri', () => {
  const a = BR.ornekVeri('2026-11-21'), b = BR.ornekVeri('2026-11-21');
  deepEq(a, b); ok(a.ayar.ornek); eq(BR.dogrula(a).randevular.length, a.randevular.length);
  ok(a.randevular.filter(r => r.tarih === '2026-11-21').length >= 8);
  ok(a.randevular.some(r => r.tarih < '2025-10-01')); ok(a.randevular.some(r => r.tarih > '2026-11-21'));
  ok(!a.randevular.some(r => r.tarih > '2026-11-27'));
  ok(!a.randevular.some(r => BR.tarihOku(r.tarih).getDay() === 0));
  for (const r of a.randevular) eq(BR.cakisanlar(a.randevular, r).length, 0);
  ok(a.islemler.every(i => i.fiyat > 0)); ok(a.randevular.every(r => r.fiyat > 0 && r.islemAd && r.ad));
  ok(!a.randevular.some(r => r.tarih > '2026-11-21' && r.durum !== 'bekliyor'));
  ok(a.randevular.some(r => r.durum === 'gelmedi')); ok(a.randevular.some(r => r.durum === 'iptal'));
  eq(new Set(a.randevular.map(r => r.id)).size, a.randevular.length);
});
test('ornekVeri Pazar günü boş kalır', () => eq(BR.ornekVeri('2026-11-22').randevular.filter(r => r.tarih === '2026-11-22').length, 0));
