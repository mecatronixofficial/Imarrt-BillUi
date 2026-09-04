'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, KeyRound, Loader2, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import PageHeader from '@/components/PageHeader';
import { api, getApiError, getCurrentUser, resetSession, SessionUser } from '@/lib/api';

type AuthSession = {
  id: string; userAgent?: string; ipAddress?: string; createdAt: string;
  lastUsedAt: string; expiresAt: string; mfaVerified: boolean; current: boolean;
};
type MfaSetup = { secret: string; otpauthUri: string };

function getDeviceName(userAgent?: string) {
  if (!userAgent) return 'Unknown device';

  const browserPatterns: Array<[string, RegExp]> = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  const browser = browserPatterns.find(([, pattern]) => pattern.test(userAgent));
  const match = browser?.[1].exec(userAgent);
  const browserName = browser ? `${browser[0]}${match?.[1] ? ` ${match[1].split('.')[0]}` : ''}` : 'Web browser';

  let operatingSystem = 'Unknown OS';
  if (/Windows NT/i.test(userAgent)) operatingSystem = 'Windows';
  else if (/Android/i.test(userAgent)) operatingSystem = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) operatingSystem = 'iOS';
  else if (/Mac OS X/i.test(userAgent)) operatingSystem = 'macOS';
  else if (/Linux/i.test(userAgent)) operatingSystem = 'Linux';

  return `${browserName} on ${operatingSystem}`;
}

export default function SecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadSecurity = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      setUser(currentUser);
      const { data } = await api.get<AuthSession[]>('/auth/sessions');
      setSessions(data);
    } catch (loadError) {
      setError(getApiError(loadError, 'Could not load security settings.'));
    }
  }, []);

  useEffect(() => { void loadSecurity(); }, [loadSecurity]);

  useEffect(() => {
    let active = true;
    setQrCodeUrl('');
    setSecretCopied(false);

    if (!setup?.otpauthUri) return () => { active = false; };

    void QRCode.toDataURL(setup.otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => { if (active) setQrCodeUrl(url); })
      .catch(() => { if (active) setError('Could not generate the authenticator QR code. Use the setup key instead.'); });

    return () => { active = false; };
  }, [setup]);

  async function copySetupSecret() {
    if (!setup?.secret) return;

    try {
      await navigator.clipboard.writeText(setup.secret);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      setError('Could not copy the setup key. Select and copy it manually.');
    }
  }

  async function startMfaSetup() {
    setBusy('setup'); setError('');
    try {
      const { data } = await api.post<MfaSetup>('/auth/mfa/setup');
      setSetup(data);
    } catch (requestError) { setError(getApiError(requestError, 'Could not start MFA setup.')); }
    finally { setBusy(''); }
  }

  async function enableMfa(event: FormEvent) {
    event.preventDefault(); setBusy('enable'); setError('');
    try {
      const { data } = await api.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code: mfaCode });
      setRecoveryCodes(data.recoveryCodes); setSetup(null); resetSession();
    } catch (requestError) { setError(getApiError(requestError, 'Could not enable MFA.')); }
    finally { setBusy(''); }
  }

  async function disableMfa(event: FormEvent) {
    event.preventDefault(); setBusy('disable'); setError('');
    try {
      await api.post('/auth/mfa/disable', disableForm); resetSession(); router.replace('/login');
    } catch (requestError) { setError(getApiError(requestError, 'Could not disable MFA.')); }
    finally { setBusy(''); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setBusy('password'); setError('');
    try {
      await api.post('/auth/change-password', passwordForm); resetSession(); router.replace('/login');
    } catch (requestError) { setError(getApiError(requestError, 'Could not change password.')); }
    finally { setBusy(''); }
  }

  async function revokeSession(id: string) {
    setBusy(id); setError('');
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch (requestError) { setError(getApiError(requestError, 'Could not revoke the session.')); }
    finally { setBusy(''); }
  }

  async function revokeOthers() {
    setBusy('others'); setError('');
    try {
      await api.delete('/auth/sessions/others');
      setSessions((current) => current.filter((session) => session.current));
    } catch (requestError) { setError(getApiError(requestError, 'Could not revoke other sessions.')); }
    finally { setBusy(''); }
  }

  if (recoveryCodes.length > 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
        <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <ShieldCheck className="mb-4 text-emerald-400" size={34} />
          <h1 className="text-2xl font-bold">MFA is enabled</h1>
          <p className="mt-2 text-sm text-slate-300">Save these one-time recovery codes now. They will not be shown again.</p>
          <div className="my-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-4 font-mono text-sm">
            {recoveryCodes.map((code) => <span key={code}>{code}</span>)}
          </div>
          <button className="btn-primary w-full" onClick={() => router.replace('/login')}>I saved them — sign in again</button>
        </section>
      </main>
    );
  }

  return (
    <>
      <PageHeader title="Account security" description="Manage multi-factor authentication, passwords, and active devices." />
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><ShieldCheck size={20} /></span><div><h2 className="font-bold text-slate-900">Authenticator MFA</h2><p className="mt-1 text-xs leading-5 text-slate-500">Optional extra protection for your account. When enabled, verification is required at sign-in.</p></div></div>
          {!user?.mfaEnabled ? (
            <div className="mt-5">
              {!setup ? (
                <button className="btn-primary" disabled={busy === 'setup'} onClick={() => void startMfaSetup()}>{busy === 'setup' ? 'Preparing…' : 'Set up authenticator'}</button>
              ) : (
                <form onSubmit={enableMfa} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">1. Scan this QR code</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Open Google Authenticator, Microsoft Authenticator, or 1Password and scan the code.</p>
                  </div>
                  <div className="flex min-h-60 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR code for setting up authenticator MFA" className="h-56 w-56 rounded-lg bg-white" />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} /> Generating QR code…</div>
                    )}
                  </div>
                  <a href={setup.otpauthUri} className="block text-xs font-semibold text-blue-600 sm:hidden">Open in authenticator app</a>

                  <div>
                    <p className="text-xs font-semibold text-slate-700">Can’t scan it? Enter this setup key manually</p>
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-950 p-3 text-white">
                      <code className="min-w-0 flex-1 select-all break-all text-center text-sm tracking-widest">{setup.secret}</code>
                      <button type="button" onClick={() => void copySetupSecret()} className="shrink-0 rounded-md p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Copy setup key">
                        {secretCopied ? <Check size={17} className="text-emerald-400" /> : <Copy size={17} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mfa-setup-code" className="label">2. Enter the 6-digit code from your app</label>
                    <input id="mfa-setup-code" className="input-field text-center font-mono tracking-[0.3em]" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" aria-describedby="mfa-setup-help" />
                    <p id="mfa-setup-help" className="mt-1.5 text-xs text-slate-500">This verifies that your authenticator is connected correctly.</p>
                  </div>
                  <button className="btn-primary" disabled={busy === 'enable' || mfaCode.length !== 6}>{busy === 'enable' ? 'Verifying…' : 'Verify and enable'}</button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={disableMfa} className="mt-5 space-y-3">
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">MFA is active on this account</div>
              <p className="text-xs text-slate-500">Disabling MFA signs out every device. Confirm with your password and authenticator or recovery code.</p>
              <input className="input-field" type="password" required placeholder="Current password" value={disableForm.password} onChange={(event) => setDisableForm({ ...disableForm, password: event.target.value })} />
              <input className="input-field" required placeholder="Authenticator or recovery code" value={disableForm.code} onChange={(event) => setDisableForm({ ...disableForm, code: event.target.value })} />
              <button className="btn-secondary text-red-600" disabled={busy === 'disable'}>{busy === 'disable' ? 'Disabling…' : 'Disable MFA'}</button>
            </form>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-violet-50 p-2 text-violet-600"><KeyRound size={20} /></span><div><h2 className="font-bold text-slate-900">Change password</h2><p className="mt-1 text-xs text-slate-500">Changing it signs out every active device.</p></div></div>
          <form onSubmit={changePassword} className="mt-5 space-y-3">
            <input className="input-field" type="password" required maxLength={72} autoComplete="current-password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
            <input className="input-field" type="password" required minLength={10} maxLength={72} autoComplete="new-password" placeholder="New strong password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
            <p className="text-xs text-slate-500">At least 10 characters with upper-case, lower-case, number, and symbol.</p>
            <button className="btn-primary" disabled={busy === 'password'}>{busy === 'password' ? 'Changing…' : 'Change password'}</button>
          </form>
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3"><MonitorSmartphone className="text-blue-600" size={20} /><div><h2 className="font-bold text-slate-900">Active sessions</h2><p className="text-xs text-slate-500">Review and revoke signed-in devices.</p></div></div>
          <button className="btn-secondary" disabled={busy === 'others' || sessions.length <= 1} onClick={() => void revokeOthers()}>{busy === 'others' ? 'Revoking…' : 'Sign out other devices'}</button>
        </div>
        <div className="divide-y divide-slate-100">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-4 p-4 text-sm">
              <div className="min-w-0"><p className="truncate font-semibold text-slate-800">{getDeviceName(session.userAgent)} {session.current && <span className="ml-2 text-xs text-emerald-600">Current</span>}</p><p className="mt-1 text-xs text-slate-500">{session.ipAddress || 'Unknown IP'} · Last used {new Date(session.lastUsedAt).toLocaleString()}</p></div>
              {!session.current && <button className="text-xs font-semibold text-red-600" disabled={busy === session.id} onClick={() => void revokeSession(session.id)}>{busy === session.id ? <Loader2 className="animate-spin" size={15} /> : 'Revoke'}</button>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
