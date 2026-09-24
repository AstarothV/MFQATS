import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Camera } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import Icon from '@/components/ui/AppIcon';


const feedItems = [
  {
    id: 'qa-feed-001',
    type: 'pass',
    workpieceId: 'WP-2835',
    stage: 'Finishing',
    inspector: 'M. Reyes',
    time: '09:14 AM',
    note: 'Surface smooth, no visible defects. Passed all 6 checks.',
    hasPhoto: true,
  },
  {
    id: 'qa-feed-002',
    type: 'fail',
    workpieceId: 'WP-2829',
    stage: 'Assembly',
    inspector: 'M. Reyes',
    time: 'Yesterday 04:52 PM',
    note: 'Joint misalignment at rear-left corner. Sent to rework.',
    hasPhoto: true,
  },
  {
    id: 'qa-feed-003',
    type: 'defect',
    workpieceId: 'WP-2841',
    stage: 'Sanding',
    inspector: 'Auto (YOLOv8)',
    time: 'Yesterday 02:30 PM',
    note: 'Surface crack detected — confidence 87%. Flagged for supervisor review.',
    hasPhoto: true,
  },
  {
    id: 'qa-feed-004',
    type: 'pass',
    workpieceId: 'WP-2820',
    stage: 'Cutting',
    inspector: 'M. Reyes',
    time: 'Mon 11:05 AM',
    note: 'Dimensions within ±0.5mm tolerance. All cuts clean.',
    hasPhoto: false,
  },
  {
    id: 'qa-feed-005',
    type: 'pass',
    workpieceId: 'WP-2815',
    stage: 'QA Check',
    inspector: 'S. Kapoor',
    time: 'Mon 09:38 AM',
    note: 'Final inspection passed. Approved for shipping.',
    hasPhoto: true,
  },
];

const typeConfig = {
  pass: { icon: CheckCircle2, color: 'text-success', badge: 'ok' as const, label: 'Passed' },
  fail: { icon: XCircle, color: 'text-danger', badge: 'danger' as const, label: 'Failed' },
  defect: { icon: AlertTriangle, color: 'text-warning', badge: 'warning' as const, label: 'Defect' },
};

export default function RecentQAFeed() {
  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Recent QA Activity</h3>
        <button className="text-xs text-primary hover:text-accent transition-colors font-medium">
          View all
        </button>
      </div>

      <div className="space-y-3">
        {feedItems.map((item) => {
          const cfg = typeConfig[item.type as keyof typeof typeConfig];
          const Icon = cfg.icon;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border hover:bg-muted/40 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-current/10 mt-0.5`}
                   style={{ backgroundColor: item.type === 'pass' ? 'rgba(34,197,94,0.12)' : item.type === 'fail' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>
                <Icon size={15} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{item.workpieceId}</span>
                  <StatusBadge variant={cfg.badge} label={cfg.label} />
                  <span className="text-xs text-muted-foreground">{item.stage}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.note}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-2xs text-muted-foreground/70 flex items-center gap-1">
                    <Clock size={10} /> {item.time}
                  </span>
                  <span className="text-2xs text-muted-foreground/70">· {item.inspector}</span>
                  {item.hasPhoto && (
                    <span className="text-2xs text-accent flex items-center gap-1">
                      <Camera size={10} /> Photo
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}