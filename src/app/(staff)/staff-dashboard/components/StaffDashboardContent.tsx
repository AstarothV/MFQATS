import React from 'react';
import ActiveTimerWidget from './ActiveTimerWidget';
import AssignedTasksList from './AssignedTasksList';
import StageProgressPanel from './StageProgressPanel';
import QuickActionTiles from './QuickActionTiles';
import RecentQAFeed from './RecentQAFeed';

export default function StaffDashboardContent() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workshop View</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mon, May 11 2026 — Morning Shift · Station 7
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge status-ok">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-subtle" />
            Clocked In
          </span>
        </div>
      </div>

      {/* Active Timer + Stage Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <ActiveTimerWidget />
        </div>
        <div className="lg:col-span-2">
          <StageProgressPanel />
        </div>
      </div>

      {/* Assigned Tasks + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AssignedTasksList />
        </div>
        <div className="lg:col-span-1">
          <QuickActionTiles />
        </div>
      </div>

      {/* Recent QA Feed */}
      <RecentQAFeed />

      {/* Mobile Bottom Bar Spacer */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}