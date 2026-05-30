import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByUsername, updateLastLogin } from '@/lib/db/users';
import { verifyOtpToken } from '@/lib/auth/otp-token';

// Secret is validated lazily at runtime (not build time)
const secret = process.env.NEXTAUTH_SECRET ?? '';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        otpToken: { label: 'OTP Token', type: 'text' },
      },
      async authorize(credentials) {
        // Validate secret at runtime
        if (secret.length < 32) {
          throw new Error(
            'FATAL: NEXTAUTH_SECRET is missing or under 32 characters. ' +
            'Generate one with: openssl rand -base64 32'
          );
        }

        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await getUserByUsername(credentials.username as string);
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        // If the user has 2FA enabled, require a valid OTP proof token.
        // (Non-2FA users are unaffected — existing logins work as before.)
        if (user.two_factor_enabled) {
          const otpToken = credentials.otpToken as string | undefined;
          if (!otpToken) return null;
          const verifiedUserId = await verifyOtpToken(otpToken);
          if (verifiedUserId !== user.id) return null;
        }

        await updateLastLogin(user.id);

        return {
          id: user.id,
          name: user.display_name ?? user.username,
          email: user.email ?? '',
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const extUser = user as unknown as { role: string; username: string };
        token.role = extUser.role;
        token.username = extUser.username;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        const extUser = session.user as unknown as { role: string; username: string };
        extUser.role = token.role as string;
        extUser.username = token.username as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  secret,
};
