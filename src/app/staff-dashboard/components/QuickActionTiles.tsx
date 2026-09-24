'use client';
import React, { useState } from 'react';
import { Play, Camera, Image, HelpCircle, ClipboardCheck, ChevronRight, CheckCircle2, X } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface ModalContent {
  title: string;
  body: string;
}

const actions = [
  {
    id: 'action-next-task',
    icon: Play,
    label: 'Start Next Task',
    desc: 'WP-2851 · Assembly',
    color: 'text-success',
    bg: 'bg-muted/20 border-border hover:bg-muted/40',
    modal: { title: 'Starting WP-2851', body: 'Task WP-2851 (Walnut Bookshelf Unit · Assembly) has been started. Timer is now running.' },
  },
  {
    id: 'action-camera',
    icon: Camera,
    label: 'Camera Inspect',
    desc: 'AI defect detection',
    color: 'text-accent',
    bg: 'bg-muted/20 border-border hover:bg-muted/40',
    modal: { title: 'Camera Inspect', body: 'Opening AI camera interface for WP-2847. YOLOv8 defect detection is active. Point camera at the workpiece surface.' },
  },
  {
    id: 'action-gallery',
    icon: Image,
    label: 'Cloud Gallery',
    desc: '24 photos archived',
    color: 'text-info',
    bg: 'bg-muted/20 border-border hover:bg-muted/40',
    modal: { title: 'Cloud Gallery', body: '24 inspection photos archived for your assigned workpieces. Photos are synced and available for QA review.' },
  },
  {
    id: 'action-qa',
    icon: ClipboardCheck,
    label: 'Open QA Form',
    desc: 'WP-2847 pending',
    color: 'text-warning',
    bg: 'bg-muted/20 border-border hover:bg-muted/40',
    modal: { title: 'QA Checklist — WP-2847', body: 'Opening QA checklist for WP-2847 (Oak Dining Table · Sanding stage). 3 of 6 checks completed.' },
  },
  {
    id: 'action-help',
    icon: HelpCircle,
    label: 'Request Help',
    desc: 'Notify supervisor',
    color: 'text-muted-foreground',
    bg: 'bg-muted/20 border-border hover:bg-muted/40',
    modal: { title: 'Help Requested', body: 'Supervisor S. Kapoor has been notified. Expected response within 5 minutes. Your current task WP-2847 has been flagged.' },
  },
];

export default function QuickActionTiles() {
  const [loading, setLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalContent | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function handleAction(id: string, modalContent: ModalContent) {
    setLoading(id);
    setTimeout(() => {
      setLoading(null);
      setDone(id);
      setModal(modalContent);
      setTimeout(() => setDone(null), 2000);
    }, 900);
  }

  return (
    <div className="card-dark p-5 h-full">
      <h3 className="mb-4 text-base font-semibold text-foreground">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const isLoading = loading === action.id;
          const isDone = done === action.id;
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action.id, action.modal)}
              disabled={isLoading}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-150 active:scale-95 disabled:opacity-70 ${action.bg}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <Icon size={16} className={action.color} />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-foreground leading-none">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Action Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm animate-fade-in rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-purple-500/20 dark:bg-slate-950/95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{modal.title}</h4>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                title="Close action dialog"
                aria-label="Close action dialog"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{modal.body}</p>
            <button
              onClick={() => setModal(null)}
              className="btn-primary w-full mt-4 text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}