import { NextResponse } from 'next/server';
import { getRedirectUri, exchangeCodeForTokens, saveStoredTokens } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const origin = url.origin;

  if (error || !code) {
    console.error('Google OAuth error or cancelled:', error);
    return NextResponse.redirect(`${origin}/?gcal=error`);
  }

  const redirectUri = getRedirectUri(request.url);
  const tokens = await exchangeCodeForTokens(code, redirectUri);

  if (!tokens) {
    return NextResponse.redirect(`${origin}/?gcal=failed`);
  }

  await saveStoredTokens(tokens);
  return NextResponse.redirect(`${origin}/?gcal=connected`);
}

