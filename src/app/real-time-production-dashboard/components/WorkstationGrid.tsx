'use client';
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Loader2, Lock, Wrench, X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const workpieces = [
  { id: 'wp-2847', workpieceId: 'WP-2847', name: 'Oak Dining Table', stage: 'Sanding', staff: 'MR', elapsed: 84, threshold: 60, station: 'S-07', defect: false, status: 'warning' as const },
  { id: 'wp-2848', workpieceId: 'WP-2848', name: 'Walnut Dresser', stage: 'Finishing', staff: 'JT', elapsed: 52, threshold: 50, station: 'S-03', defect: false, status: 'warning' as const },
  { id: 'wp-2849', workpieceId: 'WP-2849', name: 'Pine Bed Frame', stage: 'Assembly', staff: 'DK', elapsed: 38, threshold: 90, station: 'S-01', defect: false, status: 'ok' as const },
  { id: 'wp-2850', workpieceId: 'WP-2850', name: 'Cherry Side Table', stage: 'Cutting', staff: 'RL', elapsed: 22, threshold: 35, station: 'S-02', defect: false, status: 'ok' as const },
  { id: 'wp-2851', workpieceId: 'WP-2851', name: 'Walnut Bookshelf', stage: 'Assembly', staff: 'MR', elapsed: 0, threshold: 90, station: 'S-07', defect: false, status: 'neutral' as const },
  { id: 'wp-2841', workpieceId: 'WP-2841', name: 'Maple Cabinet', stage: 'QA Check', staff: 'SK', elapsed: 18, threshold: 25, station: 'QA-1', defect: true, status: 'danger' as const },
  { id: 'wp-2835', workpieceId: 'WP-2835', name: 'Birch Nightstand', stage: 'QA Check', staff: 'SK', elapsed: 14, threshold: 25, station: 'QA-1', defect: false, status: 'ok' as const },
  { id: 'wp-2839', workpieceId: 'WP-2839', name: 'Cherry Side Table', stage: 'Rework', staff: 'JT', elapsed: 31, threshold: 45, station: 'RW-1', defect: true, status: 'danger' as const },
  { id: 'wp-2853', workpieceId: 'WP-2853', name: 'Teak Patio Chair', stage: 'Sanding', staff: 'DK', elapsed: 67, threshold: 60, station: 'S-05', defect: false, status: 'warning' as const },
  { id: 'wp-2854', workpieceId: 'WP-2854', name: 'Ash Writing Desk', stage: 'Finishing', staff: 'RL', elapsed: 41, threshold: 50, station: 'S-04', defect: false, status: 'ok' as const },
  { id: 'wp-2855', workpieceId: 'WP-2855', name: 'Bamboo Shelf Unit', stage: 'Cutting', staff: 'PV', elapsed: 15, threshold: 35, station: 'S-06', defect: false, status: 'ok' as const },
  { id: 'wp-2856', workpieceId: 'WP-2856', name: 'Maple Coffee Table', stage: 'Queued', staff: '—', elapsed: 0, threshold: 60, station: 'S-08', defect: false, status: 'neutral' as const },
];

const staffNames: Record<string, string> = {
  MR: 'M. Reyes', JT: 'J. Torres', DK: 'D. Kim', RL: 'R. Lopez', SK: 'S. Kapoor', PV: 'P. Vargas',
};

const statusBorderColor: Record<string, string> = {
  ok: 'border-success/30', warning: 'border-warning/40', danger: 'border-danger/40', neutral: 'border-border',
};
const statusBg: Record<string, string> = {
  ok: 'bg-success/5', warning: 'bg-warning/5', danger: 'bg-danger/8', neutral: '',
};
const stageTag: Record<string, string> = {
  Cutting: 'text-info', Assembly: 'text-warning', Sanding: 'text-accent',
  Finishing: 'text-success', 'QA Check': 'text-primary', Rework: 'text-danger', Queued: 'text-muted-foreground',
};

const pipelineStages = ['Cutting', 'Assembly', 'Sanding', 'Finishing', 'QA Check', 'Ready to Ship'];

const detailChecklistMap: Record<string, string[]> = {
  Sanding: [
    'Start with 80-grit sandpaper',
    'Sand along the wood grain direction',
    'Progress to 120-grit, check surface',
    'Final pass with 220-grit',
    'Vacuum dust and wipe with tack cloth',
    'Take QA inspection photo',
  ],
  Assembly: [
    'Confirm joinery alignment',
    'Tighten all fasteners',
    'Check frame squareness',
    'Log fitment notes for QA',
    'Clear station for next workpiece',
    'Hand off to sanding',
  ],
  Cutting: [
    'Verify cut list against order',
    'Inspect stock for defects',
    'Measure each cut twice',
    'Label finished parts',
    'Stack parts by order kit',
    'Move to assembly queue',
  ],
  Finishing: [
    'Inspect surface for dust',
    'Apply first finish coat',
    'Check even coverage',
    'Allow proper drying time',
    'Buff edges and corners',
    'Prepare for QA review',
  ],
  'QA Check': [
    'Inspect finish quality',
    'Confirm dimensions and fit',
    'Review customer spec sheet',
    'Capture approval photo',
    'Record pass or rework notes',
    'Release for shipment',
  ],
  Rework: [
    'Identify defect source',
    'Remove affected finish',
    'Repair surface inconsistency',
    'Recheck dimensions',
    'Reapply finish if needed',
    'Return to QA check',
  ],
  Queued: [
    'Confirm materials are ready',
    'Assign station and staff',
    'Review order priority',
    'Move into production queue',
  ],
};

const stageStepProgress: Record<string, number> = {
  Cutting: 1,
  Assembly: 2,
  Sanding: 3,
  Finishing: 4,
  'QA Check': 5,
  Rework: 2,
  Queued: 0,
};

const statusLabel: Record<string, string> = {
  ok: 'OK',
  warning: 'At Risk',
  danger: 'Critical',
  neutral: 'Queued',
};

const priorityLabel: Record<string, string> = {
  danger: 'Urgent',
  warning: 'High',
  ok: 'Normal',
  neutral: 'Normal',
};

function getChecklist(stage: string) {
  return detailChecklistMap[stage] || detailChecklistMap.Queued;
}

function getCompletedChecklistCount(stage: string) {
  return stage === 'Sanding' ? 3 : stage === 'Assembly' ? 2 : stage === 'Cutting' ? 1 : stage === 'Finishing' ? 4 : stage === 'QA Check' ? 5 : stage === 'Rework' ? 2 : 0;
}

function formatStageTime(stage: string, wp: typeof workpieces[number]) {
  if (stage === wp.stage) {
    return wp.elapsed > 0 ? `${wp.elapsed}m` : '—';
  }

  if (stage === 'Cutting') return '38m';
  if (stage === 'Assembly') return '1h 12m';
  if (stage === 'Sanding') return '1h 24m';
  if (stage === 'Finishing') return '~50m est';
  if (stage === 'QA Check') return '—';
  if (stage === 'Ready to Ship') return '—';
  return '—';
}

type FilterType = 'all' | 'warning' | 'danger' | 'ok';

export default function WorkstationGrid() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<string | null>(null);

  const filtered = filter === 'all' ? workpieces : workpieces.filter((w) => w.status === filter);
  const detailWp = workpieces.find((w) => w.id === detailModal);

  const counts = {
    all: workpieces.length,
    ok: workpieces.filter((w) => w.status === 'ok').length,
    warning: workpieces.filter((w) => w.status === 'warning').length,
    danger: workpieces.filter((w) => w.status === 'danger').length,
  };

  const filters: { key: FilterType; label: string; color: string }[] = [
    { key: 'all', label: `All (${counts.all})`, color: 'text-foreground' },
    { key: 'ok', label: `On Track (${counts.ok})`, color: 'text-success' },
    { key: 'warning', label: `At Risk (${counts.warning})`, color: 'text-warning' },
    { key: 'danger', label: `Critical (${counts.danger})`, color: 'text-danger' },
  ];

  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-base font-semibold text-foreground">WIP Overview — Active Workpieces</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={`filter-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key
                  ? 'bg-muted text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={f.color}>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-3">
        {filtered.map((wp) => {
          const isSelected = selected === wp.id;

          return (
            <div
              key={wp.id}
              onClick={() => setSelected(isSelected ? null : wp.id)}
              className={`rounded-xl border p-4 cursor-pointer transition-all duration-150 card-hover ${statusBorderColor[wp.status]} ${statusBg[wp.status]} ${
                isSelected ? 'ring-1 ring-primary/60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground">{wp.workpieceId}</span>
                    {wp.defect && <AlertTriangle size={12} className="text-danger shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{wp.name}</p>
                </div>
                <StatusBadge
                  variant={wp.status === 'neutral' ? 'neutral' : wp.status}
                  label={wp.status === 'neutral' ? 'Queued' : wp.status === 'ok' ? 'OK' : wp.status === 'warning' ? 'At Risk' : 'Critical'}
                />
              </div>

              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-semibold ${stageTag[wp.stage] || 'text-foreground'}`}>{wp.stage}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench size={10} /> {wp.station}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1.5">
                  {wp.staff !== '—' && (
                    <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                      <span className="text-2xs font-bold text-accent">{wp.staff}</span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {wp.staff !== '—' ? staffNames[wp.staff] || wp.staff : 'Unassigned'}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailModal(wp.id); }}
                  className="text-2xs text-primary hover:text-accent flex items-center gap-0.5 transition-colors"
                >
                  Detail <ChevronRight size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {detailWp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="card-dark rounded-2xl max-w-3xl w-full shadow-2xl animate-fade-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6">
              <div>
                <h4 className="text-lg font-bold text-foreground">{detailWp.workpieceId} · {detailWp.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Order #{`ORD-${detailWp.workpieceId.slice(-4)}`} · Priority: {priorityLabel[detailWp.status] || 'Normal'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge
                  variant={detailWp.status === 'neutral' ? 'neutral' : detailWp.status}
                  label={statusLabel[detailWp.status] || 'Active'}
                  dot
                />
                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Close workpiece details"
                  aria-label="Close workpiece details"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-center gap-2">
                {pipelineStages.map((stage, idx) => {
                  const currentIndex = pipelineStages.indexOf(detailWp.stage === 'Queued' ? 'Ready to Ship' : detailWp.stage);
                  const status = detailWp.stage === 'Queued'
                    ? 'locked'
                    : idx < currentIndex
                      ? 'complete'
                      : idx === currentIndex
                        ? 'active'
                        : idx === currentIndex + 1
                          ? 'pending'
                          : 'locked';
                  const isLast = idx === pipelineStages.length - 1;

                  return (
                    <React.Fragment key={stage}>
                      <div className="flex min-w-[68px] flex-col items-center text-center">
                        <div
                          className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                            status === 'complete'
                              ? 'border-success/40 bg-success/20 text-success'
                              : status === 'active'
                                ? 'border-primary/40 bg-primary text-primary-foreground'
                                : status === 'pending'
                                  ? 'border-border bg-muted text-muted-foreground'
                                  : 'border-border/70 bg-muted/50 text-muted-foreground/50'
                          }`}
                        >
                          {status === 'complete' ? (
                            <CheckCircle2 size={15} />
                          ) : status === 'active' ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : status === 'pending' ? (
                            <Circle size={12} />
                          ) : (
                            <Lock size={12} />
                          )}
                        </div>
                        <span className={`text-[11px] leading-tight ${status === 'active' ? 'text-accent font-semibold' : status === 'complete' ? 'text-success' : 'text-muted-foreground'}`}>
                          {stage}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 mt-0.5">{formatStageTime(stage, detailWp)}</span>
                      </div>
                      {!isLast && (
                        <div className={`mt-[-18px] h-0.5 min-w-[20px] flex-1 ${idx < stageStepProgress[detailWp.stage] ? 'bg-success/40' : 'bg-border'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">{detailWp.stage} Checklist</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full overflow-hidden bg-muted">
                      <div className="flex h-full gap-0.5 rounded-full bg-muted p-0.5">
                        {getChecklist(detailWp.stage).map((item, index) => {
                          const done = index < getCompletedChecklistCount(detailWp.stage);
                          return <span key={`${item}-segment`} className={`flex-1 rounded-full ${done ? 'bg-accent' : 'bg-border'}`} />;
                        })}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {getCompletedChecklistCount(detailWp.stage)}/{getChecklist(detailWp.stage).length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {getChecklist(detailWp.stage).map((item, index) => {
                    const done = index < getCompletedChecklistCount(detailWp.stage);
                    return (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${done ? 'border-success/20 bg-success/10 text-success' : 'border-border bg-muted/30 text-foreground'}`}
                      >
                        {done ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : <Circle size={15} className="shrink-0 text-muted-foreground" />}
                        <span className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border/60 p-6 pt-4">
              {detailWp.defect && (
                <button
                  onClick={() => setDetailModal(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-danger/20 text-danger text-sm font-semibold hover:bg-danger/30 transition-all active:scale-95"
                >
                  Flag Rework
                </button>
              )}
              <button onClick={() => setDetailModal(null)} className="btn-secondary flex-1 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}