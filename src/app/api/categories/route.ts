import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { getCategories, createCategory, deactivateCategory } from '@/lib/db/categories';
import { appendAuditLog } from '@/lib/db/audit-log';

const createSchema = z.object({
  name: z.string().min(1),
});

const deactivateSchema = z.object({
  id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'VIEW_DATA');
    if (!isAuthResult(auth)) return auth;

    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'SETTINGS');
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const category = await createCategory(parsed.data.name);

    appendAuditLog({
      action_type: 'category.create',
      user_identifier: auth.username,
      target: category.id,
      detail: category.name,
      ip_address: ip,
    });

    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'SETTINGS');
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = deactivateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    await deactivateCategory(parsed.data.id);

    appendAuditLog({
      action_type: 'category.deactivate',
      user_identifier: auth.username,
      target: parsed.data.id,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
