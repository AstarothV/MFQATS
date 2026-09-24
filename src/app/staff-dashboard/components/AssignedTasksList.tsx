'use client';
import React, { useState } from 'react';
import { Play, Clock, AlertTriangle, Package, ChevronRight, CheckCircle2 } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

type TaskPriority = 'urgent' | 'normal' | 'low';
type TaskStatus = 'active' | 'queued';

interface AssignedTask {
  id: string;
  workpieceId: string;
  name: string;
  order: string;
  stage: string;
  priority: TaskPriority;
  estimatedMin: number;
  elapsedMin: number;
  status: TaskStatus;
  defectFlag: boolean;
}

const initialTasks: AssignedTask[] = [
  {
    id: 'task-wp2847',
    workpieceId: 'WP-2847',
    name: 'Oak Dining Table',
    order: 'ORD-4421',
    stage: 'Sanding',
    priority: 'urgent',
    estimatedMin: 45,
    elapsedMin: 84,
    status: 'active',
    defectFlag: false,
  },
  {
    id: 'task-wp2851',
    workpieceId: 'WP-2851',
    name: 'Walnut Bookshelf Unit',
    order: 'ORD-4418',
    stage: 'Assembly',
    priority: 'normal',
    estimatedMin: 90,
    elapsedMin: 0,
    status: 'queued',
    defectFlag: false,
  },
  {
    id: 'task-wp2839',
    workpieceId: 'WP-2839',
    name: 'Cherry Side Table',
    order: 'ORD-4409',
    stage: 'Finishing',
    priority: 'low',
    estimatedMin: 60,
    elapsedMin: 0,
    status: 'queued',
    defectFlag: true,
  },
  {
    id: 'task-wp2856',
    workpieceId: 'WP-2856',
    name: 'Maple Coffee Table',
    order: 'ORD-4425',
    stage: 'Cutting',
    priority: 'normal',
    estimatedMin: 35,
    elapsedMin: 0,
    status: 'queued',
    defectFlag: false,
  },
];

const priorityVariant = {
  urgent: 'danger',
  normal: 'info',
  low: 'neutral',
} as const;

const stageColor: Record<string, string> = {
  Cutting: 'text-info',
  Assembly: 'text-warning',
  Sanding: 'text-accent',
  Finishing: 'text-success',
  'QA Check': 'text-primary',
};

export default function AssignedTasksList() {
  const [tasks, setTasks] = useState<AssignedTask[]>(initialTasks);
  const [activeId, setActiveId] = useState('task-wp2847');
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function startTask(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'active' as const }
          : t.id === activeId && activeId !== taskId
          ? { ...t, status: 'queued' as const }
          : t
      )
    );
    setActiveId(taskId);
    const task = tasks.find((t) => t.id === taskId);
    showToast(`Started: ${task?.workpieceId} · ${task?.stage}`);
  }

  return (
    <div className="card-dark p-5">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl animate-fade-in"
             style={{ background: '#22C55E', color: '#FFFFFF' }}>
          <CheckCircle2 size={15} />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Assigned Tasks</h3>
        <span className="text-xs text-muted-foreground">{tasks.length} tasks today</span>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const isActive = task.id === activeId;
          const overTime = task.elapsedMin > task.estimatedMin && task.elapsedMin > 0;

          return (
            <div
              key={task.id}
              onClick={() => setActiveId(task.id)}
              className={`rounded-xl border p-4 cursor-pointer transition-all duration-150 card-hover ${
                isActive
                  ? 'border-primary/50 bg-primary/10' :'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-primary/30' : 'bg-muted'
                  }`}>
                    <Package size={15} className={isActive ? 'text-accent' : 'text-muted-foreground'} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{task.workpieceId}</span>
                      <StatusBadge variant={priorityVariant[task.priority]} label={task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} />
                      {task.defectFlag && (
                        <span className="badge status-danger">
                          <AlertTriangle size={10} />
                          Defect
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.name} · {task.order}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium ${stageColor[task.stage] || 'text-foreground'}`}>
                        {task.stage}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={10} />
                        Est. {task.estimatedMin}m
                      </span>
                      {overTime && (
                        <span className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle size={10} />
                          {task.elapsedMin - task.estimatedMin}m over
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {task.status === 'active' ? (
                    <span className="badge status-ok">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-subtle" />
                      Active
                    </span>
                  ) : (
                    <button
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/20 text-accent text-xs font-semibold hover:bg-primary/30 transition-all active:scale-95"
                      onClick={(e) => startTask(task.id, e)}
                    >
                      <Play size={11} /> Start
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar for active */}
              {isActive && task.elapsedMin > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-2xs text-muted-foreground mb-1">
                    <span>Elapsed: {task.elapsedMin}m</span>
                    <span className={overTime ? 'text-warning' : ''}>{Math.min(100, Math.round((task.elapsedMin / task.estimatedMin) * 100))}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overTime ? 'bg-warning' : 'bg-accent'}`}
                      style={{ width: `${Math.min(100, (task.elapsedMin / task.estimatedMin) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Expanded detail for active */}
              {isActive && (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/20 text-accent text-xs font-semibold hover:bg-primary/30 transition-all active:scale-95"
                    onClick={(e) => { e.stopPropagation(); showToast(`QA Checklist opened for ${task.workpieceId}`); }}
                  >
                    <ChevronRight size={11} /> Open QA
                  </button>
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground hover:bg-muted/80 transition-all active:scale-95"
                    onClick={(e) => { e.stopPropagation(); showToast(`Note logged for ${task.workpieceId}`); }}
                  >
                    Log Note
                  </button>
                  {task.defectFlag && (
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-danger/20 text-danger text-xs font-semibold hover:bg-danger/30 transition-all active:scale-95"
                      onClick={(e) => { e.stopPropagation(); showToast(`Help requested for ${task.workpieceId}`); }}
                    >
                      Request Help
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
