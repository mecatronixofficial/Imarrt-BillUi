'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Mail, ReceiptText } from 'lucide-react';
import { api, getApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      // The API always answers the same way whether or not the email matches an
      // account, so a leaked address can't be used to find out who has one.
      setSent(true);
    } catch (submitError: unknown) {
      setError(getApiError(submitError, 'Could not send the reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

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

        {sent ? (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 aria-hidden="true" size={26} />
            </span>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950">Check your inbox</h1>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              If an account exists for <strong className="text-slate-700">{email.trim()}</strong>, we&apos;ve sent a link to reset your password. It expires in 1 hour.
            </p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
              <ArrowLeft aria-hidden="true" size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <header className="mb-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Forgot password</p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">Reset your password</h1>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">Enter your account email and we&apos;ll send you a link to set a new password.</p>
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
                <label htmlFor={emailId} className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</label>
                <div className="group relative">
                  <Mail aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                  <input
                    id={emailId}
                    type="email"
                    required
                    autoFocus
                    autoCapitalize="none"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder="you@business.com"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 hover:shadow-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 aria-hidden="true" size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
              <ArrowLeft aria-hidden="true" size={14} /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
