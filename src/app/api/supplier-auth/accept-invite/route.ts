import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSuppliers, updateSupplier } from '@/lib/db/suppliers';
import { decrypt } from '@/lib/encryption';
import { appendAuditLog } from '@/lib/db/audit-log';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirmPassword: z.string().min(1),
});

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { token, password, confirmPassword } = parsed.data;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // Find supplier with matching invite token
    const suppliers = await getSuppliers();
    const supplier = suppliers.find((s) => {
      if (!s.portal_login?.invite_token) return false;
      const decrypted = decrypt(s.portal_login.invite_token);
      return decrypted === token;
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 });
    }

    const expiresAt = supplier.portal_login?.invite_expires;
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite token has expired' }, { status: 400 });
    }

    if (supplier.portal_login?.invite_accepted) {
      return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const portalEmail = supplier.portal_login?.email ?? '';

    await updateSupplier(supplier.id, {
      portal_login: {
        email: portalEmail,
        password_hash,
        invite_token: supplier.portal_login?.invite_token,
        invite_expires: expiresAt as string,
        invite_accepted: true,
      },
    } as Parameters<typeof updateSupplier>[1]);

    const decryptedEmail = decrypt(portalEmail) ?? portalEmail;
    const jwtToken = await new SignJWT({
      supplier_id: supplier.id,
      role: 'supplier',
      email: decryptedEmail,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(secret);

    appendAuditLog({
      action_type: 'supplier.accept_invite',
      user_identifier: decryptedEmail,
      target: supplier.id,
      ip_address: ip,
    });

    const res = NextResponse.json({ supplier_id: supplier.id, name: supplier.name });
    res.cookies.set('rel_supplier_token', jwtToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
