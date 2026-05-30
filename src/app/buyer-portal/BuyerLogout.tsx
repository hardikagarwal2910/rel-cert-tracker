'use client';

import { useRouter } from 'next/navigation';

export default function BuyerLogout() {
  const router = useRouter();
  const logout = async () => {
    await fetch('/api/buyer-auth/logout', { method: 'POST' });
    router.push('/buyer/login');
    router.refresh();
  };
  return (
    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
      Sign out
    </button>
  );
}
