'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      // Clear supplier/buyer cookies + write the audit entry first.
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      // Invalidate the NextAuth session and redirect to /login.
      await signOut({ callbackUrl: '/login' });
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-gray-700 w-full text-left disabled:opacity-50"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
