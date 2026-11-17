export type Currency = 'TRY' | 'USD' | 'EUR';
export const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR'];

export type PaymentType = 'nakit' | 'havale' | 'cek' | 'urun';

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  nakit: 'Nakit',
  havale: 'Havale / EFT',
  cek: 'Çek / Senet',
  urun: 'Ürün / Cihaz Mahsubu',
};

export type JobStatus = 'devam' | 'tamamlandi' | 'faturalandi';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  devam: 'Devam Ediyor',
  tamamlandi: 'Tamamlandı',
  faturalandi: 'Faturalandı',
};

/** 1 birim dövizin TL karşılığı. TRY her zaman 1'dir. */
export interface Rates {
  USD: number;
  EUR: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
}

/** Yapılan iş = müşteriye borç (hakediş) kaydı */
export interface Job {
  id: string;
  customerId: string;
  title: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: Currency;
  status: JobStatus;
  note?: string;
}

/** Bir ödemenin hangi döviz bakiyesinden ne kadar düştüğü */
export interface Allocation {
  currency: Currency;
  amount: number; // ilgili döviz cinsinden bakiyeden düşen tutar
}

/**
 * Tahsilat / ara ödeme / mahsup.
 * - amount + currency: fiilen alınan tutar ve para birimi
 * - mode 'single': tamamı targetCurrency bakiyesinden düşer
 * - mode 'auto'  : açık bakiyelere sırayla dağıtılır (örn. TL ödeme → önce €, sonra $)
 * - rates: işlem anındaki kurlar (TL karşılığı) – mahsup bu kurlarla dondurulur
 * - allocations: bakiyeden düşen tutarlar (döviz bazında)
 * - amountTRY: ödemenin işlem kuruyla TL karşılığı
 */
export interface Payment {
  id: string;
  customerId: string;
  date: string;
  type: PaymentType;
  amount: number;
  currency: Currency;
  mode: 'single' | 'auto';
  targetCurrency: Currency; // single modda hedef; auto modda fazlanın yazılacağı döviz
  rates: Rates;
  allocations: Allocation[];
  amountTRY: number;
  jobId?: string;
  description?: string; // ör. "Dizüstü bilgisayar"
  note?: string;
}

export interface Settings {
  rates: Rates;
  ratesUpdatedAt?: string;
  ratesSource?: string;
}

export interface AppData {
  version: 1;
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
  settings: Settings;
}

export type Money = Record<Currency, number>;
