import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  checkAndRecordPinAttempt,
  createSessionToken,
  isRequestAuthenticated,
  isSecureCookieContext,
  requireAuth,
  updateServerPin,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return NextResponse.json({
    authenticated: isRequestAuthenticated(request),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const rememberDevice = body.rememberDevice !== false;

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { authenticated: false, error: 'Inserisci un PIN numerico di 4 cifre.' },
        { status: 400 }
      );
    }

    const result = await checkAndRecordPinAttempt(request, pin);

    if (result.status === 'locked') {
      const mins = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      return NextResponse.json(
        {
          authenticated: false,
          locked: true,
          retryAfterSeconds: result.retryAfterSeconds,
          error: `Troppi tentativi errati. Riprova tra ${mins} ${mins === 1 ? 'minuto' : 'minuti'}.`,
        },
        { status: 429 }
      );
    }

    if (result.status === 'invalid') {
      return NextResponse.json(
        {
          authenticated: false,
          remainingAttempts: result.remainingAttempts,
          error: `PIN non corretto (${result.remainingAttempts} ${
            result.remainingAttempts === 1 ? 'tentativo rimasto' : 'tentativi rimasti'
          }).`,
        },
        { status: 401 }
      );
    }

    const { token, maxAge } = createSessionToken(rememberDevice);
    const res = NextResponse.json({ authenticated: true });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookieContext(request),
      path: '/',
      ...(maxAge ? { maxAge } : {}),
    });
    return res;
  } catch (err: any) {
    console.error('POST /api/auth/pin error:', err);
    return NextResponse.json(
      { authenticated: false, error: 'Errore interno nella verifica del PIN.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const newPin = typeof body.newPin === 'string' ? body.newPin.trim() : '';

    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, error: 'Il nuovo PIN deve essere composto esattamente da 4 cifre numeriche.' },
        { status: 400 }
      );
    }

    await updateServerPin(newPin);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('PATCH /api/auth/pin error:', err);
    return NextResponse.json(
      { success: false, error: 'Impossibile aggiornare il PIN.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookieContext(request),
    path: '/',
    maxAge: 0,
  });
  return res;
}
