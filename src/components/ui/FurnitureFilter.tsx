'use client';
import React from 'react';
import { furnitureCounts } from '@/lib/furniture';

type Item = { product_name?: string | null; product_category?: string | null };

/** "All furniture · Tables 4 · Chairs 1 …": narrows an order list to one kind of furniture. Hidden with only one kind. */
export default function FurnitureFilter({ items, value, onChange }: { items: Item[]; value: string; onChange: (category: string) => void }) {
  const counts = furnitureCounts(items);
  if (counts.length < 2) return null;
  const chip = (key: string, label: string, n: number) => (
    <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={value === key}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${value === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
      {label} <span className="ml-0.5 opacity-70">{n}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by furniture">
      {chip('All', 'All furniture', items.length)}
      {counts.map(([category, n]) => chip(category, category, n))}
    </div>
  );
}
