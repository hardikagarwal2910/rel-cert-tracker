import { adminClient } from '@/lib/supabase/admin';
import type { Location } from '@/types/database';
import type { LocationInput } from '@/types';

export async function getLocations(activeOnly = false): Promise<Location[]> {
  let query = adminClient.from('locations').select('*');
  if (activeOnly) query = query.eq('active', true);
  query = query.order('name', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data as Location[]) ?? [];
}

export async function getLocationById(id: string): Promise<Location | null> {
  const { data, error } = await adminClient
    .from('locations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Location;
}

export async function createLocation(input: LocationInput): Promise<Location> {
  const { data, error } = await adminClient
    .from('locations')
    .insert({ ...input, country: input.country ?? 'India' })
    .select()
    .single();
  if (error) throw error;
  return data as Location;
}

export async function updateLocation(
  id: string,
  input: Partial<LocationInput>
): Promise<Location> {
  const { data, error } = await adminClient
    .from('locations')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Location;
}

export async function deactivateLocation(id: string): Promise<void> {
  const { error } = await adminClient
    .from('locations')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function reactivateLocation(id: string): Promise<void> {
  const { error } = await adminClient
    .from('locations')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getCertCountByLocation(): Promise<
  { location_id: string; count: number }[]
> {
  const { data, error } = await adminClient
    .from('certificates')
    .select('location_id')
    .not('location_id', 'is', null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.location_id) {
      counts[row.location_id] = (counts[row.location_id] ?? 0) + 1;
    }
  }
  return Object.entries(counts).map(([location_id, count]) => ({ location_id, count }));
}
