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

/* ---- müşteriye gitmeden önceki denetimde bulunanlar ---- */
test('saat:dakika yazımında da öğleden sonra kuralı uygulanır', () => {
  eq(coz('Mehmet akşam 7:30 saç').saat, '19:30');
  eq(coz('Mehmet yarın 3:30 saç sakal').saat, '15:30');
  eq(coz('Mehmet yarın saat 4:00 saç').saat, '16:00');
  eq(coz('Mehmet öğleden sonra 2:30 saç').saat, '14:30');
  eq(coz('Mehmet yarın 9:30 saç').saat, '09:30');
  eq(coz('Mehmet sabah 7:30 saç').saat, '07:30');
  eq(coz('Mehmet yarın 08:00 saç').saat, '08:00'); // baştaki sıfır: söylenen saat aynen alınır
});
test('gün bölümü sözcükleri isimleri yutmaz', () => {
  deepEq(ozet("Sabahattin Kaya yarın 3'te saç"), ['Sabahattin Kaya', '2026-11-22', '15:00', 'sac']);
  deepEq(ozet('Sabahat Hanım saat 5 sakal'), ['Sabahat Hanım', null, '17:00', 'sakal']);
  eq(coz('Akşamoğlu Ali saç').ad, 'Akşamoğlu Ali');
  deepEq(ozet('Ali akşamüstü 5 saç'), ['Ali', null, '17:00', 'sac']);
  deepEq(ozet('Ali akşam üstü 5 saç'), ['Ali', null, '17:00', 'sac']);
  eq(coz('Ali sabaha 10 saç').saat, '10:00');
});
test('haftaya bugün/yarın, "değil", gelecek hafta, N gün sonra', () => {
  eq(coz("Mehmet haftaya bugün 3'te saç").tarih, '2026-11-28');
  eq(coz("Mehmet haftaya yarın 3'te saç").tarih, '2026-11-29');
  deepEq(ozet("Mehmet yarın değil öbür gün 3'te saç"), ['Mehmet', '2026-11-23', '15:00', 'sac']);
  deepEq(ozet('Ali gelecek hafta cuma saat 3 saç', '2026-11-23'), ['Ali', '2026-12-04', '15:00', 'sac']);
  eq(coz('Ali önümüzdeki hafta salı 3 te', '2026-11-23').tarih, '2026-12-01');
  deepEq(ozet('Ali önümüzdeki cuma saat 3'), ['Ali', '2026-11-27', '15:00', null]);
  deepEq(ozet('Ali bu cuma saat 3'), ['Ali', '2026-11-27', '15:00', null]);
  deepEq(ozet('Mehmet 15 gün sonra saat 3 saç'), ['Mehmet', '2026-12-06', '15:00', 'sac']);
  deepEq(ozet('Mehmet 2 hafta sonra saat 3 saç'), ['Mehmet', '2026-12-05', '15:00', 'sac']);
  deepEq(ozet('Mehmet iki gün sonra dörtte'), ['Mehmet', '2026-11-23', '16:00', null]);
});
test('eki olmayan sayı sözcükleri ve "yarım" da saat sayılır', () => {
  deepEq(ozet('Mehmet yarın üç saç'), ['Mehmet', '2026-11-22', '15:00', 'sac']);
  deepEq(ozet('Mehmet yarın on bir saç'), ['Mehmet', '2026-11-22', '11:00', 'sac']);
  deepEq(ozet('Ahmet bir saç'), ['Ahmet', null, null, 'sac']); // tek başına "bir" saat değildir
  deepEq(ozet('Mehmet yarın yarımda saç'), ['Mehmet', '2026-11-22', '12:30', 'sac']);
  eq(coz('Mehmet saat yarım').saat, '12:30');
});
test('ayın günü: ekli rakam ve ay tamlaması', () => {
  deepEq(ozet("Mehmet 25'inde 3'te saç"), ['Mehmet', '2026-11-25', '15:00', 'sac']);
  deepEq(ozet("Ali 22'sinde 3'te saç"), ['Ali', '2026-11-22', '15:00', 'sac']);
  deepEq(ozet("Mehmet Kasım'ın 25'inde saat 3 saç"), ['Mehmet', '2026-11-25', '15:00', 'sac']);
  deepEq(ozet("Mehmet aralığın 3'ü saat 3"), ['Mehmet', '2026-12-03', '15:00', null]);
  deepEq(ozet('saat 3 Eylül Hanım saç'), ['Eylül Hanım', null, '15:00', 'sac']); // "3 Eylül" tarih değil: önünde "saat" var
});
test('yaklaşık ve dolgu sözcükleri isme karışmaz; gerçek soyadlar korunur', () => {
  for (const m of ['Mehmet yarın 3 gibi saç', 'Mehmet yarın 3 civarı', 'Mehmet yarın 3 sularında', "Mehmet yarın 5'ten sonra saç", 'tamam yeni randevu Mehmet yarın 3'])
    eq(coz(m).ad, 'Mehmet', m);
  eq(coz("Mehmet yarın 5'ten sonra saç").saat, '17:00');
  eq(coz('Mehmet Yazar yarın 3').ad, 'Mehmet Yazar'); eq(coz('Ali Gün yarın 3').ad, 'Ali Gün');
  deepEq(ozet('Ali 2 kişi yarın 3 saç'), ['Ali', '2026-11-22', '15:00', 'sac']);
  eq(coz('Ali yarın 3 saç 350 lira').ad, 'Ali');
});
test('işlem eşleşmesi: tek sözcük, ters sıra, artı; soyadlar işlem sanılmaz', () => {
  deepEq([coz('Mehmet fön').ad, coz('Mehmet fön').islemId], ['Mehmet', 'fon']);
  eq(coz('Mehmet yıkama').islemId, 'fon'); eq(coz('Mehmet cilt').islemId, 'cilt'); eq(coz('Mehmet bakım').islemId, 'cilt'); eq(coz('Mehmet çocuk').islemId, 'cocuk');
  for (const m of ['Can saç artı sakal', 'Can saç + sakal', 'Can sakal saç', 'Can sakal ve saç']) { const c = coz(m); deepEq([c.ad, c.islemId, c.ekIslemler.length], ['Can', 'sacsakal', 0], m); }
  deepEq(ozet('Ali Saka yarın 3'), ['Ali Saka', '2026-11-22', '15:00', null]);
  const c = coz('Sakallı Ali yarın 3 saç'); deepEq([c.ad, c.islemId, c.ekIslemler.length], ['Sakallı Ali', 'sac', 0]);
  eq(coz('Mehmet çocuk tıraş').islemId, 'cocuk'); eq(coz('Mehmet sakala').islemId, 'sakal');
  const t = coz('Mehmet sakal tıraşı'); deepEq([t.ad, t.islemId, t.ekIslemler.length], ['Mehmet', 'sakal', 0]); // "tıraşı" Çocuk Tıraşı'nı seçmez
});
test('dakikalar ve çalışma saatine göre yorum', () => {
  deepEq([coz('Ali saat 3 20').ad, coz('Ali saat 3 20').saat], ['Ali', '15:20']);
  const dar = Object.assign({}, v.ayar, { acilis: '10:00', kapanis: '20:00' });
  eq(coz('Hasan saat 8', '2026-11-21', dar).saat, '20:00'); eq(coz('Hasan saat 7', '2026-11-21', dar).saat, '19:00');
});
