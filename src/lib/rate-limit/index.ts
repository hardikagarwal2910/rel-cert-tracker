import { NextRequest, NextResponse } from 'next/server';

interface RateLimitState {
  count: number;
  resetAt: number;
}

// In-memory store — per-process; resets on cold start
// Suitable for Vercel serverless (each instance is isolated)
const store = new Map<string, RateLimitState>();

function getKey(req: NextRequest, prefix: string): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return `${prefix}:${ip}`;
}

function checkLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const state = store.get(key);

  if (!state || now > state.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (state.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: state.resetAt };
  }

  state.count += 1;
  return { allowed: true, remaining: maxRequests - state.count, resetAt: state.resetAt };
}

type RateLimiter = (req: NextRequest) => NextResponse | null;

function createLimiter(
  prefix: string,
  maxRequests: number,
  windowMs: number
): RateLimiter {
  return (req: NextRequest): NextResponse | null => {
    const key = getKey(req, prefix);
    const result = checkLimit(key, maxRequests, windowMs);
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
    return null; // allowed — continue
  };
}

// 5 per 15 min per IP
export const loginLimiter = createLimiter('login', 5, 15 * 60 * 1000);

// 1 per hour per IP
export const backupLimiter = createLimiter('backup', 1, 60 * 60 * 1000);

// 20 per hour per IP
export const ocrLimiter = createLimiter('ocr', 20, 60 * 60 * 1000);

// 10 per minute per IP
export const downloadLimiter = createLimiter('download', 10, 60 * 1000);

// 100 per 15 min per IP
export const adminLimiter = createLimiter('admin', 100, 15 * 60 * 1000);
