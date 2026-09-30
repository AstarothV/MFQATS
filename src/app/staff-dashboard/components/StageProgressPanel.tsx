'use client';
import React, { useState } from 'react';
import { CheckCircle2, Circle, Loader2, Lock, ChevronRight, X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const stages = [
  { id: 'stage-upload', name: 'Upload', status: 'complete', time: '6m', staff: 'MR' },
  { id: 'stage-reconstruction', name: '3D Reconstruction', status: 'complete', time: '24m', staff: 'MR' },
  { id: 'stage-detect', name: 'Detect Defects', status: 'active', time: '4m', staff: 'MR' },
  { id: 'stage-results', name: 'Results', status: 'pending', time: '~10m est', staff: '—' },
  { id: 'stage-recommendation', name: 'Recommendation', status: 'locked', time: '—', staff: '—' },
];

const checklist = [
  { id: 'check-order', label: 'Select the order being inspected', done: true },
  { id: 'check-surface', label: 'Wipe sawdust off the surface and check the lighting', done: true },
  { id: 'check-image', label: 'Capture or upload the inspection image', done: true },
  { id: 'check-detect', label: 'Run defect detection', done: false },
  { id: 'check-review', label: 'Review the detected defects and confidence scores', done: false },
  { id: 'check-save', label: 'Save the scan result', done: false },
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
                  className={`text-2xs text-center leading-tight whitespace-nowrap ${
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
        <p className="text-sm font-semibold text-foreground">Detect Defects Checklist</p>
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
          {allDone ? 'Submit Checklist' : 'Open Checklist'}
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
              <h4 className="text-base font-bold text-foreground">Checklist — WP-2847</h4>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {allDone
                ? 'All Detect Defects checks complete. Ready to submit for WP-2847 (Oak Dining Table).'
                : `${completedCount} of ${checks.length} checks completed. Complete all items before submitting.`}
            </p>
            {allDone ? (
              <button
                onClick={() => setModal(null)}
                className="btn-primary w-full text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} /> Submit Checklist
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