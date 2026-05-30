import { adminClient } from '@/lib/supabase/admin';
import type { Certificate, Supplier, Location } from '@/types/database';

export interface GlobalSearchResult {
  certificates: Certificate[];
  suppliers: Supplier[];
  locations: Location[];
}

const LIMIT = 20;

// Strip characters that would break a PostgREST .or() / ilike filter.
function sanitise(q: string): string {
  return q.replace(/[,%()*{}]/g, ' ').trim();
}

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const safe = sanitise(query ?? '');
  // Do not query on a blank search.
  if (!safe) {
    return { certificates: [], suppliers: [], locations: [] };
  }

  const like = `%${safe}%`;

  const [certRes, supRes, locRes] = await Promise.all([
    adminClient
      .from('certificates')
      .select('*')
      .or(`name.ilike.${like},cert_number.ilike.${like},issuing_body.ilike.${like}`)
      .limit(LIMIT),
    adminClient
      .from('suppliers')
      .select('*')
      .ilike('name', like)
      .limit(LIMIT),
    adminClient
      .from('locations')
      .select('*')
      .or(`name.ilike.${like},city.ilike.${like},state.ilike.${like}`)
      .limit(LIMIT),
  ]);

  return {
    certificates: (certRes.data as Certificate[]) ?? [],
    suppliers: (supRes.data as Supplier[]) ?? [],
    locations: (locRes.data as Location[]) ?? [],
  };
}
