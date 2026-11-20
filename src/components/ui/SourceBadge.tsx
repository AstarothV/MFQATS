import React from 'react';
import { Globe, Store } from 'lucide-react';

/** Where an order came from (orders.order_source, migration 042): taken at the store, or placed on the website. */
export default function SourceBadge({ source, className = '' }: { source?: string | null; className?: string }) {
  const walkIn = source === 'walk_in';
  return (
    <span className={`badge inline-flex items-center gap-1 whitespace-nowrap ${walkIn ? 'status-warning' : 'status-info'} ${className}`}
      title={walkIn ? 'Taken at the store (walk-in)' : 'Placed on the website'}>
      {walkIn ? <Store size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}
      {walkIn ? 'Walk-in' : 'Online'}
    </span>
  );
}
