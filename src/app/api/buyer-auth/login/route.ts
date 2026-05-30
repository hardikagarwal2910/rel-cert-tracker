import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getBuyerByEmail, updateBuyerLogin, logBuyerVisit } from '@/lib/db/buyers';
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

    const buyer = await getBuyerByEmail(email);
    if (!buyer || !buyer.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Only approved buyers may sign in.
    if (buyer.status !== 'approved') {
      const message =
        buyer.status === 'pending'
          ? 'Your access is pending approval.'
          : buyer.status === 'suspended'
          ? 'Your access has been suspended. Contact REL.'
          : 'Your access request was not approved.';
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, buyer.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await new SignJWT({ buyer_id: buyer.id, role: 'buyer', email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(secret);

    await updateBuyerLogin(buyer.id);
    logBuyerVisit(buyer.id, { ip, path: 'login' });

    appendAuditLog({
      action_type: 'buyer.login',
      user_identifier: email,
      target: buyer.id,
      ip_address: ip,
    });

    const res = NextResponse.json({ buyer_id: buyer.id, name: buyer.name });
    res.cookies.set('rel_buyer_token', token, {
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
