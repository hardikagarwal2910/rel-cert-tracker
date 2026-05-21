/**
 * Jest global setup — runs after test framework is loaded (setupFilesAfterEnv).
 * Sets required environment variables for all tests.
 * Module-level mocks are defined in individual test files.
 */

// Encryption key — must be >= 32 chars
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32chars-minimum!';
}

// NextAuth secret — must be >= 32 chars
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-32chars-minimu!';
}

// Supabase (test values — no real DB connection)
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// Cron secret
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';

// App URL
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
