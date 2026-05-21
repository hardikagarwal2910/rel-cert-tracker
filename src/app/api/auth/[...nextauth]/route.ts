import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';
import { loginLimiter } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

const { handlers } = NextAuth(authConfig);

export async function GET(req: NextRequest) {
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  // Apply rate limit on sign-in endpoint (URL contains /signin)
  if (req.nextUrl.pathname.includes('signin')) {
    const limited = loginLimiter(req);
    if (limited) return limited;
  }
  return handlers.POST(req);
}
