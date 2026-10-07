import React from 'react';
import AppLayout from '@/components/AppLayout';
import AssignedTasksList from '../components/AssignedTasksList';

export default function StaffAssignedTasksPage() {
  return (
    <AppLayout role="staff" currentPath="/staff-dashboard/assigned-tasks">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold text-foreground">Assigned Tasks</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Review and manage work items assigned to your production team.
          </p>
        </div>
        <AssignedTasksList />
      </div>
    </AppLayout>
  );
}
