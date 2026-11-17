import { get, set } from 'idb-keyval';
import type { AppData } from '../types';
import { normalizeData } from './normalize';
import { DEFAULT_RATES } from '../lib/seed';

/**
 * Yerel depolama katmanı.
 *
 * Güvenlik kuralları:
 *  - Her değişiklik önce localStorage'a SENKRON yazılır (uygulama hemen kapansa bile kaybolmaz),
 *    ardından IndexedDB'ye ikinci kopya olarak yazılır.
 *  - Her kayıt artan bir sürüm (rev) taşır; açılışta iki kopyadan EN YENİSİ yüklenir.
 *  - "Kayıt yok" ile "okunamadı" ayrı tutulur: okuma hatasında asla boş veri yazılmaz.
 *  - Toplu değişikliklerden (yedek yükleme, tümünü silme) önce geri dönüş noktası saklanır.
 */

const IDB_KEY = 'saha-cari:data:v1';
const LS_KEY = 'saha-cari:backup:v1';
const REV_KEY = 'saha-cari:rev';
const SNAP_KEY = 'saha-cari:snapshot:v1';

export type LoadResult = { status: 'ok'; data: AppData } | { status: 'empty' } | { status: 'error'; message: string };

function readLocal(): { data: AppData | null; error?: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LS_KEY);
  } catch {
    // localStorage tamamen kapalı (gizli mod vb.): "kayıt yok" sayılır, IndexedDB'ye güvenilir
    return { data: null };
  }
  if (!raw) return { data: null };
  try {
    return { data: trustOwn(JSON.parse(raw)) };
  } catch (e) {
    return { data: null, error: (e as Error).message || 'Kayıt okunamadı' };
  }
}

async function readIdb(): Promise<{ data: AppData | null; error?: string }> {
  try {
    const d = await get<AppData>(IDB_KEY);
    return { data: d ? trustOwn(d) : null };
  } catch (e) {
    return { data: null, error: (e as Error).message || 'IndexedDB okunamadı' };
  }
}

/**
 * Uygulamanın KENDİ kaydettiği veri: hiçbir kayıt düşürülmez, yalnızca eksik alanlar tamamlanır.
 * (Sıkı doğrulama yalnızca dışarıdan yüklenen yedek dosyalarına uygulanır.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trustOwn(raw: any): AppData {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.customers) || !Array.isArray(raw.jobs) || !Array.isArray(raw.payments)) {
    throw new Error('Kayıt biçimi tanınmadı');
  }
  const r = raw.settings?.rates ?? {};
  return {
    ...raw,
    version: 1,
    rev: Number(raw.rev) || 0,
    settings: { ...raw.settings, rates: { USD: Number(r.USD) > 0 ? Number(r.USD) : DEFAULT_RATES.USD, EUR: Number(r.EUR) > 0 ? Number(r.EUR) : DEFAULT_RATES.EUR } },
  } as AppData;
}

const revOf = (d: AppData | null) => (d ? d.rev ?? 0 : -1);

export async function loadData(): Promise<LoadResult> {
  const [ls, idb] = [readLocal(), await readIdb()];
  const best = revOf(ls.data) >= revOf(idb.data) ? ls.data : idb.data;
  if (best) return { status: 'ok', data: best };
  if (ls.error || idb.error) return { status: 'error', message: [ls.error, idb.error].filter(Boolean).join(' / ') };
  return { status: 'empty' };
}

/** Diskteki en son sürüm numarası (başka bir sekmenin yazıp yazmadığını anlamak için) */
export function storedRev(): number {
  try {
    return Number(localStorage.getItem(REV_KEY) ?? -1);
  } catch {
    return -1;
  }
}

/**
 * Senkron kısım (localStorage) hemen yapılır; IndexedDB yazımı promise olarak döner.
 * İki yazım da başarısız olursa hata fırlatır.
 */
export function saveData(data: AppData): Promise<void> {
  const json = JSON.stringify(data);
  let localOk = false;
  let localErr = '';
  try {
    localStorage.setItem(LS_KEY, json);
    localStorage.setItem(REV_KEY, String(data.rev ?? 0));
    localOk = true;
  } catch (e) {
    localErr = (e as Error).message;
  }
  return set(IDB_KEY, data).then(
    () => undefined,
    (e) => {
      if (!localOk) throw new Error(`Kayıt yapılamadı: ${localErr} / ${(e as Error).message}`);
    },
  );
}

/**
 * Toplu değişiklikten önce geri dönüş noktası (yalnızca IndexedDB; localStorage kotasını korumak için).
 * Yazılamazsa hata fırlatır; çağıran toplu değişikliği yapmamalıdır.
 */
export async function saveSnapshot(data: AppData, reason: string): Promise<void> {
  const snap = { at: new Date().toISOString(), reason, data };
  await set(SNAP_KEY, snap);
  try {
    localStorage.removeItem(SNAP_KEY); // eski sürümlerden kalan kopya
  } catch {
    /* yoksay */
  }
}

export async function loadSnapshot(): Promise<{ at: string; reason: string; data: AppData } | null> {
  try {
    const s = await get<{ at: string; reason: string; data: AppData }>(SNAP_KEY);
    if (s) return { ...s, data: trustOwn(s.data) };
  } catch {
    /* yoksay */
  }
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { ...s, data: trustOwn(s.data) };
  } catch {
    return null;
  }
}

/** Tarayıcıdan verilerin silinmemesini ister (iOS/Android depolama temizliğine karşı) */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Uzak servis şablonları (şu an kullanılmıyor)                        */
/* ------------------------------------------------------------------ */

export interface RemoteAdapter {
  readonly name: string;
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

/**
 * Supabase şablonu. Tablo:
 *   create table ledger (id text primary key, data jsonb, updated_at timestamptz default now());
 */
export class SupabaseAdapter implements RemoteAdapter {
  readonly name = 'Supabase';
  constructor(private url: string, private anonKey: string, private rowId = 'default') {}
  private headers() {
    return { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' };
  }
  async load(): Promise<AppData | null> {
    const r = await fetch(`${this.url}/rest/v1/ledger?id=eq.${encodeURIComponent(this.rowId)}&select=data`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Supabase: ${r.status}`);
    const rows = (await r.json()) as Array<{ data: AppData }>;
    return rows[0] ? normalizeData(rows[0].data).data : null;
  }
  async save(data: AppData): Promise<void> {
    const r = await fetch(`${this.url}/rest/v1/ledger`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ id: this.rowId, data, updated_at: new Date().toISOString() }) });
    if (!r.ok) throw new Error(`Supabase: ${r.status}`);
  }
}

/** Google Sheets şablonu: Apps Script Web App (doGet/doPost) ile JSON saklama. */
export class GoogleSheetsAdapter implements RemoteAdapter {
  readonly name = 'Google Sheets';
  constructor(private endpoint: string) {}
  async load(): Promise<AppData | null> {
    const r = await fetch(this.endpoint);
    if (!r.ok) throw new Error(`Sheets: ${r.status}`);
    const j = await r.json();
    return j ? normalizeData(j).data : null;
  }
  async save(data: AppData): Promise<void> {
    const r = await fetch(this.endpoint, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'text/plain' } });
    if (!r.ok) throw new Error(`Sheets: ${r.status}`);
  }
}
