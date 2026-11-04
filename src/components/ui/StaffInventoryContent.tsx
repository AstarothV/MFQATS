'use client';

import React, { useEffect, useState } from 'react';
import { Search, Package, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';

interface Item {
  id: string;
  item_ref: string;
  name: string;
  category: string;
  stock_level: number;
  min_stock: number;
  unit: string;
  location: string | null;
}

// The same stock the admin manages in Inventory, read-only for staff.
export default function StaffInventoryContent() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    createClient().from('inventory').select('id, item_ref, name, category, stock_level, min_stock, unit, location')
      .eq('is_active', true).order('name').then(({ data }) => setItems((data ?? []) as Item[]));
  }, []);

  const categories = ['All', ...new Set((items ?? []).map((i) => i.category).filter(Boolean))];
  const q = search.toLowerCase();
  const filteredItems = (items ?? []).filter((item) =>
    (item.name.toLowerCase().includes(q) || (item.location ?? '').toLowerCase().includes(q)) &&
    (selectedCategory === 'All' || item.category === selectedCategory));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workshop Inventory</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Materials in stock. The admin keeps these numbers up to date in Inventory.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search materials"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark w-full pl-11"
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              selectedCategory === category ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filteredItems.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {items.length ? 'No materials match.' : 'No materials yet. The admin adds them in Inventory.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const out = item.stock_level <= 0;
            const low = !out && item.stock_level <= item.min_stock;
            return (
              <div key={item.id} className={`rounded-3xl border p-5 transition ${out ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card hover:bg-muted/50'}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${out ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                      <Package size={18} className={out ? 'text-danger' : 'text-primary'} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-[0.24em]">{item.category}</p>
                    </div>
                  </div>
                  {(out || low) && <AlertTriangle size={16} className={`mt-1 ${out ? 'text-danger' : 'text-warning'}`} />}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Level</span>
                    <span className="font-semibold text-foreground">{item.stock_level} {item.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-semibold text-foreground">{item.location || '—'}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <StatusBadge variant={out ? 'danger' : low ? 'warning' : 'ok'} label={out ? 'Out of Stock' : low ? 'Low Stock' : 'Available'} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
