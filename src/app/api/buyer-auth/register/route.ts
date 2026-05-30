import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerBuyer } from '@/lib/db/buyers';
import { sendBuyerRegistrationNotification } from '@/lib/mailer';
import { appendAuditLog } from '@/lib/db/audit-log';
import { loginLimiter } from '@/lib/rate-limit';

const schema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email(),
  designation: z.string().optional(),
});

// Best-effort IP geolocation — never blocks, never throws.
async function lookupGeo(ip: string): Promise<Record<string, unknown> | null> {
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return null;
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { country: d.country, region: d.regionName, city: d.city };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const limited = loginLimiter(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please provide a valid name and email.' }, { status: 400 });
    }

    const ipRaw = req.headers.get('x-forwarded-for') ?? 'unknown';
    const ip = ipRaw.split(',')[0].trim();
    const geolocation = await lookupGeo(ip);

    await registerBuyer({
      name: parsed.data.name,
      company: parsed.data.company,
      email: parsed.data.email,
      designation: parsed.data.designation,
      ip_address: ip,
      geolocation,
    });

    // Notify REL admin (best-effort).
    const notifyEmail = process.env.NOTIFICATION_EMAIL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    if (notifyEmail) {
      await sendBuyerRegistrationNotification({
        to: notifyEmail,
        buyerName: parsed.data.name,
        company: parsed.data.company ?? '',
        email: parsed.data.email,
        adminUrl: `${appUrl}/buyer-activity`,
      });
    }

    appendAuditLog({
      action_type: 'buyer.register',
      user_identifier: parsed.data.email,
      detail: parsed.data.company ?? '',
      ip_address: ip,
    });

    // Generic success — never reveal whether the account already existed.
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
