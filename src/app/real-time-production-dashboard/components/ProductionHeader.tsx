'use client';
import React, { useState } from 'react';
import { RefreshCw, Calendar, ChevronDown, Download, CheckCircle2 } from 'lucide-react';

const shifts = ['Morning (06:00–14:00)', 'Afternoon (14:00–22:00)', 'Night (22:00–06:00)'];
const dateFilters = ['Today', 'Yesterday', 'Last 7 days', 'This month'];

export default function ProductionHeader() {
  const [shift, setShift] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }

  function handleExport() {
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2000);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Production Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${refreshing ? 'bg-warning animate-pulse' : 'bg-success animate-pulse-subtle'} inline-block`} />
          {refreshing ? 'Refreshing...' : 'Live · Last updated 14:36:03 · Mon 11 May 2026'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date Filter */}
        <div className="relative">
          <button
            onClick={() => { setDateOpen(!dateOpen); setShiftOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
          >
            <Calendar size={14} />
            {dateFilters?.[dateFilter]}
            <ChevronDown size={13} />
          </button>
          {dateOpen && (
            <div className="absolute right-0 top-10 w-44 card-dark shadow-xl z-40 rounded-xl overflow-hidden">
              {dateFilters?.map((d, i) => (
                <button
                  key={`date-${i}`}
                  onClick={() => { setDateFilter(i); setDateOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    i === dateFilter ? 'bg-primary/20 text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Shift Selector */}
        <div className="relative">
          <button
            onClick={() => { setShiftOpen(!shiftOpen); setDateOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
          >
            {shifts?.[shift]?.split(' ')?.[0]}
            <ChevronDown size={13} />
          </button>
          {shiftOpen && (
            <div className="absolute right-0 top-10 w-56 card-dark shadow-xl z-40 rounded-xl overflow-hidden">
              {shifts?.map((s, i) => (
                <button
                  key={`shift-${i}`}
                  onClick={() => { setShift(i); setShiftOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    i === shift ? 'bg-primary/20 text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:text-foreground transition-all active:scale-95 disabled:opacity-70"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-sm text-accent hover:bg-primary/30 transition-all active:scale-95"
        >
          {exportDone ? <CheckCircle2 size={14} /> : <Download size={14} />}
          {exportDone ? 'Exported!' : 'Export Report'}
        </button>
      </div>
    </div>
  );
}