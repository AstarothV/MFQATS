'use client';
import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function ProductionHeader({ updated, onRefresh }: { updated: Date | null; onRefresh: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="page-title">Inspection Progress</h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-subtle inline-block" />
          {updated
            ? `Live · updated ${updated.toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : 'Loading…'}
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 self-start px-3 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition active:scale-95 sm:self-auto"
      >
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  );
}
