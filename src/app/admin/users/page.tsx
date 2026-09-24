'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, UserX, UserCheck, Loader2, X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Shield, Wrench, User } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'staff' | 'customer';
  department: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

interface UserForm {
  full_name: string;
  email: string;
  role: 'admin' | 'staff' | 'customer';
  department: string;
  phone: string;
  password: string;
}

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | 'deactivate' | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserForm>({ full_name: '', email: '', role: 'staff', department: '', phone: '', password: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('user_profiles').select('*', { count: 'exact' });
    if (search) query = query.ilike('full_name', `%${search}%`);
    if (roleFilter !== 'all') query = query.eq('role', roleFilter);
    query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (!error && data) {
      setUsers(data as UserProfile[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [supabase, search, roleFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openAdd() {
    setForm({ full_name: '', email: '', role: 'staff', department: '', phone: '', password: '' });
    setModal('add');
  }

  function openEdit(u: UserProfile) {
    setSelectedUser(u);
    setForm({ full_name: u.full_name, email: u.email, role: u.role, department: u.department || '', phone: u.phone || '', password: '' });
    setModal('edit');
  }

  function openDelete(u: UserProfile) {
    setSelectedUser(u);
    setConfirmText('');
    setModal('delete');
  }

  function openDeactivate(u: UserProfile) {
    setSelectedUser(u);
    setModal('deactivate');
  }

  async function handleAdd() {
    if (!form.full_name || !form.email) {
      showToast('error', 'Name and email are required');
      return;
    }
    setFormLoading(true);
    try {
      // Create auth user via Supabase signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password || `TempPass@${Date.now()}`,
        options: {
          data: {
            full_name: form.full_name,
            role: form.role,
          },
        },
      });

      if (authError) throw authError;

      // Update profile with additional fields
      if (authData?.user) {
        await supabase.from('user_profiles').upsert({
          id: authData.user.id,
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          department: form.department,
          phone: form.phone,
          is_active: true,
        });
      }

      showToast('success', `${form.role === 'staff' ? 'Staff' : 'User'} account created for ${form.full_name}`);
      setModal(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create account');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit() {
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      const { error } = await supabase.from('user_profiles').update({
        full_name: form.full_name,
        role: form.role,
        department: form.department,
        phone: form.phone,
      }).eq('id', selectedUser.id);
      if (error) throw error;
      showToast('success', 'User updated successfully');
      setModal(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      const newStatus = !selectedUser.is_active;
      const { error } = await supabase.from('user_profiles').update({ is_active: newStatus }).eq('id', selectedUser.id);
      if (error) throw error;
      showToast('success', `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      setModal(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update user status');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedUser || confirmText !== selectedUser.full_name) return;
    setFormLoading(true);
    try {
      const { error } = await supabase.from('user_profiles').delete().eq('id', selectedUser.id);
      if (error) throw error;
      showToast('success', 'User deleted successfully');
      setModal(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete user');
    } finally {
      setFormLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const roleIcon = (role: string) => role === 'admin' ? <Shield size={12} className="text-warning" /> : role === 'staff' ? <Wrench size={12} className="text-info" /> : <User size={12} className="text-success" />;

  return (
    <AppLayout role="admin" currentPath="/admin/users">
      <div className="space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-2">Administration</p>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground mt-2">Manage system users, roles, and access permissions.</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Staff / User
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: total, color: 'text-foreground' },
            { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: 'text-warning' },
            { label: 'Staff', value: users.filter(u => u.role === 'staff').length, color: 'text-info' },
            { label: 'Customers', value: users.filter(u => u.role === 'customer').length, color: 'text-success' },
          ].map(stat => (
            <div key={stat.label} className="card-dark p-4 rounded-3xl border border-border">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" placeholder="Search users..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="input-dark w-full pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'admin', 'staff', 'customer'].map(r => (
              <button key={r} onClick={() => { setRoleFilter(r); setPage(0); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${roleFilter === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="card-dark rounded-3xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-16"><p className="text-muted-foreground">No users found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                          {roleIcon(u.role)}
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{u.department || '—'}</td>
                      <td className="px-4 py-4">
                        <StatusBadge variant={u.is_active ? 'ok' : 'danger'} label={u.is_active ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Edit user">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => openDeactivate(u)} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${u.is_active ? 'text-warning' : 'text-success'}`} title={u.is_active ? 'Deactivate' : 'Activate'}>
                            {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          {u.id !== user?.id && (
                            <button onClick={() => openDelete(u)} className="p-1.5 rounded-lg hover:bg-danger/10 transition-colors text-danger" title="Delete user">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary px-3 py-2 disabled:opacity-50"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary px-3 py-2 disabled:opacity-50"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {(modal === 'add' || modal === 'edit') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-foreground">{modal === 'add' ? 'Add Staff / User' : 'Edit User'}</h2>
                <button type="button" onClick={() => setModal(null)} className="btn-ghost p-2"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <label className="block space-y-1 text-sm text-muted-foreground">
                  Full Name *
                  <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input-dark w-full mt-1" placeholder="John Smith" />
                </label>
                <label className="block space-y-1 text-sm text-muted-foreground">
                  Email *
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-dark w-full mt-1" placeholder="john@example.com" disabled={modal === 'edit'} />
                </label>
                <label className="block space-y-1 text-sm text-muted-foreground">
                  Role
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))} className="input-dark w-full mt-1">
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="customer">Customer</option>
                  </select>
                </label>
                <label className="block space-y-1 text-sm text-muted-foreground">
                  Department
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="input-dark w-full mt-1" placeholder="Production, QA, etc." />
                </label>
                <label className="block space-y-1 text-sm text-muted-foreground">
                  Phone
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-dark w-full mt-1" placeholder="+63 912 345 6789" />
                </label>
                {modal === 'add' && (
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Temporary Password
                    <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input-dark w-full mt-1" placeholder="Min 8 characters" />
                  </label>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={modal === 'add' ? handleAdd : handleEdit} disabled={formLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {formLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {modal === 'add' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deactivate Modal */}
        {modal === 'deactivate' && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-foreground mb-3">{selectedUser.is_active ? 'Deactivate' : 'Activate'} User</h2>
              <p className="text-sm text-muted-foreground mb-5">
                {selectedUser.is_active ? `Deactivating ${selectedUser.full_name} will prevent them from logging in.` : `Activating ${selectedUser.full_name} will restore their access.`}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={handleDeactivate} disabled={formLoading} className={`flex-1 rounded-2xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 ${selectedUser.is_active ? 'bg-warning' : 'bg-success'}`}>
                  {formLoading ? <Loader2 size={14} className="animate-spin" /> : selectedUser.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                  {selectedUser.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {modal === 'delete' && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-foreground mb-3">Delete User</h2>
              <p className="text-sm text-muted-foreground mb-4">Type <strong className="text-foreground">{selectedUser.full_name}</strong> to confirm deletion.</p>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="input-dark w-full mb-4" placeholder={selectedUser.full_name} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={confirmText !== selectedUser.full_name || formLoading} className="flex-1 rounded-2xl bg-danger py-3 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2">
                  {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
