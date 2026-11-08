import { NextResponse } from 'next/server';
import { getRedirectUri, getGoogleAuthUrl } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const redirectUri = getRedirectUri(request.url);
  const url = getGoogleAuthUrl(redirectUri);
  return NextResponse.json({ url });
}

