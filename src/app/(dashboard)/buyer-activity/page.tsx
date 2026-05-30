import { headers } from 'next/headers';
import BuyerActivityClient from './BuyerActivityClient';

export default function BuyerActivityPage() {
  const role = headers().get('x-user-role');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>Buyer Activity</h1>
      {role !== 'admin' ? (
        <p className="text-sm text-gray-500">This area is available to administrators only.</p>
      ) : (
        <BuyerActivityClient />
      )}
    </div>
  );
}
