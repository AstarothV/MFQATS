import React from 'react';
import AppLayout from '@/components/AppLayout';
import AssignedTasksList from '../components/AssignedTasksList';

export default function StaffAssignedTasksPage() {
  return (
    <AppLayout role="staff" currentPath="/staff-dashboard/assigned-tasks">
      <div className="space-y-6">
        <div>
          <p className="page-eyebrow">Workshop</p>
          <h1 className="page-title">Assigned Tasks</h1>
          <p className="page-subtitle">
            Review and manage work items assigned to your production team.
          </p>
        </div>
        <AssignedTasksList />
      </div>
    </AppLayout>
  );
}
