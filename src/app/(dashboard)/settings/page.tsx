import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { can } from '@/lib/auth/permissions';
import SettingsClient from './SettingsClient';

// Settings (categories, cron trigger, backup) is admin-only. Enforced here
// server-side in addition to the API gates and the hidden sidebar link.
export default function SettingsPage() {
  if (!can(headers().get('x-user-role'), 'SETTINGS')) redirect('/');
  return <SettingsClient />;
}
