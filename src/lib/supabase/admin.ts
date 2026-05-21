import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy singleton — validates env vars on first call, not at module load.
 * This prevents build-time failures when env vars are absent during `next build`.
 */
let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey) {
    throw new Error(
      'FATAL: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'This key is required for all server-side database operations. ' +
      'Add it to your .env.local and Vercel environment variables.'
    );
  }

  if (!supabaseUrl) {
    throw new Error(
      'FATAL: NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Add it to your .env.local and Vercel environment variables.'
    );
  }

  _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}

/**
 * Proxy that forwards all property accesses to the lazy-initialized client.
 * Usage is identical to `createClient(...)` — just import adminClient and use it.
 */
export const adminClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdminClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
