/**
 * Supabase bulut eşitleme katmanı.
 *
 * Tablo: ledgers (user_id = giriş yapan kullanıcı, data = defterin tamamı, rev = sürüm)
 * Satır güvenliği (RLS) sayesinde her kullanıcı YALNIZCA kendi satırını okuyup yazabilir.
 * Güncelleme "rev hâlâ beklediğim değer mi?" koşuluyla yapılır: başka bir cihaz araya yazdıysa
 * güncelleme reddedilir ve değişiklikler birleştirilip yeniden denenir (kayıt kaybı olmaz).
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../types';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const cloudConfigured = () => !!URL && !!KEY;

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hd:auth' } });
  return client;
}

const STATE_KEY = 'hd:cloud:v1';
export interface CloudState {
  email?: string;
  remoteRev?: number; // bu cihazın en son gördüğü buluttaki sürüm
  lastSyncAt?: string;
}
export function readCloudState(): CloudState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function writeCloudState(s: CloudState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* yoksay */
  }
}
export function clearCloudState() {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* yoksay */
  }
}

/** Hesap açıldı, e-posta onayı bekleniyor */
export class ConfirmEmail extends Error {
  constructor() {
    super('Hesabınız açıldı. E-postanıza gelen “Confirm your mail” bağlantısına tıklayın, sonra buraya dönüp “Giriş yap” ile girin.');
  }
}

export class AuthNeeded extends Error {
  constructor() {
    super('Bulut hesabına yeniden giriş yapılmalı');
  }
}

export const PAUSED_MSG =
  'Bulut sunucusuna ulaşılamadı. Uzun süre kullanılmadığı için beklemeye alınmış olabilir: bilgisayardan supabase.com’a girip “hesap-defteri” projesinde “Resume project”e basın. Kayıtlarınız bu cihazda güvende; sunucu açılınca kendiliğinden eşitlenir.';

const trMsg = (m: string) =>
  /not confirmed/i.test(m)
    ? 'E-posta adresiniz henüz onaylanmadı. E-postanıza gelen bağlantıya tıklayıp tekrar deneyin.'
    : /rate limit/i.test(m)
      ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.'
      : /invalid login/i.test(m)
    ? 'E-posta veya şifre yanlış.'
    : /already registered|already exists/i.test(m)
      ? 'Bu e-postayla zaten bir hesap var. “Giriş yap”ı seçin.'
      : /password/i.test(m) && /6|short|weak/i.test(m)
        ? 'Şifre en az 8 karakter olmalı.'
        : /email/i.test(m) && /invalid/i.test(m)
          ? 'E-posta adresi geçersiz.'
          : /fetch|network|load failed|timeout|503|540|paused/i.test(m)
            ? navigator.onLine
              ? PAUSED_MSG
              : 'İnternet bağlantısı yok.'
            : m;

export async function signIn(email: string, password: string) {
  const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(trMsg(error.message));
  return data.user?.email ?? email;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await sb().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw new Error(trMsg(error.message));
  if (!data.session) throw new ConfirmEmail();
  return data.user?.email ?? email;
}

export async function signOut() {
  await sb().auth.signOut().catch(() => undefined);
}

export async function currentUser() {
  const { data } = await sb().auth.getSession();
  return data.session?.user ?? null;
}

async function uid(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new AuthNeeded();
  return u.id;
}

/** Buluttaki sürüm numarası (satır yoksa null) */
export async function remoteRev(): Promise<number | null> {
  const id = await uid();
  const { data, error } = await sb().from('ledgers').select('rev').eq('user_id', id).maybeSingle();
  if (error) throw new Error(trMsg(error.message));
  return data ? Number(data.rev) : null;
}

export async function fetchRemote(): Promise<{ data: unknown; rev: number; updatedAt: string } | null> {
  const id = await uid();
  const { data, error } = await sb().from('ledgers').select('data, rev, updated_at').eq('user_id', id).maybeSingle();
  if (error) throw new Error(trMsg(error.message));
  return data ? { data: data.data, rev: Number(data.rev), updatedAt: data.updated_at } : null;
}

export async function insertRemote(d: AppData): Promise<number> {
  const id = await uid();
  const { data, error } = await sb().from('ledgers').insert({ user_id: id, data: d, rev: 1 }).select('rev').single();
  if (error) throw new Error(trMsg(error.message));
  return Number(data.rev);
}

/** Yalnızca buluttaki sürüm hâlâ `expected` ise yazar; değilse 'conflict' döner */
export async function updateRemote(d: AppData, expected: number): Promise<number | 'conflict'> {
  const id = await uid();
  const { data, error } = await sb()
    .from('ledgers')
    .update({ data: d, rev: expected + 1, updated_at: new Date().toISOString() })
    .eq('user_id', id)
    .eq('rev', expected)
    .select('rev');
  if (error) throw new Error(trMsg(error.message));
  return data && data.length ? Number(data[0].rev) : 'conflict';
}
