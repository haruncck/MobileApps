import { get, set, del } from 'idb-keyval';
import type { AppData } from '../types';
import { normalizeData } from './normalize';

/**
 * Modüler depolama katmanı.
 * Uygulama yalnızca `StorageAdapter` arayüzünü bilir; yerel (IndexedDB) depolama
 * varsayılandır. Supabase / Google Sheets gibi uzak servisler aynı arayüzü
 * uygulayarak `SyncedStorage` ile yerel depolamanın arkasına takılabilir.
 */
export interface StorageAdapter {
  readonly name: string;
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear?(): Promise<void>;
}

const KEY = 'saha-cari:data:v1';
const LS_KEY = 'saha-cari:backup:v1';

/** Birincil: IndexedDB. IndexedDB yoksa (gizli mod vb.) LocalStorage'a düşer. */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'Yerel (IndexedDB)';

  async load(): Promise<AppData | null> {
    try {
      const d = await get<AppData>(KEY);
      if (d) return normalizeData(d);
    } catch {
      /* IndexedDB kullanılamıyor */
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? normalizeData(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  async save(data: AppData): Promise<void> {
    let ok = false;
    try {
      await set(KEY, data);
      ok = true;
    } catch {
      /* yoksay */
    }
    try {
      // İkincil kopya (küçük veri setleri için yeterli, kota aşılırsa sessizce geçer)
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      ok = true;
    } catch {
      /* yoksay */
    }
    if (!ok) throw new Error('Veri kaydedilemedi');
  }

  async clear(): Promise<void> {
    await del(KEY).catch(() => undefined);
    localStorage.removeItem(LS_KEY);
  }
}

/* ------------------------------------------------------------------ */
/* Uzak servis şablonları – bağlantı bilgileri girildiğinde etkinleşir */
/* ------------------------------------------------------------------ */

/**
 * Supabase adaptörü (şablon).
 * Kurulum: `npm i @supabase/supabase-js`, ardından tek satırlık bir tablo:
 *   create table ledger (id text primary key, data jsonb, updated_at timestamptz default now());
 */
export class SupabaseAdapter implements StorageAdapter {
  readonly name = 'Supabase';
  constructor(private url: string, private anonKey: string, private rowId = 'default') {}

  private headers() {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    };
  }

  async load(): Promise<AppData | null> {
    const r = await fetch(`${this.url}/rest/v1/ledger?id=eq.${encodeURIComponent(this.rowId)}&select=data`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Supabase: ${r.status}`);
    const rows = (await r.json()) as Array<{ data: AppData }>;
    return rows[0] ? normalizeData(rows[0].data) : null;
  }

  async save(data: AppData): Promise<void> {
    const r = await fetch(`${this.url}/rest/v1/ledger`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ id: this.rowId, data, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) throw new Error(`Supabase: ${r.status}`);
  }
}

/**
 * Google Sheets adaptörü (şablon).
 * En basit yol: Google Apps Script ile bir Web App yayınlayıp (doGet/doPost)
 * JSON'u bir hücrede saklamak. `endpoint` = Apps Script Web App URL'i.
 */
export class GoogleSheetsAdapter implements StorageAdapter {
  readonly name = 'Google Sheets';
  constructor(private endpoint: string) {}

  async load(): Promise<AppData | null> {
    const r = await fetch(this.endpoint);
    if (!r.ok) throw new Error(`Sheets: ${r.status}`);
    const j = await r.json();
    return j ? normalizeData(j) : null;
  }

  async save(data: AppData): Promise<void> {
    // Apps Script CORS ön-kontrolünü desteklemediği için text/plain gönderilir
    const r = await fetch(this.endpoint, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'text/plain' } });
    if (!r.ok) throw new Error(`Sheets: ${r.status}`);
  }
}

/**
 * Yerel öncelikli senkronizasyon: her zaman önce yerele yazar (offline çalışır),
 * ardından uzak servise arka planda gönderir. Hata olursa yerel veri korunur.
 */
export class SyncedStorage implements StorageAdapter {
  readonly name: string;
  constructor(private local: StorageAdapter, private remote?: StorageAdapter) {
    this.name = remote ? `${local.name} + ${remote.name}` : local.name;
  }

  async load(): Promise<AppData | null> {
    return this.local.load();
  }

  async save(data: AppData): Promise<void> {
    await this.local.save(data);
    if (this.remote && navigator.onLine) {
      this.remote.save(data).catch((e) => console.warn('Uzak senkronizasyon başarısız:', e));
    }
  }
}

export const storage: StorageAdapter = new SyncedStorage(new LocalStorageAdapter());
