import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { requireAuth, isRequestAuthenticated } from '@/lib/session';
import { getMasterSheetStatus, runGoogleSheetsSync } from '@/lib/sheetsSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SYNC_SECRET;
  if (!cronSecret || cronSecret.length < 16) return false;

  const authHeader = request.headers.get('authorization') || '';
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;

  const provided = authHeader.slice(prefix.length).trim();
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(cronSecret, 'utf8');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const status = await getMasterSheetStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { googleConnected: false, error: err?.message || 'Errore lettura stato Foglio Google' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const isCron = isAuthorizedCronRequest(request);
  const isSessionAuth = isRequestAuthenticated(request);

  if (!isCron && !isSessionAuth) {
    return NextResponse.json(
      { ok: false, status: 'error', error: "Non autorizzato. Effettua l'accesso con il PIN." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const source: 'app' | 'manual' | 'cron' = isCron
      ? 'cron'
      : body?.source === 'app'
      ? 'app'
      : 'manual';
    const force = Boolean(body?.force);
    const createIfMissing = isCron ? false : Boolean(body?.createIfMissing);

    const result = await runGoogleSheetsSync({
      source,
      force,
      createIfMissing,
    });

    if (result.sheetsApiDisabled || result.scopeMissing) {
      return NextResponse.json(result, { status: 403 });
    }
    if (!result.ok && result.status === 'error') {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('POST /api/sheets/sync error:', err);
    return NextResponse.json(
      { ok: false, status: 'error', error: err?.message || 'Errore interno sincronizzazione Fogli Google' },
      { status: 500 }
    );
  }
}
