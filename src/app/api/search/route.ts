import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { globalSearch } from '@/lib/db/search';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? '';

    const results = await globalSearch(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
