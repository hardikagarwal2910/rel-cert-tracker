import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getBuyerVisits } from '@/lib/db/buyers';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const visits = await getBuyerVisits(id, 100);
    return NextResponse.json(visits);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
