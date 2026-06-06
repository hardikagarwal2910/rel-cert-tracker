import { headers } from 'next/headers';
import { can } from '@/lib/auth/permissions';
import BuyerActivityClient from './BuyerActivityClient';

export default function BuyerActivityPage() {
  const allowed = can(headers().get('x-user-role'), 'MANAGE_BUYERS');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>Buyer Activity</h1>
      {!allowed ? (
        <p className="text-sm text-gray-500">This area is available to administrators and managers only.</p>
      ) : (
        <BuyerActivityClient />
      )}
    </div>
  );
}
