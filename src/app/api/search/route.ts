import { NextRequest, NextResponse } from 'next/server';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { globalSearch } from '@/lib/db/search';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'VIEW_DATA');
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? '';

    const results = await globalSearch(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
