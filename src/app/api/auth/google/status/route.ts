import { NextResponse } from 'next/server';
import { getStoredTokens, removeStoredTokens } from '@/lib/googleAuth';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const tokens = await getStoredTokens();
  if (!tokens || !tokens.access_token) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    email: tokens.email || 'Account collegato',
  });
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  await removeStoredTokens();
  return NextResponse.json({ success: true, connected: false });
}
