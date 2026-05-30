import { SignJWT, jwtVerify } from 'jose';

// Signed, time-limited token for the buyer "set your password" link.
// Stateless (no DB storage) — mirrors the supplier invite token pattern.
function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');
}

export async function signBuyerInviteToken(buyerId: string): Promise<string> {
  return new SignJWT({ buyer_id: buyerId, purpose: 'buyer_set_password' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifyBuyerInviteToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose === 'buyer_set_password' && typeof payload.buyer_id === 'string') {
      return payload.buyer_id;
    }
    return null;
  } catch {
    return null;
  }
}
