'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import type { User } from '@/types';

export default function TeamPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllPages<User>('/users');
      setUsers(data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load team members.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then((user) => {
      if (!active) return;
      if (user?.role !== 'OWNER' && user?.role !== 'SUPER_ADMIN') {
        router.replace('/dashboard');
        return;
      }
      setAllowed(true);
      void loadUsers();
    });
    return () => {
      active = false;
    };
  }, [loadUsers, router]);

  async function handleDeactivate(id: string) {
    setDeactivatingId(id);
    setError('');
    try {
      await api.patch(`/users/${id}/deactivate`);
      await loadUsers();
    } catch (deactivateError: unknown) {
      setError(getApiError(deactivateError, 'Could not deactivate this user.'));
    } finally {
      setDeactivatingId('');
    }
  }

  if (!allowed) return <LoadingState label="Checking permissions..." />;

  return (
    <>
      <PageHeader
        title="Team"
        description="Manage staff access and account permissions."
        action={
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus aria-hidden="true" size={16} /> Add user
          </button>
        }
      />

      <section className="card overflow-hidden">
        {loading ? (
          <LoadingState label="Loading team..." />
        ) : error && users.length === 0 ? (
          <ErrorState message={error} onRetry={loadUsers} />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No team members yet" description="Invite staff or an accountant to collaborate." />
        ) : (
          <>
            {error && <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-semibold text-slate-800">{user.name}</td>
                      <td className="px-5 py-3 text-slate-600">{user.email}</td>
                      <td className="px-5 py-3 text-xs font-medium text-slate-600">{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {user.role !== 'OWNER' && user.isActive && (
                          <button type="button" disabled={deactivatingId === user.id} onClick={() => void handleDeactivate(user.id)} className="text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-50">
                            {deactivatingId === user.id ? 'Deactivating...' : 'Deactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {showForm && (
        <AddUserModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void loadUsers();
          }}
        />
      )}
    </>
  );
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/users', {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      });
      onSaved();
    } catch (saveError: unknown) {
      setError(getApiError(saveError, 'Could not add user.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add team member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div>
          <label htmlFor="user-name" className="label">Full name *</label>
          <input id="user-name" required autoFocus autoComplete="name" className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div>
          <label htmlFor="user-email" className="label">Email *</label>
          <input id="user-email" type="email" required autoComplete="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div>
          <label htmlFor="user-password" className="label">Temporary password *</label>
          <input id="user-password" type="password" required minLength={10} autoComplete="new-password" className="input-field" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="10+ characters with number and symbol" />
        </div>
        <div>
          <label htmlFor="user-role" className="label">Role</label>
          <select id="user-role" className="input-field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="STAFF">Staff</option>
            <option value="ACCOUNTANT">Accountant</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary inline-flex min-w-28 items-center justify-center gap-2">
            {saving && <Loader2 aria-hidden="true" size={15} className="animate-spin" />}
            {saving ? 'Adding...' : 'Add user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
