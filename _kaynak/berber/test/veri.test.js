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

/* ---- son gözden geçirme bulguları ---- */
test('ornekleriSil yalnızca örnekleri siler, kullanıcının eklediklerine dokunmaz', () => {
  const v = BR.ornekVeri('2026-11-21');
  ok(v.randevular.every(r => r.ornek === true));
  v.randevular.push({id:'benim', tarih:'2026-11-21', saat:'12:00', sure:30, ad:'Gerçek Müşteri', tel:'', islemId:'sac', islemAd:'Saç', fiyat:350, durum:'bekliyor', not:''});
  v.islemler.push({id:'keratin', ad:'Keratin', sure:60, fiyat:900, renk:'#2F6FDE', sira:7, silindi:false});
  v.islemler.find(i => i.id === 'sakal').fiyat = 200; // kullanıcı fiyatı değiştirmiş
  const t = BR.ornekleriSil(v);
  deepEq(t.randevular.map(r => r.id), ['benim']); eq(t.randevular[0].fiyat, 350);
  eq(t.ayar.ornek, false); eq(t.ayar.dukkan, 'By Lider Erkek Kuaförü');
  eq(t.islemler.find(i => i.id === 'keratin').fiyat, 900);
  eq(t.islemler.find(i => i.id === 'sakal').fiyat, 200);
  eq(t.islemler.find(i => i.id === 'sac').fiyat, null); // örnek fiyat silinir
  eq(v.randevular.length > 1000, true); // girdi değişmez
});
test('dogrula örnek işaretini korur, olmayana eklemez', () => {
  const v = BR.dogrula(JSON.parse(JSON.stringify(BR.ornekVeri('2026-11-21'))));
  ok(v.randevular.every(r => r.ornek === true));
  const w = BR.dogrula({ayar:{}, islemler:[], randevular:[{tarih:'2026-11-21', saat:'10:00'}, {tarih:'2026-11-21', saat:'11:00', ornek:'evet'}]});
  ok(w.randevular.every(r => !('ornek' in r)));
});
test('musteriOner en son dolu telefonu verir', () => {
  const rs = [{ad:'Ahmet Kaya', tel:'0532', tarih:'2026-10-01', saat:'10:00'}, {ad:'Ahmet Kaya', tel:'', tarih:'2026-11-01', saat:'10:00'},
              {ad:'Ahmet Kaya', tel:'0555', tarih:'2026-09-01', saat:'10:00'}];
  deepEq(BR.musteriOner(rs, 'ahmet'), [{ad:'Ahmet Kaya', tel:'0532'}]);
});
test('fiyatCoz Türkçe yazımı anlar', () => {
  eq(BR.fiyatCoz('1.500'), 1500); eq(BR.fiyatCoz('1.500,50'), 1500.5); eq(BR.fiyatCoz('12.345.678'), 12345678);
  eq(BR.fiyatCoz('350'), 350); eq(BR.fiyatCoz('99,90'), 99.9); eq(BR.fiyatCoz('1.5'), 1.5); eq(BR.fiyatCoz(' 450 ₺ '), 450);
  eq(BR.fiyatCoz(''), null); eq(BR.fiyatCoz(null), null);
  ok(Number.isNaN(BR.fiyatCoz('abc'))); ok(Number.isNaN(BR.fiyatCoz('-5'))); ok(Number.isNaN(BR.fiyatCoz('1.2.3')));
});
