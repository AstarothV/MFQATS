"use client";

import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Users, Clock, CheckCircle2, AlertTriangle, ClipboardList, UserPlus, Circle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

type TeamStatus = 'active' | 'break' | 'idle' | 'off-shift';

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: TeamStatus;
  currentTask: string;
  efficiency: number;
  hoursToday: number;
};

type StaffAssignment = {
  id: string;
  staffId: string;
  staffName: string;
  projectId: string;
  projectLabel: string;
  status: 'assigned' | 'queued';
};

type ProjectOption = {
  id: string;
  customerName: string;
  productName: string;
};

const teamMembers: TeamMember[] = [
  {
    id: 'MR',
    name: 'Marcos Reyes',
    role: 'Production Lead',
    status: 'active',
    currentTask: 'WP-2847 - Oak Dining Table',
    efficiency: 94,
    hoursToday: 7.5,
  },
  {
    id: 'SK',
    name: 'Sunita Kapoor',
    role: 'Quality Supervisor',
    status: 'active',
    currentTask: 'QA Review - ORD-4418',
    efficiency: 98,
    hoursToday: 6.8,
  },
  {
    id: 'JT',
    name: 'James Thompson',
    role: 'Finishing Specialist',
    status: 'break',
    currentTask: 'None',
    efficiency: 91,
    hoursToday: 5.2,
  },
  {
    id: 'LK',
    name: 'Lisa Kim',
    role: 'Assembly Worker',
    status: 'active',
    currentTask: 'WP-2851 - Walnut Bookshelf',
    efficiency: 87,
    hoursToday: 8.1,
  },
  {
    id: 'PV',
    name: 'Pia Vargas',
    role: 'Production Support',
    status: 'idle',
    currentTask: 'Available for assignment',
    efficiency: 90,
    hoursToday: 4.9,
  },
  {
    id: 'AM',
    name: 'Alvin Mora',
    role: 'Cabinet Specialist',
    status: 'off-shift',
    currentTask: 'Off shift',
    efficiency: 84,
    hoursToday: 0,
  },
];

const projectOptions: ProjectOption[] = [
  { id: 'ord-4421', customerName: 'Maria Dela Cruz', productName: 'Oak Dining Table' },
  { id: 'ord-4418', customerName: 'Sunita Kapoor', productName: 'Walnut Coffee Table' },
  { id: 'ord-4430', customerName: 'Brian Santos', productName: 'Cherry Side Table' },
  { id: 'ord-4434', customerName: 'Elena Cruz', productName: 'Pine Bookshelf' },
  { id: 'ord-4438', customerName: 'Nora Villanueva', productName: 'Teak Patio Chair' },
  { id: 'ord-4441', customerName: 'Carlos Reyes', productName: 'Maple Cabinet' },
];

export default function AdminTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(teamMembers);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([
    {
      id: 'assign-1',
      staffId: 'JT',
      staffName: 'James Thompson',
      projectId: 'ord-4418',
      projectLabel: 'Maria Dela Cruz · Walnut Coffee Table',
      status: 'assigned',
    },
  ]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedProject, setSelectedProject] = useState('');

  const assignableMembers = useMemo(
    () => members.filter((member) => member.status === 'idle' || member.status === 'break'),
    [members]
  );

  const assignedProjectIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.projectId)),
    [assignments]
  );

  const remainingProjects = useMemo(
    () => projectOptions.filter((project) => !assignedProjectIds.has(project.id)),
    [assignedProjectIds]
  );

  const selectedMember = assignableMembers.find((member) => member.id === selectedStaff) || assignableMembers[0] || null;
  const selectedProjectOption = remainingProjects.find((project) => project.id === selectedProject) || remainingProjects[0] || null;

  useEffect(() => {
    if (remainingProjects.length === 0) {
      setSelectedProject('');
      return;
    }

    if (!selectedProject || !remainingProjects.some((project) => project.id === selectedProject)) {
      setSelectedProject(remainingProjects[0].id);
    }
  }, [remainingProjects, selectedProject]);

  function createAssignment() {
    if (!selectedMember || !selectedProjectOption) return;

    const projectLabel = `${selectedProjectOption.customerName} · ${selectedProjectOption.productName}`;

    setAssignments((prev) => [
      {
        id: `assign-${Date.now()}`,
        staffId: selectedMember.id,
        staffName: selectedMember.name,
        projectId: selectedProjectOption.id,
        projectLabel,
        status: 'assigned',
      },
      ...prev,
    ]);

    setMembers((prev) =>
      prev.map((member) =>
        member.id === selectedMember.id
          ? {
              ...member,
              status: 'active',
              currentTask: `${selectedProjectOption.productName} - ${selectedProjectOption.customerName}`,
            }
          : member
      )
    );

    setSelectedStaff('');
    setSelectedProject('');
  }

  return (
    <AppLayout role="admin" currentPath="/admin/team">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold text-foreground">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Monitor worker performance, track time, and manage team assignments.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card-dark rounded-3xl border border-border p-6 xl:col-span-2">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">New Staff Assignment</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Assign staff who are idle or on break to a specific customer product.
                </p>
              </div>
              <ClipboardList className="text-primary shrink-0" size={18} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Available Staff</span>
                <select
                  className="input-dark w-full"
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                >
                    <option value="" disabled>
                      Choose staff member
                    </option>
                  {assignableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                        {member.name} - {member.role} ({member.status})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer + Furniture Project</span>
                  <select
                    className="input-dark w-full"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    disabled={remainingProjects.length === 0}
                  >
                    {remainingProjects.length === 0 ? (
                      <option value="">No furniture projects left</option>
                    ) : (
                      remainingProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.customerName} - {project.productName}
                        </option>
                      ))
                    )}
                  </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={createAssignment}
                disabled={!selectedMember || !selectedProjectOption}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={16} />
                Assign Staff to Project
              </button>
              <p className="text-xs text-muted-foreground">
                Selected staff: {selectedMember ? `${selectedMember.name} is ${selectedMember.status}` : 'No available staff'}
              </p>
            </div>

            <div className="mt-6 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-foreground">Furniture Still Needed</p>
                <span className="text-xs text-muted-foreground">{remainingProjects.length} remaining</span>
              </div>
              {remainingProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">All furniture projects are already assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {remainingProjects.map((project) => (
                    <span key={project.id} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                      {project.customerName} · {project.productName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card-dark rounded-3xl border border-border p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Queue</h2>
                <p className="text-sm text-muted-foreground mt-1">Who is working on what right now.</p>
              </div>
              <Circle className="text-success shrink-0" size={18} />
            </div>

            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{assignment.projectLabel}</p>
                      <p className="text-xs text-muted-foreground mt-1">Customer and furniture project</p>
                    </div>
                    <StatusBadge variant={assignment.status === 'assigned' ? 'ok' : 'neutral'} label="Assigned" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{assignment.staffName}</span>
                    <span className="text-primary font-medium">{assignment.staffId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="card-dark p-5 rounded-3xl border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Users className="text-primary" size={20} />
              <span className="text-sm font-semibold text-foreground">Active Workers</span>
            </div>
            <p className="text-2xl font-bold text-foreground">22</p>
            <p className="text-xs text-muted-foreground mt-1">3 on break, 2 off shift</p>
          </div>

          <div className="card-dark p-5 rounded-3xl border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="text-info" size={20} />
              <span className="text-sm font-semibold text-foreground">Avg Hours Today</span>
            </div>
            <p className="text-2xl font-bold text-foreground">7.2h</p>
            <p className="text-xs text-muted-foreground mt-1">+0.3h from yesterday</p>
          </div>

          <div className="card-dark p-5 rounded-3xl border border-border">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="text-success" size={20} />
              <span className="text-sm font-semibold text-foreground">Team Efficiency</span>
            </div>
            <p className="text-2xl font-bold text-foreground">92%</p>
            <p className="text-xs text-muted-foreground mt-1">Above target (90%)</p>
          </div>

          <div className="card-dark p-5 rounded-3xl border border-border">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="text-warning" size={20} />
              <span className="text-sm font-semibold text-foreground">Issues Today</span>
            </div>
            <p className="text-2xl font-bold text-foreground">2</p>
            <p className="text-xs text-muted-foreground mt-1">1 resolved, 1 pending</p>
          </div>
        </div>

        <div className="card-dark rounded-3xl border border-border p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Team Overview</h2>
              <p className="text-sm text-muted-foreground mt-1">Current status and performance metrics.</p>
            </div>
            <span className="text-xs text-muted-foreground">{members?.length} members</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Current Task</th>
                  <th className="px-4 py-3">Assigned Project</th>
                  <th className="px-4 py-3">Efficiency</th>
                  <th className="px-4 py-3">Hours Today</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members?.map((member) => (
                  <tr key={member?.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-xs font-bold text-primary-foreground flex items-center justify-center">
                          {member?.id}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{member?.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {member?.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{member?.role}</td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        variant={
                          member?.status === 'active' ? 'ok' :
                          member?.status === 'break' ? 'warning' : 'neutral'
                        }
                        label={member?.status === 'off-shift' ? 'Off Shift' : member?.status?.charAt(0)?.toUpperCase() + member?.status?.slice(1)}
                      />
                    </td>
                    <td className="px-4 py-4 text-muted-foreground max-w-xs truncate">{member?.currentTask}</td>
                    <td className="px-4 py-4 text-muted-foreground max-w-xs truncate">
                      {assignments.find((assignment) => assignment.staffId === member?.id)?.projectLabel ||
                        (member?.status === 'active'
                          ? 'Current order in production'
                          : member?.status === 'break'
                            ? 'Ready for assignment on return'
                            : member?.status === 'idle'
                              ? 'Available for a new customer product'
                              : 'Not available')}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-semibold ${member?.efficiency >= 90 ? 'text-success' : member?.efficiency >= 85 ? 'text-warning' : 'text-danger'}`}>
                        {member?.efficiency}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{member?.hoursToday}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}