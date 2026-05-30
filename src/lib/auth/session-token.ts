import type { NextRequest } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';

/**
 * Read the NextAuth (Auth.js v5) session token from the request.
 *
 * Auth.js v5 encrypts the session JWT with a salt equal to the cookie name.
 * On HTTPS the cookie is `__Secure-authjs.session-token`; on HTTP it's
 * `authjs.session-token`. `getToken` must be told which one to use, otherwise
 * the salt mismatches and decode silently returns null — which would bounce
 * every authenticated request back to /login. We detect the protocol from the
 * request and pass the matching cookieName + salt explicitly.
 */
export async function getSessionToken(req: NextRequest): Promise<JWT | null> {
  const isSecure =
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https';
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure,
    cookieName,
    salt: cookieName,
  });
}
