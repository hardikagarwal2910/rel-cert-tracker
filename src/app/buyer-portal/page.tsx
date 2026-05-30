import { redirect } from 'next/navigation';

// The buyer portal landing — send buyers straight to their certificates.
export default function BuyerPortalIndex() {
  redirect('/buyer-portal/certificates');
}
