import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/db/otp';
import { signOtpToken } from '@/lib/auth/otp-token';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json();
    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const result = await verifyOtp(String(userId), String(code));

    if (!result.ok) {
      appendAuditLog({
        action_type: 'auth.2fa_verify',
        user_identifier: String(userId),
        detail: 'failed',
        ip_address: ip,
      });
      return NextResponse.json(
        { error: 'Invalid or expired code', remaining: result.remaining },
        { status: 401 }
      );
    }

    const token = await signOtpToken(String(userId));

    appendAuditLog({
      action_type: 'auth.2fa_verify',
      user_identifier: String(userId),
      detail: 'success',
      ip_address: ip,
    });

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
