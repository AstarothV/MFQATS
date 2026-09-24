'use client';
import React, { useState } from 'react';
import { CheckCircle2, Circle, Loader2, Lock, ChevronRight, X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const stages = [
  { id: 'stage-cutting', name: 'Cutting', status: 'complete', time: '38m', staff: 'MR' },
  { id: 'stage-assembly', name: 'Assembly', status: 'complete', time: '1h 12m', staff: 'MR' },
  { id: 'stage-sanding', name: 'Sanding', status: 'active', time: '1h 24m', staff: 'MR' },
  { id: 'stage-finishing', name: 'Finishing', status: 'pending', time: '~50m est', staff: '—' },
  { id: 'stage-qa', name: 'QA Check', status: 'locked', time: '—', staff: '—' },
  { id: 'stage-ship', name: 'Ready to Ship', status: 'locked', time: '—', staff: '—' },
];

const checklist = [
  { id: 'check-grit-start', label: 'Start with 80-grit sandpaper', done: true },
  { id: 'check-grain', label: 'Sand along the wood grain direction', done: true },
  { id: 'check-grit-120', label: 'Progress to 120-grit, check surface', done: true },
  { id: 'check-grit-220', label: 'Final pass with 220-grit', done: false },
  { id: 'check-dust', label: 'Vacuum dust and wipe with tack cloth', done: false },
  { id: 'check-qa-photo', label: 'Take QA inspection photo', done: false },
];

export default function StageProgressPanel() {
  const [checks, setChecks] = useState(checklist);
  const [modal, setModal] = useState<'qa' | 'note' | null>(null);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  function toggleCheck(id: string) {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  }

  function saveNote() {
    setNoteSaved(true);
    setTimeout(() => {
      setNoteSaved(false);
      setModal(null);
      setNote('');
    }, 1200);
  }

  const completedCount = checks.filter((c) => c.done).length;
  const pct = Math.round((completedCount / checks.length) * 100);
  const allDone = completedCount === checks.length;

  return (
    <div className="card-dark p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">WP-2847 · Oak Dining Table</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Order #ORD-4421 · Priority: Urgent</p>
        </div>
        <StatusBadge variant="danger" label="Urgent" dot />
      </div>

      {/* Stage Progress Bar */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center min-w-[64px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                    stage.status === 'complete'
                      ? 'bg-success/20 text-success border border-success/40'
                      : stage.status === 'active' ?'bg-primary text-primary-foreground'
                      : stage.status === 'pending' ?'bg-muted text-muted-foreground border border-border' :'bg-muted/50 text-muted-foreground/50 border border-border/50'
                  }`}
                >
                  {stage.status === 'complete' ? (
                    <CheckCircle2 size={14} />
                  ) : stage.status === 'active' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : stage.status === 'locked' ? (
                    <Lock size={12} />
                  ) : (
                    <Circle size={12} />
                  )}
                </div>
                <span
                  className={`text-2xs text-center leading-tight ${
                    stage.status === 'active' ?'text-accent font-semibold'
                      : stage.status === 'complete' ?'text-success' :'text-muted-foreground'
                  }`}
                >
                  {stage.name}
                </span>
                <span className="text-2xs text-muted-foreground/70">{stage.time}</span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 min-w-[12px] mt-[-14px] ${
                    stage.status === 'complete' ? 'bg-success/40' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Stage Checklist */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">Sanding Checklist</p>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{completedCount}/{checks.length}</span>
        </div>
      </div>

      <div className="space-y-2">
        {checks.map((check) => (
          <button
            key={check.id}
            onClick={() => toggleCheck(check.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left ${
              check.done
                ? 'bg-success/10 border-success/20 text-success' :'bg-muted/30 border-border text-foreground hover:bg-muted/60'
            }`}
          >
            {check.done ? (
              <CheckCircle2 size={15} className="shrink-0 text-success" />
            ) : (
              <Circle size={15} className="shrink-0 text-muted-foreground" />
            )}
            <span className={`text-sm ${check.done ? 'line-through text-muted-foreground' : ''}`}>
              {check.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setModal('qa')}
          className={`btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm ${allDone ? 'ring-2 ring-success/50' : ''}`}
        >
          {allDone ? <CheckCircle2 size={14} /> : <ChevronRight size={14} />}
          {allDone ? 'Submit QA' : 'Open QA Checklist'}
        </button>
        <button
          onClick={() => setModal('note')}
          className="btn-secondary text-sm px-3"
        >
          Log Note
        </button>
      </div>

      {/* QA Modal */}
      {modal === 'qa' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setModal(null)}
        >
          <div
            className="card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-base font-bold text-foreground">QA Checklist — WP-2847</h4>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {allDone
                ? 'All sanding checks complete. Ready to submit QA for WP-2847 (Oak Dining Table).'
                : `${completedCount} of ${checks.length} checks completed. Complete all items before submitting.`}
            </p>
            {allDone ? (
              <button
                onClick={() => setModal(null)}
                className="btn-primary w-full text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} /> Submit QA Pass
              </button>
            ) : (
              <button onClick={() => setModal(null)} className="btn-secondary w-full text-sm">
                Continue Checklist
              </button>
            )}
          </div>
        </div>
      )}

      {/* Note Modal */}
      {modal === 'note' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setModal(null)}
        >
          <div
            className="card-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-base font-bold text-foreground">Log Note — WP-2847</h4>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <textarea
              className="input-dark w-full resize-none text-sm"
              rows={4}
              placeholder="Add a note about this stage or workpiece..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={saveNote}
                disabled={!note.trim() || noteSaved}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {noteSaved ? <><CheckCircle2 size={14} /> Saved!</> : 'Save Note'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary text-sm px-4">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}