const { BR, test, eq, deepEq } = require('./yardim.js');

test('dakika/saatYaz', () => { eq(BR.dakika('09:30'), 570); eq(BR.saatYaz(570), '09:30'); });
test('tarihYaz/tarihOku yerel', () => {
  eq(BR.tarihYaz(new Date(2026, 10, 21, 23, 59)), '2026-11-21');
  const d = BR.tarihOku('2026-01-05'); eq(d.getFullYear(), 2026); eq(d.getMonth(), 0); eq(d.getDate(), 5); eq(d.getHours(), 0);
});
test('gunEkle ay, yıl ve 29 Şubat', () => {
  eq(BR.gunEkle('2026-11-30', 1), '2026-12-01');
  eq(BR.gunEkle('2026-12-31', 1), '2027-01-01');
  eq(BR.gunEkle('2028-02-28', 1), '2028-02-29');
  eq(BR.gunEkle('2026-03-01', -1), '2026-02-28');
});
test('dilimler varsayılan', () => {
  const d = BR.dilimler({acilis:'09:00', kapanis:'21:00', adim:30}, []);
  eq(d.length, 24); eq(d[0], '09:00'); eq(d[23], '20:30');
});
test('dilimler saat dışı randevuya uzar', () => {
  const d = BR.dilimler({acilis:'09:00', kapanis:'21:00', adim:30},
    [{saat:'08:00', sure:30, durum:'bekliyor'}, {saat:'21:30', sure:45, durum:'bekliyor'}]);
  eq(d[0], '08:00'); eq(d[d.length-1], '22:00');
});
test('cakisanlar', () => {
  const rs = [{id:'a', tarih:'2026-11-21', saat:'10:00', sure:45, durum:'bekliyor'},
              {id:'b', tarih:'2026-11-21', saat:'11:00', sure:30, durum:'iptal'}];
  eq(BR.cakisanlar(rs, {tarih:'2026-11-21', saat:'10:30', sure:30}).length, 1);
  eq(BR.cakisanlar(rs, {tarih:'2026-11-21', saat:'10:45', sure:15}).length, 0); // bitişik
  eq(BR.cakisanlar(rs, {tarih:'2026-11-21', saat:'11:00', sure:30}).length, 0); // iptal
  eq(BR.cakisanlar(rs, {id:'a', tarih:'2026-11-21', saat:'10:00', sure:45}).length, 0); // kendisi
  eq(BR.cakisanlar(rs, {tarih:'2026-11-22', saat:'10:00', sure:45}).length, 0);
});
test('gunOzeti', () => {
  const ayar = {acilis:'09:00', kapanis:'11:00', adim:30};
  const rs = [{id:'a', tarih:'2026-11-21', saat:'09:00', sure:45, durum:'bekliyor'},
              {id:'b', tarih:'2026-11-21', saat:'10:30', sure:30, durum:'iptal'}];
  deepEq(BR.gunOzeti(ayar, rs, '2026-11-21'), {randevu:1, bosDilim:2}); // 10:00 ve 10:30 boş
});
test('kacis', () => eq(BR.kacis(`<b>"A&B'</b>`), '&lt;b&gt;&quot;A&amp;B&#39;&lt;/b&gt;'));
