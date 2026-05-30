import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByUsername } from '@/lib/db/users';
import { createOtp } from '@/lib/db/otp';
import { sendOtp } from '@/lib/mailer';
import { loginLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const limited = loginLimiter(req);
  if (limited) return limited;

  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await getUserByUsername(String(username));
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // No 2FA → tell the client to proceed with normal sign-in.
    if (!user.two_factor_enabled) {
      return NextResponse.json({ twoFactorRequired: false });
    }

    // 2FA on but no email on file → cannot deliver a code.
    if (!user.email) {
      return NextResponse.json(
        { error: 'Two-factor is enabled but no email is on file. Contact an administrator.' },
        { status: 400 }
      );
    }

    const code = await createOtp(user.id);
    await sendOtp({ to: user.email, otp: code });

    return NextResponse.json({ twoFactorRequired: true, userId: user.id });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
