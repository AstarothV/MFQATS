'use client';
import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// PERT + WMA per stage, computed in the database (supabase/migrations/*_production_timeline_pert_wma.sql).
interface StageStat {
  status: string;
  samples: number;
  source: 'history' | 'default';
  optimistic_hours: number;
  most_likely_hours: number;
  pessimistic_hours: number;
  expected_hours: number;
  wma_hours: number | null;
}

const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const hrs = (h: number | null) => (h == null ? '—' : `${Number(h).toFixed(1)}h`);

export default function StageTimelinePanel() {
  const supabase = createClient();
  const [stats, setStats] = useState<StageStat[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('stage_timeline_stats').then(({ data, error }) => {
      if (error) setError(error.message);
      else setStats(data || []);
    });
  }, [supabase]);

  return (
    <div className="card-dark p-5">
      <div className="flex items-center gap-2 mb-1">
        <Timer size={16} className="text-primary" />
        <h2 className="text-base font-semibold text-foreground">Production Timeline (PERT + WMA)</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Te = (O + 4M + P) / 6 per stage. WMA weighs the latest 5 cycles most, showing whether the stage is currently running faster or slower than expected.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Cycles</th>
              <th className="py-2 pr-3">O</th>
              <th className="py-2 pr-3">M</th>
              <th className="py-2 pr-3">P</th>
              <th className="py-2 pr-3">Te (PERT)</th>
              <th className="py-2 pr-3">WMA</th>
              <th className="py-2">Pace</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const pace = s.wma_hours == null ? null : s.wma_hours <= s.expected_hours ? 'Faster' : 'Slower';
              return (
                <tr key={s.status} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {label(s.status)}
                    {s.source === 'default' && (
                      <span className="ml-2 text-[10px] text-muted-foreground" title="Fewer than 3 finished cycles; using the starting estimate">estimate</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{s.samples}</td>
                  <td className="py-2 pr-3 tabular-nums">{hrs(s.optimistic_hours)}</td>
                  <td className="py-2 pr-3 tabular-nums">{hrs(s.most_likely_hours)}</td>
                  <td className="py-2 pr-3 tabular-nums">{hrs(s.pessimistic_hours)}</td>
                  <td className="py-2 pr-3 tabular-nums font-semibold text-foreground">{hrs(s.expected_hours)}</td>
                  <td className="py-2 pr-3 tabular-nums">{hrs(s.wma_hours)}</td>
                  <td className={`py-2 font-semibold ${pace === 'Faster' ? 'text-success' : pace === 'Slower' ? 'text-warning' : 'text-muted-foreground'}`}>
                    {pace ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
