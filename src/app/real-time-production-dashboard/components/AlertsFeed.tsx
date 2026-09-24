'use client';
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, UserPlus, Eye } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const initialAlerts = [
  {
    id: 'alert-001',
    severity: 'critical' as const,
    workpieceId: 'WP-2841',
    message: 'Surface crack detected — Confidence 87%. Awaiting rework assignment.',
    station: 'QA-1',
    time: '14:28',
    acknowledged: false,
  },
  {
    id: 'alert-002',
    severity: 'warning' as const,
    workpieceId: 'WP-2847',
    message: 'Sanding stage elapsed 24m over threshold. Worker M. Reyes flagged.',
    station: 'S-07',
    time: '14:22',
    acknowledged: false,
  },
  {
    id: 'alert-003',
    severity: 'warning' as const,
    workpieceId: 'WP-2848',
    message: 'Finishing stage nearing time threshold (52m of 50m limit).',
    station: 'S-03',
    time: '14:19',
    acknowledged: false,
  },
  {
    id: 'alert-004',
    severity: 'info' as const,
    workpieceId: 'WP-2835',
    message: 'QA inspection passed. Ready for final packaging.',
    station: 'QA-1',
    time: '14:11',
    acknowledged: true,
  },
  {
    id: 'alert-005',
    severity: 'critical' as const,
    workpieceId: 'WP-2839',
    message: 'Rework assigned — joint misalignment. Due by 16:00.',
    station: 'RW-1',
    time: '13:58',
    acknowledged: true,
  },
  {
    id: 'alert-006',
    severity: 'warning' as const,
    workpieceId: 'WP-2853',
    message: 'Sanding stage 7m over threshold. Station S-05 bottleneck.',
    station: 'S-05',
    time: '13:44',
    acknowledged: false,
  },
];

const staffList = ['M. Reyes', 'J. Torres', 'D. Kim', 'R. Lopez', 'P. Vargas'];

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10 border-danger/20', dot: 'bg-danger' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10 border-warning/20', dot: 'bg-warning' },
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10 border-info/20', dot: 'bg-info' },
};

export default function AlertsFeed() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [viewModal, setViewModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function acknowledge(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
    showToast('Alert acknowledged');
  }

  function dismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function confirmAssign() {
    if (!selectedStaff || !assignModal) return;
    const alert = alerts.find((a) => a.id === assignModal);
    setAlerts((prev) => prev.map((a) => a.id === assignModal ? { ...a, acknowledged: true } : a));
    showToast(`${alert?.workpieceId} assigned to ${selectedStaff}`);
    setAssignModal(null);
    setSelectedStaff('');
  }

  const displayed = filter === 'unread' ? alerts.filter((a) => !a.acknowledged) : alerts;
  const unreadCount = alerts.filter((a) => !a.acknowledged).length;
  const viewAlert = alerts.find((a) => a.id === viewModal);

  return (
    <div className="card-dark p-4 h-full flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl animate-fade-in"
             style={{ background: '#22C55E', color: '#FFFFFF' }}>
          <CheckCircle2 size={15} />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
          {unreadCount > 0 && (
            <span className="badge status-danger">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={`alert-filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                filter === f ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 size={28} className="text-success mb-2" />
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground mt-0.5">No unacknowledged alerts</p>
          </div>
        )}

        {displayed.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;

          return (
            <div
              key={alert.id}
              className={`rounded-xl border p-3 transition-all ${cfg.bg} ${
                alert.acknowledged ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: alert.severity === 'critical' ? 'rgba(239,68,68,0.2)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)' }}
                >
                  <Icon size={11} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold text-foreground">{alert.workpieceId}</span>
                    <span className="text-2xs text-muted-foreground">· {alert.station}</span>
                    <span className="text-2xs text-muted-foreground ml-auto">{alert.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>

                  {!alert.acknowledged && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => acknowledge(alert.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
                      >
                        <CheckCircle2 size={10} /> Ack
                      </button>
                      <button
                        onClick={() => { setAssignModal(alert.id); setSelectedStaff(''); }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-xs text-accent hover:bg-primary/30 transition-all active:scale-95"
                      >
                        <UserPlus size={10} /> Assign
                      </button>
                      <button
                        onClick={() => setViewModal(alert.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-muted/30 text-xs text-muted-foreground hover:text-foreground transition-all active:scale-95"
                      >
                        <Eye size={10} /> View
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismiss(alert.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Dismiss alert"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <button
          onClick={() => setFilter('all')}
          className="w-full text-xs text-primary hover:text-accent transition-colors font-medium py-1"
        >
          View full alert log →
        </button>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setAssignModal(null)}
        >
          <div
            className="card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-base font-bold text-foreground">
                Assign — {alerts.find((a) => a.id === assignModal)?.workpieceId}
              </h4>
              <button onClick={() => setAssignModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Select a staff member to handle this alert:</p>
            <div className="space-y-2 mb-4">
              {staffList.map((staff) => (
                <button
                  key={staff}
                  onClick={() => setSelectedStaff(staff)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    selectedStaff === staff
                      ? 'border-primary/50 bg-primary/10 text-accent' :'border-border bg-muted/20 text-foreground hover:bg-muted/40'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-accent">
                    {staff.split(' ').map((n) => n[0]).join('')}
                  </div>
                  {staff}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmAssign}
                disabled={!selectedStaff}
                className="btn-primary flex-1 text-sm disabled:opacity-50"
              >
                Confirm Assignment
              </button>
              <button onClick={() => setAssignModal(null)} className="btn-secondary text-sm px-4">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setViewModal(null)}
        >
          <div
            className="card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-base font-bold text-foreground">Alert Detail</h4>
              <button onClick={() => setViewModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Workpiece</span>
                <span className="text-xs font-bold text-foreground">{viewAlert.workpieceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Station</span>
                <span className="text-xs font-semibold text-foreground">{viewAlert.station}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Severity</span>
                <span className={`text-xs font-semibold capitalize ${severityConfig[viewAlert.severity].color}`}>
                  {viewAlert.severity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Time</span>
                <span className="text-xs font-semibold text-foreground">{viewAlert.time}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">{viewAlert.message}</p>
              </div>
            </div>
            <button onClick={() => setViewModal(null)} className="btn-secondary w-full text-sm mt-4">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}