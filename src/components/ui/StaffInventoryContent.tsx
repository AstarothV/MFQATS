'use client';

import React, { useState } from 'react';
import { Search, Package, Eye, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const staffInventoryItems = [
  {
    id: 'MAT-1001',
    name: 'Oak Wood Planks',
    category: 'Wood',
    stockLevel: 245,
    unit: 'boards',
    location: 'Warehouse A-12',
    available: true,
  },
  {
    id: 'MAT-1002',
    name: 'Cherry Wood Veneer',
    category: 'Wood',
    stockLevel: 67,
    unit: 'sheets',
    location: 'Warehouse B-05',
    available: true,
  },
  {
    id: 'MAT-1003',
    name: 'Brass Hardware Kit',
    category: 'Hardware',
    stockLevel: 0,
    unit: 'kits',
    location: 'Warehouse C-08',
    available: false,
  },
  {
    id: 'MAT-1004',
    name: 'Wood Finish - Satin',
    category: 'Finishing',
    stockLevel: 89,
    unit: 'gallons',
    location: 'Warehouse D-03',
    available: true,
  },
  {
    id: 'MAT-1005',
    name: 'Maple Wood Boards',
    category: 'Wood',
    stockLevel: 156,
    unit: 'boards',
    location: 'Warehouse A-08',
    available: true,
  },
  {
    id: 'MAT-1006',
    name: 'Walnut Veneer',
    category: 'Wood',
    stockLevel: 23,
    unit: 'sheets',
    location: 'Warehouse B-12',
    available: true,
  },
];

const categories = ['All', 'Wood', 'Hardware', 'Finishing'];

export default function StaffInventoryContent() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredItems = staffInventoryItems?.filter(item => {
    const matchesSearch = item?.name?.toLowerCase()?.includes(search?.toLowerCase()) ||
                         item?.location?.toLowerCase()?.includes(search?.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item?.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pt-10 md:pt-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workshop Inventory</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Browse available materials and check stock levels for your current projects.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search materials"
            value={search}
            onChange={(e) => setSearch(e?.target?.value)}
            className="input-dark w-full pl-11"
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {categories?.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              selectedCategory === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredItems?.map((item) => (
          <div
            key={item?.id}
            className={`rounded-3xl border p-5 transition-all ${
              item?.available
                ? 'border-border bg-card hover:bg-muted/50' :'border-danger/30 bg-danger/5'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  item?.available ? 'bg-primary/10' : 'bg-danger/10'
                }`}>
                  <Package size={18} className={item?.available ? 'text-primary' : 'text-danger'} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{item?.name}</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.24em]">{item?.category}</p>
                </div>
              </div>
              {!item?.available && (
                <AlertTriangle size={16} className="text-danger mt-1" />
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stock Level</span>
                <span className="font-semibold text-foreground">
                  {item?.stockLevel} {item?.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-semibold text-foreground">{item?.location}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <StatusBadge
                variant={item?.available ? 'ok' : 'danger'}
                label={item?.available ? 'Available' : 'Out of Stock'}
              />
              <button
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  item?.available
                    ? 'bg-primary/20 text-primary hover:bg-primary/30' :'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
                disabled={!item?.available}
              >
                <Eye size={12} />
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Inventory Notes</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>• All materials are available for workshop use during business hours.</p>
          <p>• Contact inventory supervisor for special requests or bulk orders.</p>
          <p>• Report any damaged or incorrect stock levels immediately.</p>
          <p>• Safety equipment and tools are located in the designated areas.</p>
        </div>
      </div>
    </div>
  );
}