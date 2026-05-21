import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSuppliers } from '@/lib/db/suppliers';
import { decrypt } from '@/lib/encryption';
import { appendAuditLog } from '@/lib/db/audit-log';
import { loginLimiter } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');

export async function POST(req: NextRequest) {
  const limited = loginLimiter(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    // Find supplier by matching decrypted portal_login.email
    const suppliers = await getSuppliers();
    const supplier = suppliers.find((s) => {
      if (!s.portal_login?.email) return false;
      const decrypted = decrypt(s.portal_login.email);
      return decrypted === email;
    });

    if (!supplier || !supplier.portal_login?.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!supplier.portal_login.invite_accepted) {
      return NextResponse.json({ error: 'Account not activated. Please accept your invite first.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, supplier.portal_login.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Issue JWT
    const token = await new SignJWT({
      supplier_id: supplier.id,
      role: 'supplier',
      email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(secret);

    appendAuditLog({
      action_type: 'supplier.login',
      user_identifier: email,
      target: supplier.id,
      ip_address: ip,
    });

    const res = NextResponse.json({ supplier_id: supplier.id, name: supplier.name });
    res.cookies.set('rel_supplier_token', token, {
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
