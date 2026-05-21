import { adminClient } from '@/lib/supabase/admin';
import type { Category } from '@/types/database';

export async function getCategories(activeOnly = false): Promise<Category[]> {
  let query = adminClient.from('categories').select('*');
  if (activeOnly) query = query.eq('active', true);
  query = query.order('name', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data as Category[]) ?? [];
}

export async function createCategory(name: string): Promise<Category> {
  const { data, error } = await adminClient
    .from('categories')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await adminClient
    .from('categories')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deactivateCategory(id: string): Promise<void> {
  const { error } = await adminClient
    .from('categories')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
