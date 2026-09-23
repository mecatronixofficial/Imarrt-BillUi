'use client';

import { Suspense, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, ReceiptText, TriangleAlert } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { toast } from '@/components/ToastProvider';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.35),transparent_38%),radial-gradient(circle_at_90%_90%,rgba(14,165,233,0.2),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-white p-6 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.6)] sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-200">
            <ReceiptText aria-hidden="true" size={19} strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight text-slate-950">iMart Billing</p>
            <p className="whitespace-nowrap text-[7px] font-semibold uppercase tracking-[0.14em] text-blue-600">Business made simple</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Shell><div className="py-10 text-center text-xs text-slate-400">Loading...</div></Shell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const passwordValid = PASSWORD_RULE.test(password);
  const passwordsMatch = password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!passwordValid) {
      setError('Password must be at least 10 characters and include upper-case, lower-case, a number, and a symbol.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      toast.success('Password reset', { description: 'Sign in with your new password.' });
    } catch (submitError: unknown) {
      setError(getApiError(submitError, 'This reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Shell>
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <TriangleAlert aria-hidden="true" size={24} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950">Link missing or incomplete</h1>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">Open the reset link from your email again, or request a new one.</p>
          <Link href="/forgot-password" className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <ArrowLeft aria-hidden="true" size={14} /> Request a new link
          </Link>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 aria-hidden="true" size={26} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950">Password reset</h1>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">Your password has been changed. Sign in below with your new password.</p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
          >
            Go to sign in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Reset password</p>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">Set a new password</h1>
        <p className="mt-1.5 text-xs leading-5 text-slate-500">Choose a strong password you haven&apos;t used before.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <span aria-hidden="true" className="text-xs font-bold">!</span>
            </span>
            {error}
          </div>
        )}

        <div>
          <label htmlFor={passwordId} className="mb-1.5 block text-xs font-semibold text-slate-700">New password</label>
          <div className="group relative">
            <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError('');
              }}
              placeholder="Enter a new password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">At least 10 characters, with upper-case, lower-case, a number, and a symbol.</p>
        </div>

        <div>
          <label htmlFor={confirmId} className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm new password</label>
          <div className="group relative">
            <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
            <input
              id={confirmId}
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) setError('');
              }}
              placeholder="Re-enter the new password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 hover:shadow-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading ? (
            <>
              <Loader2 aria-hidden="true" size={18} className="animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset password'
          )}
        </button>
      </form>

      <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
        <ArrowLeft aria-hidden="true" size={14} /> Back to sign in
      </Link>
    </Shell>
  );
}
