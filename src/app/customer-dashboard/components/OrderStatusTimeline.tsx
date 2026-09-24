'use client';
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Lock, Clock, ChevronDown, ChevronUp, Hash } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OrderStatusTimelineProps {
  order?: any;
}

const STAGE_ORDER = ['cutting', 'assembly', 'sanding', 'staining', 'finishing', 'quality_check', 'shipping'];

const STAGE_LABELS: Record<string, string> = {
  cutting: 'Cutting',
  assembly: 'Assembly',
  sanding: 'Sanding',
  staining: 'Staining',
  finishing: 'Finishing',
  quality_check: 'Quality Check',
  shipping: 'Ready to Ship',
};

const EXTENDED_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  designing: 'Designing',
  material_preparation: 'Material Preparation',
  cutting: 'Cutting',
  assembly: 'Assembly',
  sanding: 'Sanding',
  finishing: 'Finishing',
  quality_inspection: 'Quality Inspection',
  ready_for_delivery: 'Ready for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  in_production: 'In Production',
};

const stagePalette: Record<string, { text: string; badge: string; track: string; icon: string }> = {
  complete: {
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    track: 'bg-emerald-500/40',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  active: {
    text: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-500/30',
    track: 'bg-gradient-to-b from-purple-500 to-violet-500',
    icon: 'text-purple-700 dark:text-purple-300',
  },
  pending: {
    text: 'text-muted-foreground',
    badge: 'bg-slate-100 text-muted-foreground border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border',
    track: 'bg-slate-300/40 dark:bg-white/10',
    icon: 'text-muted-foreground',
  },
  locked: {
    text: 'text-muted-foreground',
    badge: 'bg-slate-50 text-muted-foreground border-slate-200 dark:bg-muted/80 dark:text-muted-foreground dark:border-border',
    track: 'bg-slate-200 dark:bg-white/8',
    icon: 'text-muted-foreground',
  },
};

export default function OrderStatusTimeline({ order }: OrderStatusTimelineProps) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!order?.id) return;
    const fetchStages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('production_stages')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      setStages(data || []);
      setLoading(false);
    };
    fetchStages();
  }, [order?.id, supabase]);

  const currentStageIndex = STAGE_ORDER.indexOf(order?.current_stage || 'cutting');
  const completionPct = order?.completion_pct || Math.round(((currentStageIndex + 1) / STAGE_ORDER.length) * 100);

  const getStageStatus = (stageName: string, idx: number) => {
    if (idx < currentStageIndex) return 'complete';
    if (idx === currentStageIndex) return 'active';
    if (idx === currentStageIndex + 1) return 'pending';
    return 'locked';
  };

  const getStageData = (stageName: string) => {
    return stages.find((s) => s.stage_name === stageName);
  };

  const extendedStatus = order?.extended_status || order?.status || 'pending';
  const extendedStatusLabel = EXTENDED_STATUS_LABELS[extendedStatus] || extendedStatus;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Order Summary Card */}
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-muted dark:bg-muted/80">
          <span className="text-2xl">🪑</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{order?.product_name || 'Your Order'}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Order #{order?.order_ref} · Placed {order?.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</p>
          
          {/* Queue Position & Status */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {order?.queue_position && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200">
                <Hash size={10} />
                Queue Position: {order.queue_position}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              {extendedStatusLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-2 overflow-hidden rounded-full border border-border bg-muted p-0.5">
              <div className="flex h-full gap-0.5">
                {Array.from({ length: 20 }).map((_, index) => {
                  const filledCount = Math.max(1, Math.round(completionPct / 5));
                  const filled = index < filledCount;
                  return <span key={`progress-${index}`} className={`flex-1 rounded-full ${filled ? 'bg-gradient-to-r from-purple-600 to-violet-500 dark:from-purple-500 dark:to-violet-400' : 'bg-slate-200 dark:bg-white/10'}`} />;
                })}
              </div>
            </div>
            <span className="whitespace-nowrap text-xs font-bold text-slate-600 dark:text-slate-300">{completionPct}% complete</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">Expected Delivery</p>
          <p className="text-base font-bold text-slate-900 dark:text-white">{order?.due_date || 'TBD'}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors">
        <h3 className="mb-5 text-base font-semibold text-foreground">Production Timeline</h3>
        <div className="space-y-0">
          {STAGE_ORDER.map((stageName, idx) => {
            const status = getStageStatus(stageName, idx);
            const stageData = getStageData(stageName);
            const isLast = idx === STAGE_ORDER.length - 1;
            const isExpanded = expanded === stageName;
            const hasDetails = stageData || status === 'active';

            return (
              <div key={stageName} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border ${
                      status === 'complete'
                        ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40'
                        : status === 'active' ?'bg-purple-50 border-purple-300 dark:bg-purple-500/15 dark:border-purple-500/40'
                          : status === 'pending' ?'bg-slate-100 border-slate-200 dark:bg-[#343434] dark:border-[#444444]' :'bg-slate-50 border-slate-200 dark:bg-[#2f2f2f] dark:border-[#3f3f3f]'
                    }`}
                  >
                    {status === 'complete' ? (
                      <CheckCircle2 size={18} className={stagePalette.complete.icon} />
                    ) : status === 'active' ? (
                      <Loader2 size={16} className="animate-spin text-purple-700 dark:text-purple-300" />
                    ) : status === 'pending' ? (
                      <Clock size={15} className="text-slate-500 dark:text-slate-200" />
                    ) : (
                      <Lock size={13} className="text-slate-500 dark:text-slate-200" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`my-1 min-h-[24px] w-0.5 ${status === 'complete' ? 'bg-emerald-400/40' : status === 'active' ? 'bg-gradient-to-b from-purple-500 to-violet-500' : 'bg-slate-200 dark:bg-border'}`}
                    />
                  )}
                </div>

                <div className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''}`}>
                  <button
                    className="w-full text-left"
                    onClick={() => hasDetails && setExpanded(isExpanded ? null : stageName)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-sm font-semibold ${stagePalette[status as keyof typeof stagePalette].text}`}>
                          {STAGE_LABELS[stageName]}
                        </span>
                        {status === 'active' && (
                          <span className="ml-2 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200">
                            In Progress
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {stageData?.completed_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(stageData.completed_at).toLocaleDateString()}
                          </span>
                        )}
                        {hasDetails && (isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />)}
                      </div>
                    </div>
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="mt-2 animate-fade-in space-y-1.5 rounded-xl border border-border bg-muted p-3 dark:bg-muted/80">
                      {stageData?.started_at && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-slate-900 dark:text-white">Started:</span>{' '}
                          {new Date(stageData.started_at).toLocaleString()}
                        </p>
                      )}
                      {stageData?.duration_minutes && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-slate-900 dark:text-white">Duration:</span> {stageData.duration_minutes}m
                        </p>
                      )}
                      {stageData?.notes && (
                        <p className="text-xs text-muted-foreground">{stageData.notes}</p>
                      )}
                      {status === 'active' && !stageData && (
                        <p className="text-xs text-purple-700 dark:text-purple-300">Currently in progress — our team is working on your order.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
