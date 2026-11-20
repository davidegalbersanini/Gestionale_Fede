import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getRedirectUri, getGoogleAuthUrl } from '@/lib/googleAuth';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const redirectUri = getRedirectUri(request.url, request.headers);
  const state = crypto.randomBytes(24).toString('hex');
  const url = getGoogleAuthUrl(redirectUri, state);

  const response = NextResponse.json({ url });
  response.cookies.set('gcal_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !redirectUri.includes('localhost') && !redirectUri.startsWith('http://'),
    path: '/',
    maxAge: 600,
  });

  return response;
}
