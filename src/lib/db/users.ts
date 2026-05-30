import { adminClient } from '@/lib/supabase/admin';
import bcrypt from 'bcryptjs';
import type { User } from '@/types/database';
import type { UserInput } from '@/types';

export async function getUsers(): Promise<User[]> {
  const { data, error } = await adminClient.from('users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as User[]) ?? [];
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await adminClient.from('users').select('*').eq('id', id).single();
  if (error) return null;
  return data as User | null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { data, error } = await adminClient
    .from('users')
    .select('*')
    .eq('username', username)
    .single();
  if (error) return null;
  return data as User | null;
}

export async function createUser(input: UserInput): Promise<User> {
  if (!input.password) throw new Error('Password is required');
  const password_hash = await bcrypt.hash(input.password, 12);
  const { data, error } = await adminClient
    .from('users')
    .insert({ ...input, password_hash, password: undefined })
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function updateUser(id: string, input: Partial<UserInput>): Promise<User> {
  const update: Record<string, unknown> = { ...input };
  if (input.password) {
    update.password_hash = await bcrypt.hash(input.password, 12);
    delete update.password;
  }
  const { data, error } = await adminClient
    .from('users')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function deactivateUser(id: string): Promise<void> {
  const { error } = await adminClient
    .from('users')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function reactivateUser(id: string): Promise<void> {
  const { error } = await adminClient
    .from('users')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateLastLogin(id: string): Promise<void> {
  await adminClient
    .from('users')
    .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function setTwoFactor(userId: string, enabled: boolean): Promise<void> {
  const { error } = await adminClient
    .from('users')
    .update({ two_factor_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
