import * as XLSX from 'xlsx';
import type { AppData, Currency } from '../types';
import { CURRENCIES, JOB_STATUS_LABEL, PAYMENT_TYPE_LABEL } from '../types';
import { customerLedger, jobPayStates, ledger, monthlyAverage } from '../lib/money';
import { fmtBreakdown, today } from '../lib/format';
import { normalizeData } from './normalize';

const NUM_FMT = '#,##0.00';
const PAY_STATE: Record<string, string> = { alacak: 'Alacak', kismi: 'Kısmi Tahsil', tahsil: 'Tahsil Edildi' };

type Row = (string | number | null)[];

function sheet(rows: Row[], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  // Sayısal hücrelere binlik ayraçlı biçim
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++)
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n' && !cell.z) cell.z = NUM_FMT;
    }
  return ws;
}

function safeSheetName(name: string, used: Set<string>) {
  const base = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Müşteri';
  let n = base;
  let i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

export function exportWorkbook(data: AppData) {
  const wb = XLSX.utils.book_new();
  const r = data.settings.rates;
  const total = ledger(data.jobs, data.payments, r);
  const avg = monthlyAverage(data);
  const custName = new Map(data.customers.map((c) => [c.id, c.name]));

  /* ---------- Genel Özet ---------- */
  const summary: Row[] = [
    ['SAHA CARİ – GENEL ÖZET'],
    ['Rapor Tarihi', today()],
    ['Kur (USD/TRY)', r.USD],
    ['Kur (EUR/TRY)', r.EUR],
    [],
    ['GÖSTERGE', 'TL Karşılığı (güncel kur)', 'Döviz Kırılımı'],
    ['Yapılan İşler Toplamı', total.jobsTRY, fmtBreakdown(total.jobs)],
    ['Toplam Alınan (Mahsup)', total.creditedTRY, fmtBreakdown(total.credited)],
    ['Net Kalan Alacak', total.balanceTRY, fmtBreakdown(total.balance)],
    ['Fiili Tahsilat (işlem kuruyla TL)', total.receivedTRY, ''],
    ['Aylık Ortalama İş Hacmi', avg.avgTRY, `${avg.months} ay`],
    [],
    [
      'Müşteri',
      'İş ₺', 'İş $', 'İş €',
      'Alınan ₺', 'Alınan $', 'Alınan €',
      'Kalan ₺', 'Kalan $', 'Kalan €',
      'Kalan TL Karşılığı',
    ],
  ];
  for (const c of data.customers) {
    const l = customerLedger(data, c.id);
    summary.push([
      c.name,
      ...CURRENCIES.map((k) => l.jobs[k]),
      ...CURRENCIES.map((k) => l.credited[k]),
      ...CURRENCIES.map((k) => l.balance[k]),
      l.balanceTRY,
    ]);
  }
  summary.push([
    'TOPLAM',
    ...CURRENCIES.map((k) => total.jobs[k]),
    ...CURRENCIES.map((k) => total.credited[k]),
    ...CURRENCIES.map((k) => total.balance[k]),
    total.balanceTRY,
  ]);
  XLSX.utils.book_append_sheet(wb, sheet(summary, [30, 22, 26, 12, 14, 12, 12, 14, 12, 12, 18]), 'Genel Özet');

  /* ---------- Müşteri sekmeleri ---------- */
  const used = new Set(['genel özet', 'hareketler', '_customers', '_jobs', '_payments', '_settings']);
  for (const c of data.customers) {
    const jobs = data.jobs.filter((j) => j.customerId === c.id).sort((a, b) => a.date.localeCompare(b.date));
    const pays = data.payments.filter((p) => p.customerId === c.id).sort((a, b) => a.date.localeCompare(b.date));
    const st = jobPayStates(data.jobs.filter((j) => j.customerId === c.id), pays);
    const l = customerLedger(data, c.id);
    const rows: Row[] = [
      [c.name.toUpperCase()],
      c.phone ? ['Telefon', c.phone] : [],
      [],
      ['YAPILAN İŞLER'],
      ['Tarih', 'İş', 'Tutar', 'Döviz', 'İş Durumu', 'Tahsil Durumu', 'Not'],
      ...jobs.map((j) => [j.date, j.title, j.amount, j.currency, JOB_STATUS_LABEL[j.status], PAY_STATE[st[j.id]?.state ?? 'alacak'], j.note ?? ''] as Row),
      [],
      ['ALINAN ÖDEMELER / MAHSUPLAR'],
      ['Tarih', 'Tür', 'Tutar', 'Döviz', 'USD Kuru', 'EUR Kuru', 'TL Karşılığı', 'Bakiyeden Düşen', 'Açıklama / Not'],
      ...pays.map(
        (p) =>
          [
            p.date,
            PAYMENT_TYPE_LABEL[p.type],
            p.amount,
            p.currency,
            p.rates.USD,
            p.rates.EUR,
            p.amountTRY,
            p.allocations.map((a) => fmtBreakdown({ TRY: 0, USD: 0, EUR: 0, [a.currency]: a.amount }, { hideZero: true })).join(' + '),
            [p.description, p.note].filter(Boolean).join(' – '),
          ] as Row,
      ),
      [],
      ['BAKİYE ÖZETİ', 'İş', 'Alınan', 'Kalan'],
      ...CURRENCIES.map((k: Currency) => [k, l.jobs[k], l.credited[k], l.balance[k]] as Row),
      ['TL Karşılığı (güncel kur)', l.jobsTRY, l.creditedTRY, l.balanceTRY],
    ];
    XLSX.utils.book_append_sheet(wb, sheet(rows, [26, 24, 14, 8, 12, 14, 14, 22, 36]), safeSheetName(c.name, used));
  }

  /* ---------- Hareketler ---------- */
  const mv: Row[] = [['Tarih', 'Müşteri', 'Tip', 'Açıklama', 'Tutar', 'Döviz', 'TL Karşılığı']];
  const all = [
    ...data.jobs.map((j) => ({ d: j.date, row: [j.date, custName.get(j.customerId) ?? '', 'İş', j.title, j.amount, j.currency, j.amount * (j.currency === 'TRY' ? 1 : r[j.currency])] as Row })),
    ...data.payments.map((p) => ({ d: p.date, row: [p.date, custName.get(p.customerId) ?? '', `Ödeme (${PAYMENT_TYPE_LABEL[p.type]})`, p.description ?? p.note ?? '', -p.amount, p.currency, -p.amountTRY] as Row })),
  ].sort((a, b) => b.d.localeCompare(a.d));
  mv.push(...all.map((x) => x.row));
  XLSX.utils.book_append_sheet(wb, sheet(mv, [12, 22, 26, 34, 14, 8, 16]), 'Hareketler');

  /* ---------- Geri yükleme için ham veri (gizli) ---------- */
  const raw = (name: string, rows: object[]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  };
  raw('_customers', data.customers);
  raw('_jobs', data.jobs);
  raw('_payments', data.payments.map((p) => ({ ...p, rates: JSON.stringify(p.rates), allocations: JSON.stringify(p.allocations) })));
  raw('_settings', [{ USD: r.USD, EUR: r.EUR, ratesUpdatedAt: data.settings.ratesUpdatedAt ?? '', ratesSource: data.settings.ratesSource ?? '' }]);
  wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ name: n, Hidden: n.startsWith('_') ? 1 : 0 })) };

  XLSX.writeFile(wb, `saha-cari-${today()}.xlsx`, { compression: true });
}

export function exportJSON(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `saha-cari-yedek-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** .json veya bu uygulamanın ürettiği .xlsx dosyasını okur */
export async function importFile(file: File): Promise<AppData> {
  if (file.name.toLowerCase().endsWith('.json')) {
    return normalizeData(JSON.parse(await file.text()));
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const need = ['_customers', '_jobs', '_payments'];
  if (!need.every((n) => wb.SheetNames.includes(n)))
    throw new Error('Bu Excel dosyası Saha Cari yedeği değil (gizli _customers/_jobs/_payments sekmeleri bulunamadı).');
  const read = (n: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: '' });
  const parse = (v: unknown) => {
    try {
      return typeof v === 'string' && v ? JSON.parse(v) : v;
    } catch {
      return undefined;
    }
  };
  const settings = wb.SheetNames.includes('_settings') ? read('_settings')[0] ?? {} : {};
  return normalizeData({
    customers: read('_customers'),
    jobs: read('_jobs'),
    payments: read('_payments').map((p) => ({ ...p, rates: parse(p.rates), allocations: parse(p.allocations) })),
    settings: { rates: { USD: settings.USD, EUR: settings.EUR }, ratesUpdatedAt: settings.ratesUpdatedAt, ratesSource: settings.ratesSource },
  });
}
