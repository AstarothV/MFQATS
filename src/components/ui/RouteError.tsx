'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Rendered by each dashboard group's error.tsx, inside the persistent shell,
// so a crashing page never takes the sidebar down with it.
export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="card-dark mx-auto mt-10 max-w-lg rounded-3xl p-8 text-center">
      <AlertTriangle size={28} className="mx-auto mb-3 text-warning" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-foreground">Unable to load this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong while loading this page. Your data has not been changed.
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn-primary mt-6 inline-flex items-center gap-2"
      >
        <RotateCcw size={15} aria-hidden="true" /> Try again
      </button>
    </div>
  );
}
