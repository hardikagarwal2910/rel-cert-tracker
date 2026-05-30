import { SignJWT, jwtVerify } from 'jose';

// Short-lived signed proof that a user passed OTP verification.
// Signed with NEXTAUTH_SECRET; consumed by the NextAuth credentials authorize().
function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');
}

export async function signOtpToken(userId: string): Promise<string> {
  return new SignJWT({ userId, otp_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret());
}

export async function verifyOtpToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.otp_verified === true && typeof payload.userId === 'string') {
      return payload.userId;
    }
    return null;
  } catch {
    return null;
  }
}
