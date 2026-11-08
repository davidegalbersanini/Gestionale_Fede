import { NextResponse } from 'next/server';
import { getStoredTokens, removeStoredTokens } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tokens = await getStoredTokens();
  if (!tokens || !tokens.access_token) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    email: tokens.email || 'Account collegato',
  });
}

export async function POST() {
  await removeStoredTokens();
  return NextResponse.json({ success: true, connected: false });
}

