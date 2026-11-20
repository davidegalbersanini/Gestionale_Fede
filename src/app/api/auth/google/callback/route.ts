import { NextRequest, NextResponse } from 'next/server';
import { getRedirectUri, exchangeCodeForTokens, saveStoredTokens } from '@/lib/googleAuth';
import { isRequestAuthenticated } from '@/lib/session';

export const dynamic = 'force-dynamic';

function redirectWithClearedState(urlStr: string) {
  const res = NextResponse.redirect(urlStr);
  res.cookies.set('gcal_oauth_state', '', { path: '/', maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');
  const cookieState = request.cookies.get('gcal_oauth_state')?.value;

  const origin = url.origin;

  if (!isRequestAuthenticated(request)) {
    return redirectWithClearedState(`${origin}/?gcal=error`);
  }

  if (error || !code) {
    console.error('Google OAuth error or cancelled:', error);
    return redirectWithClearedState(`${origin}/?gcal=error`);
  }

  if (!state || !cookieState || state !== cookieState) {
    console.error('Google OAuth state mismatch');
    return redirectWithClearedState(`${origin}/?gcal=error`);
  }

  const redirectUri = getRedirectUri(request.url, request.headers);
  const tokens = await exchangeCodeForTokens(code, redirectUri);

  if (!tokens) {
    return redirectWithClearedState(`${origin}/?gcal=failed`);
  }

  await saveStoredTokens(tokens);
  return redirectWithClearedState(`${origin}/?gcal=connected`);
}
