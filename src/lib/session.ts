import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/serverSupabase';

export const SESSION_COOKIE_NAME = 'fede_session';
const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30 days
const SESSION_MAX_AGE_SHORT = 60 * 60 * 12; // 12 hours
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getSessionSecret(): Buffer {
  const explicit = process.env.APP_SESSION_SECRET;
  if (explicit && explicit.length >= 16) {
    return crypto.createHash('sha256').update(explicit).digest();
  }
  const fallbackSeed = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GOOGLE_CLIENT_SECRET || 'dev-fallback-secret';
  return crypto.createHash('sha256').update(`gestionale-fede-session-v1|${fallbackSeed}`).digest();
}

export function createSessionToken(rememberDevice: boolean): { token: string; maxAge?: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = rememberDevice ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_SHORT;
  const payload = {
    v: 1,
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('hex');
  return {
    token: `${payloadB64}.${sig}`,
    maxAge: rememberDevice ? SESSION_MAX_AGE_REMEMBER : undefined,
  };
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return false;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('hex');
  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (typeof parsed?.exp !== 'number') return false;
    return parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function parseCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return undefined;
}

export function isRequestAuthenticated(request: Request): boolean {
  const token = parseCookieFromHeader(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  return verifySessionToken(token);
}

export function requireAuth(request: Request): NextResponse | null {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: 'Non autorizzato. Effettua l\'accesso con il PIN.' }, { status: 401 });
  }
  return null;
}

export function isSecureCookieContext(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || '';
  if (host.includes('localhost') || host.startsWith('127.0.0.1')) return false;
  if (proto === 'http') return false;
  return process.env.NODE_ENV === 'production';
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPinAgainstStored(pin: string, storedValue: string): { valid: boolean; needsUpgrade: boolean } {
  if (!pin || !storedValue) return { valid: false, needsUpgrade: false };

  if (storedValue.startsWith('scrypt:')) {
    const parts = storedValue.split(':');
    if (parts.length !== 3) return { valid: false, needsUpgrade: false };
    const [, salt, storedHex] = parts;
    const derivedHex = crypto.scryptSync(pin, salt, 32).toString('hex');
    const a = Buffer.from(derivedHex, 'hex');
    const b = Buffer.from(storedHex, 'hex');
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { valid, needsUpgrade: false };
  }

  // Legacy plaintext PIN compatibility (e.g. '1234')
  const a = Buffer.from(pin, 'utf8');
  const b = Buffer.from(storedValue, 'utf8');
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { valid, needsUpgrade: valid };
}

interface RateLimitBucket {
  attempts: number;
  locked_until: number | null;
}

function getClientIpKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'global';
  const ip = forwarded.split(',')[0].trim() || 'global';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export async function checkAndRecordPinAttempt(
  request: Request,
  pin: string
): Promise<
  | { status: 'ok' }
  | { status: 'invalid'; remainingAttempts: number }
  | { status: 'locked'; retryAfterSeconds: number }
> {
  const supabase = getServerSupabase();
  const ipKey = getClientIpKey(request);
  const now = Date.now();

  // 1. Check rate limit state
  const { data: rlRow } = await (supabase.from('settings') as any)
    .select('value')
    .eq('key', 'pin_rate_limit')
    .single();

  const buckets: Record<string, RateLimitBucket> =
    rlRow?.value && typeof rlRow.value === 'object' ? { ...rlRow.value } : {};

  // Prune expired buckets
  for (const k of Object.keys(buckets)) {
    const b = buckets[k];
    if (b?.locked_until && b.locked_until < now) {
      delete buckets[k];
    }
  }

  const bucket: RateLimitBucket = buckets[ipKey] || { attempts: 0, locked_until: null };
  if (bucket.locked_until && bucket.locked_until > now) {
    return {
      status: 'locked',
      retryAfterSeconds: Math.ceil((bucket.locked_until - now) / 1000),
    };
  }

  // 2. Fetch stored PIN from app_settings
  const { data: settingsRow } = await (supabase.from('settings') as any)
    .select('value')
    .eq('key', 'app_settings')
    .single();

  const appSettings =
    settingsRow?.value && typeof settingsRow.value === 'object' ? settingsRow.value : {};
  const storedPin: string = appSettings.pin_hash || process.env.APP_DEFAULT_PIN || '1234';

  const { valid, needsUpgrade } = verifyPinAgainstStored(pin, storedPin);

  if (!valid) {
    const nextAttempts = (bucket.attempts || 0) + 1;
    const isNowLocked = nextAttempts >= MAX_PIN_ATTEMPTS;
    buckets[ipKey] = {
      attempts: isNowLocked ? MAX_PIN_ATTEMPTS : nextAttempts,
      locked_until: isNowLocked ? now + LOCKOUT_MS : null,
    };
    await (supabase.from('settings') as any).upsert({
      key: 'pin_rate_limit',
      value: buckets,
    });

    if (isNowLocked) {
      return {
        status: 'locked',
        retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
      };
    }

    return {
      status: 'invalid',
      remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts),
    };
  }

  // 3. Success: clear rate limit bucket & upgrade plaintext PIN to scrypt hash if needed
  if (buckets[ipKey]) {
    delete buckets[ipKey];
    await (supabase.from('settings') as any).upsert({
      key: 'pin_rate_limit',
      value: buckets,
    });
  }

  if (needsUpgrade || !appSettings.pin_hash) {
    await (supabase.from('settings') as any).upsert({
      key: 'app_settings',
      value: {
        ...appSettings,
        pin_hash: hashPin(pin),
        yearly_target: appSettings.yearly_target ?? 35000,
      },
    });
  }

  return { status: 'ok' };
}

export async function updateServerPin(newPin: string): Promise<void> {
  const supabase = getServerSupabase();
  const { data: settingsRow } = await (supabase.from('settings') as any)
    .select('value')
    .eq('key', 'app_settings')
    .single();

  const existing =
    settingsRow?.value && typeof settingsRow.value === 'object' ? settingsRow.value : {};

  await (supabase.from('settings') as any).upsert({
    key: 'app_settings',
    value: {
      ...existing,
      pin_hash: hashPin(newPin),
      yearly_target: existing.yearly_target ?? 35000,
    },
  });
}
