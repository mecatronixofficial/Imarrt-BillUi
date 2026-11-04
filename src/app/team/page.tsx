'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import RowActions, { type RowAction } from '@/components/RowActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { toast } from '@/components/ToastProvider';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { User } from '@/types';

type Member = User & { joinedAt?: string; lastActiveAt?: string | null };
type MemberDetail = Member & {
  mfaEnabled: boolean;
  activity: { invoices: number; documents: number };
  recent: Array<{ id: string; action: string; entityType: string; createdAt: string }>;
};
type Pending = { member: Member; action: 'deactivate' | 'activate' | 'remove' };

const roleLabel = (role: string) => role.charAt(0) + role.slice(1).toLowerCase().replaceAll('_', ' ');
const actionLabel = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replaceAll('_', ' ');
const canManage = (member: Member, meId: string) => member.id !== meId && (member.role === 'STAFF' || member.role === 'ACCOUNTANT');

function lastActive(value?: string | null) {
  if (!value) return 'Never signed in';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return formatDate(value);
}

export default function TeamPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [meId, setMeId] = useState('');
  const [users, setUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<Member | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllPages<Member>('/users');
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
      setMeId(user.id);
      setAllowed(true);
      void loadUsers();
    });
    return () => {
      active = false;
    };
  }, [loadUsers, router]);

  async function run() {
    if (!pending || busy) return;
    const { member, action } = pending;
    setBusy(true);
    try {
      if (action === 'remove') await api.delete(`/users/${member.id}`);
      else await api.patch(`/users/${member.id}/${action}`);
      if (action === 'deactivate') {
        toast.danger('Team member deactivated', {
          description: `${member.name} can no longer open this company.`,
          action: { label: 'Undo', onClick: () => void api.patch(`/users/${member.id}/activate`).then(() => { toast.success(`${member.name} re-activated`); void loadUsers(); }).catch((failure) => toast.error(getApiError(failure, 'Could not re-activate.'))) },
        });
      } else {
        toast.success(action === 'activate' ? 'Team member activated' : 'Team member removed', { description: member.name });
      }
      setPending(null);
      setViewing(null);
      await loadUsers();
    } catch (failure: unknown) {
      toast.error(getApiError(failure, `Could not ${action} this team member.`));
    } finally {
      setBusy(false);
    }
  }

  function actionsFor(member: Member): Array<RowAction | false> {
    const manageable = canManage(member, meId);
    return [
      { label: 'View details', icon: 'view', onClick: () => setViewing(member) },
      manageable && !member.isActive && { label: 'Activate', icon: 'restore', onClick: () => setPending({ member, action: 'activate' }) },
      manageable && member.isActive && { label: 'Deactivate', icon: 'cancel', danger: true, onClick: () => setPending({ member, action: 'deactivate' }) },
      manageable && { label: 'Remove from team', icon: 'delete', danger: true, onClick: () => setPending({ member, action: 'remove' }) },
    ];
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
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Last active</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => setViewing(user)} className="font-semibold text-slate-800 hover:text-blue-700">{user.name}</button>
                        {user.id === meId && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">You</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{user.email}</td>
                      <td className="px-5 py-3 text-xs font-medium text-slate-600">{roleLabel(user.role)}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{lastActive(user.lastActiveAt)}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {canManage(user, meId) && (user.isActive
                            ? <button type="button" onClick={() => setPending({ member: user, action: 'deactivate' })} className="text-xs font-semibold text-red-600 transition hover:text-red-700">Deactivate</button>
                            : <button type="button" onClick={() => setPending({ member: user, action: 'activate' })} className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-800">Activate</button>)}
                          <RowActions label={`Actions for ${user.name}`} actions={actionsFor(user)} />
                        </div>
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
      {viewing && <MemberModal member={viewing} actions={actionsFor(viewing).filter((action): action is RowAction => Boolean(action) && action !== false && action.label !== 'View details')} onClose={() => setViewing(null)} />}
      {pending && (
        <ConfirmDialog
          title={pending.action === 'remove' ? `Remove ${pending.member.name}?` : pending.action === 'deactivate' ? `Deactivate ${pending.member.name}?` : `Activate ${pending.member.name}?`}
          message={pending.action === 'remove'
            ? `${pending.member.name} loses access to this company and leaves the team list. Their login and everything they recorded are kept; add them again any time with the same email.`
            : pending.action === 'deactivate'
              ? `${pending.member.name} can no longer open this company. They stay on the list, and you can activate them again.`
              : `${pending.member.name} can open this company again with their existing login.`}
          confirmLabel={pending.action === 'remove' ? 'Remove' : pending.action === 'deactivate' ? 'Deactivate' : 'Activate'}
          busyLabel={pending.action === 'remove' ? 'Removing...' : pending.action === 'deactivate' ? 'Deactivating...' : 'Activating...'}
          busy={busy}
          onCancel={() => { if (!busy) setPending(null); }}
          onConfirm={() => void run()}
        />
      )}
    </>
  );
}

function MemberModal({ member, actions, onClose }: { member: Member; actions: RowAction[]; onClose: () => void }) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<MemberDetail>(`/users/${member.id}`)
      .then(({ data }) => { if (active) setDetail(data); })
      .catch((failure) => { if (active) setError(getApiError(failure, 'Could not load this team member.')); });
    return () => { active = false; };
  }, [member.id]);

  const shown = detail ?? member;
  return (
    <Modal title={member.name} onClose={onClose} size="lg">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Fact label="Email">{shown.email}</Fact>
        <Fact label="Role">{roleLabel(shown.role)}</Fact>
        <Fact label="Status"><span className={shown.isActive ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>{shown.isActive ? 'Active' : 'Inactive'}</span></Fact>
        <Fact label="Joined this company">{shown.joinedAt ? formatDate(shown.joinedAt) : '—'}</Fact>
        <Fact label="Last active">{lastActive(shown.lastActiveAt)}</Fact>
        <Fact label="Two-step sign-in">{detail ? (detail.mfaEnabled ? 'On' : 'Off') : '…'}</Fact>
        <Fact label="Sale invoices created">{detail ? detail.activity.invoices : '…'}</Fact>
        <Fact label="Other documents created">{detail ? detail.activity.documents : '…'}</Fact>
      </dl>
      <h3 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent activity</h3>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !detail ? <p className="text-sm text-slate-500">Loading…</p> : detail.recent.length ? (
        <ol className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {detail.recent.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span>{actionLabel(entry.action)}</span>
              <span className="shrink-0 text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-slate-500">No recorded activity in this company yet.</p>}
      {actions.length > 0 && (
        <footer className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick} className={action.danger ? 'rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50' : 'btn-secondary'}>
              {action.label}
            </button>
          ))}
        </footer>
      )}
    </Modal>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children}</dd>
    </div>
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
      toast.success('Team member added', { description: form.email.trim().toLowerCase() });
      onSaved();
    } catch (saveError: unknown) {
      const message = getApiError(saveError, 'Could not add user.'); setError(message); toast.error(message);
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
