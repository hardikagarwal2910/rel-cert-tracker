import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getBuyers } from '@/lib/db/buyers';
import type { BuyerStatus } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as BuyerStatus | null;

    const buyers = await getBuyers(status ?? undefined);
    return NextResponse.json(buyers);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
