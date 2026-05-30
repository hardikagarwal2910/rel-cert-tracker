import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getBuyerById, setBuyerVisibleTags } from '@/lib/db/buyers';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;
    const { id } = await context.params;
    const buyer = await getBuyerById(id);
    if (!buyer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(buyer);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

const patchSchema = z.object({ visible_tags: z.array(z.string()) });

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'visible_tags (string[]) is required' }, { status: 400 });
    }

    const buyer = await setBuyerVisibleTags(id, parsed.data.visible_tags);

    appendAuditLog({
      action_type: 'buyer.visibility_update',
      user_identifier: auth.username,
      target: id,
      detail: `tags: ${parsed.data.visible_tags.join(', ') || '(all)'}`,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, visible_tags: buyer.visible_tags ?? [] });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
