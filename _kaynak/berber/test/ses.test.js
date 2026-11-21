const { BR, test, eq, deepEq } = require('./yardim.js');

// 21 Kasım 2026 Cumartesi; dükkân 09:00–21:00
const v = BR.varsayilanVeri();
const coz = (metin, bugun = '2026-11-21', ayar = v.ayar) => BR.sesCoz(metin, { bugun, ayar, islemler: v.islemler });
const ozet = (metin, bugun, ayar) => { const c = coz(metin, bugun, ayar); return [c.ad, c.tarih, c.saat, c.islemId]; };

test('isim, yarın, saat ve işlem', () => deepEq(ozet('Ahmet Kaya yarın saat 3 saç sakal'), ['Ahmet Kaya', '2026-11-22', '15:00', 'sacsakal']));
test('saat:dakika yazımı', () => {
  deepEq(ozet('ahmet kaya yarın saat 15:30 saç sakal'), ['Ahmet Kaya', '2026-11-22', '15:30', 'sacsakal']);
  deepEq(ozet('3 Aralık saat 14.00 Tolga cilt bakımı'), ['Tolga', '2026-12-03', '14:00', 'cilt']);
  deepEq(ozet('Emre yarın saat 16 30 saç'), ['Emre', '2026-11-22', '16:30', 'sac']);
});
test('buçuk ve ekli saatler', () => {
  deepEq(ozet('Mehmet bugün 4 buçukta sakal'), ['Mehmet', '2026-11-21', '16:30', 'sakal']);
  deepEq(ozet("Ahmet'e yarın 3'te saç"), ['Ahmet', '2026-11-22', '15:00', 'sac']);
  deepEq(ozet('Sinan öbür gün 12 de saç'), ['Sinan', '2026-11-23', '12:00', 'sac']);
  deepEq(ozet('Yusuf yarın beş buçuk ağda'), ['Yusuf', '2026-11-22', '17:30', 'agda']);
});
test('yazıyla söylenen saatler', () => {
  deepEq(ozet('Ali Veli salı saat on birde saç'), ['Ali Veli', '2026-11-24', '11:00', 'sac']);
  deepEq(ozet('yarın saat üçe Hasan çocuk traşı'), ['Hasan', '2026-11-22', '15:00', 'cocuk']);
  deepEq(ozet('Kadir yarın dörtte sakal'), ['Kadir', '2026-11-22', '16:00', 'sakal']);
  deepEq(ozet('Okan yarın on ikide saç'), ['Okan', '2026-11-22', '12:00', 'sac']);
});
test('sabah, akşam, öğleden sonra', () => {
  deepEq(ozet('Kerem akşam 7 de sakal'), ['Kerem', null, '19:00', 'sakal']);
  deepEq(ozet('Burak sabah 9 buçuk saç'), ['Burak', null, '09:30', 'sac']);
  deepEq(ozet('Deniz öğleden sonra 2 saç'), ['Deniz', null, '14:00', 'sac']);
  deepEq(ozet('Cem bu akşam sekizde saç sakal'), ['Cem', '2026-11-21', '20:00', 'sacsakal']);
});
test('öğleden önceki saatler çalışma saatine göre yorumlanır', () => {
  eq(coz('Hasan saat 8').saat, '20:00'); // dükkân 9'da açılıyor: 8 akşam sekizdir
  eq(coz('Hasan saat 9').saat, '09:00');
  eq(coz('Hasan saat 1').saat, '13:00');
  eq(coz('Hasan saat 12').saat, '12:00');
  eq(coz('Hasan saat 8', '2026-11-21', Object.assign({}, v.ayar, { acilis: '07:00' })).saat, '08:00');
  eq(coz('Hasan saat 19').saat, '19:00');
});
test('gün adları ve haftaya', () => {
  eq(coz('Can cumartesi 2 de saç').tarih, '2026-11-21');           // bugün cumartesi
  eq(coz('Can pazartesi 2 de saç').tarih, '2026-11-23');
  eq(coz('Can cuma günü 2 de saç').tarih, '2026-11-27');
  eq(coz('Can cumaya 2 de saç').tarih, '2026-11-27');
  eq(coz('Can haftaya cuma 2 de saç', '2026-11-23').tarih, '2026-12-04'); // pazartesi söylendi
  eq(coz('Can cuma 2 de saç', '2026-11-23').tarih, '2026-11-27');
  eq(coz('Can haftaya 2 de saç').tarih, '2026-11-28');
  deepEq(ozet('haftaya cuma saat 10 İsmail yıkama fön'), ['İsmail', '2026-11-27', '10:00', 'fon']);
});
test('gün ve ay', () => {
  deepEq(ozet('25 Kasım saat 11 Murat Demir ağda'), ['Murat Demir', '2026-11-25', '11:00', 'agda']);
  deepEq(ozet('5 Ocak 10:00 Mert saç'), ['Mert', '2027-01-05', '10:00', 'sac']); // geçmiş ay: gelecek yıl
  deepEq(ozet("Mert ayın 28'inde saat 3 saç"), ['Mert', '2026-11-28', '15:00', 'sac']);
  deepEq(ozet("Mert ayın 5'i saat 3 saç"), ['Mert', '2026-12-05', '15:00', 'sac']);  // bu ay geçti: gelecek ay
  eq(coz('31 Şubat saat 3 Mert').tarih, null); // olmayan gün
});
test('isimdeki sayı benzeri heceler saate çevrilmez', () => {
  deepEq(ozet('Onur Altay saç'), ['Onur Altay', null, null, 'sac']);
  deepEq(ozet('Yedier Birol sakal'), ['Yedier Birol', null, null, 'sakal']);
  deepEq(ozet('Onat Üçer'), ['Onat Üçer', null, null, null]);
});
test('isim büyük harfle başlatılır, Türkçe harfler korunur', () => {
  eq(coz('ismail ışık yarın 3').ad, 'İsmail Işık');
  eq(coz('ÖMER ÇELİK saç').ad, 'Ömer Çelik');
});
test('dolgu sözcükleri isme karışmaz', () => {
  eq(coz('Ahmet Kaya için yarın saat 3 e saç kesimi randevusu yaz').ad, 'Ahmet Kaya');
  eq(coz('Ahmet Kaya için yarın saat 3 e saç kesimi randevusu yaz').islemId, 'sac');
  eq(coz('yarın saat 5 te Hasan Bey adına bir sakal tıraşı').ad, 'Hasan Bey');
});
test('birden çok işlem: uzun eşleşme önce, kalanı ek olarak döner', () => {
  const c = coz('Yusuf saç ve ağda yarın 5 buçuk');
  deepEq([c.ad, c.islemId, c.saat], ['Yusuf', 'sac', '17:30']); deepEq(c.ekIslemler, ['Ağda']);
  const d = coz('Can saç ve sakal');
  deepEq([d.ad, d.islemId], ['Can', 'sacsakal']); deepEq(d.ekIslemler, []);
});
test('silinmiş işlem eşleşmez; boş ve anlamsız girdiler çökmez', () => {
  const islemler = v.islemler.map(i => i.id === 'agda' ? Object.assign({}, i, { silindi: true }) : i);
  eq(BR.sesCoz('Yusuf ağda', { bugun: '2026-11-21', ayar: v.ayar, islemler }).islemId, null);
  deepEq(ozet(''), ['', null, null, null]);
  deepEq(ozet('   '), ['', null, null, null]);
  deepEq(ozet('saat'), ['', null, null, null]);
  eq(coz('Hasan saat 99').saat, null);
  eq(coz("<b>Ali</b> yarın 3").ad, '<b>ali</b>');
});
test('tarihle birlikte söylenen gün adı isme karışmaz; açık tarih gün adından önce gelir', () => {
  deepEq(ozet('Ali Veli 28 Kasım Cumartesi saat 14:00 cilt bakımı'), ['Ali Veli', '2026-11-28', '14:00', 'cilt']);
  deepEq(ozet('Cumartesi 28 Kasım saat 2 Ali'), ['Ali', '2026-11-28', '14:00', null]);
  deepEq(ozet('yarın pazar saat 3 Ali'), ['Ali', '2026-11-22', '15:00', null]);
  deepEq(ozet('salı günü yarın değil 3 te Ali'.replace(' değil', '')), ['Ali', '2026-11-22', '15:00', null]); // yarın, gün adından önce gelir
});
