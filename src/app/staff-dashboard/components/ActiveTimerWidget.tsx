'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Flag, Clock, ChevronDown } from 'lucide-react';

// Initial elapsed seconds representing 1h 23m 47s already logged
const INITIAL_ELAPSED = 5027;

export default function ActiveTimerWidget() {
  const [elapsed, setElapsed] = useState(INITIAL_ELAPSED);
  const [running, setRunning] = useState(true);
  const [flagged, setFlagged] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function formatTime(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const overThreshold = elapsed > 5400; // over 1.5h = warning

  return (
    <div className={`card-dark mt-4 md:mt-6 lg:mt-0 p-5 h-full flex flex-col justify-between timer-glow relative overflow-hidden w-full lg:sticky lg:top-16 lg:self-start lg:z-10`}>
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 blob-primary opacity-30 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Active Task</p>
            <p className="text-sm font-semibold text-foreground">WP-2847</p>
          </div>
          <span className={`badge ${running ? 'status-ok' : 'status-warning'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-success animate-pulse-subtle' : 'bg-warning'}`} />
            {running ? 'Running' : 'Paused'}
          </span>
        </div>

        {/* Timer Display */}
        <div className={`text-center py-4 ${overThreshold ? 'text-warning' : 'text-accent'}`}>
          <p className="text-5xl font-bold tabular-nums tracking-tight leading-none">
            {formatTime(elapsed)}
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Stage: Sanding · Est. 45 min remaining</p>
          {overThreshold && (
            <p className="text-xs text-warning mt-1 font-medium animate-pulse-subtle">
              ⚠ Elapsed exceeds stage threshold
            </p>
          )}
        </div>

        {/* Stage Label */}
        <div className="flex items-center gap-2 justify-center mb-4">
          <Clock size={13} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Started 08:42 AM · Order #ORD-4421</span>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-2">
        <button
          onClick={() => setRunning(!running)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-95 ${
            running
              ? 'bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30' :'bg-success/20 text-success border border-success/30 hover:bg-success/30'
          }`}
        >
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? 'Pause Timer' : 'Resume Timer'}
        </button>
        <button
          onClick={() => setFlagged(!flagged)}
          className={`p-2.5 rounded-lg border transition-all duration-150 active:scale-95 ${
            flagged
              ? 'bg-danger/20 text-danger border-danger/30' :'text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Flag issue"
        >
          <Flag size={15} />
        </button>
        <button
          className="p-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 active:scale-95"
          aria-label="Timer history"
        >
          <ChevronDown size={15} />
        </button>
      </div>
    </div>
  );
}