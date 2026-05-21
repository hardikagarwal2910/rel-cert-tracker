import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getSupplierById, updateSupplier } from '@/lib/db/suppliers';
import { encrypt } from '@/lib/encryption';
import { appendAuditLog } from '@/lib/db/audit-log';
import { sendPortalInvite } from '@/lib/mailer';
import { adminLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = adminLimiter(req);
  if (limited) return limited;

  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const supplier = await getSupplierById(id);
    if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Find first contact with an email
    const contactWithEmail = supplier.contacts?.find((c) => c.email);
    if (!contactWithEmail?.email) {
      return NextResponse.json({ error: 'Supplier has no contact with an email address' }, { status: 400 });
    }
    const contactEmail = contactWithEmail.email; // already decrypted by getSupplierById

    const inviteToken = uuidv4();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/supplier/accept-invite?token=${inviteToken}`;

    // Preserve existing portal_login fields if they exist
    const existingPortalLogin = supplier.portal_login ?? {};

    await updateSupplier(id, {
      portal_login: {
        ...existingPortalLogin,
        email: encrypt(contactEmail),
        invite_token: encrypt(inviteToken),
        invite_expires: inviteExpiresAt,
        invite_accepted: false,
      },
      onboarding_checklist: {
        ...supplier.onboarding_checklist,
        invite_sent: true,
      },
    } as Parameters<typeof updateSupplier>[1]);

    await sendPortalInvite({
      to: contactEmail,
      supplierName: supplier.name,
      inviteUrl,
    });

    appendAuditLog({
      action_type: 'supplier.invite_sent',
      user_identifier: auth.username,
      target: id,
      detail: `Invite sent to ${contactEmail}`,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, message: `Invite sent to ${contactEmail}` });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
