'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api, getApiError, getCurrentUser, resetSession } from '@/lib/api';
import { toast } from '@/components/ToastProvider';

const highlights = [
  {
    icon: ReceiptText,
    title: 'GST-ready invoices',
    description: 'Create professional invoices and share them in seconds.',
  },
  {
    icon: BarChart3,
    title: 'A clearer view of business',
    description: 'Follow sales, payments, and inventory from one dashboard.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data stays protected',
    description: 'Secure access keeps your business information in safe hands.',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const { data } = await api.post<{ mfaRequired: boolean }>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
        ...(mfaRequired
          ? useRecoveryCode
            ? { recoveryCode: mfaCode.trim() }
            : { mfaCode: mfaCode.trim() }
          : {}),
      });

      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaCode('');
        return;
      }

      resetSession();
      const currentUser = await getCurrentUser().catch(() => null);
      const role = currentUser?.role === 'SUPER_ADMIN'
        ? 'Super admin'
        : currentUser?.role
          ? currentUser.role.charAt(0) + currentUser.role.slice(1).toLowerCase()
          : 'member';
      toast.success(currentUser?.name ? `Welcome, ${currentUser.name}` : 'Welcome back', {
        description: `Signed in as ${role}.`,
        duration: 5500,
      });
      router.replace('/dashboard');
      router.refresh();
    } catch (submitError: unknown) {
      setError(getApiError(submitError, 'We could not sign you in. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen min-h-dvh overflow-hidden bg-slate-950 text-slate-950 lg:h-screen lg:bg-white">
      <section className="relative hidden w-1/2 overflow-hidden bg-slate-950 px-10 py-7 text-white lg:flex lg:flex-col xl:px-14 xl:py-9">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.32),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(99,102,241,0.28),transparent_38%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-1/3 h-44 w-44 rounded-full border border-white/10" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-950/40">
            <ReceiptText aria-hidden="true" size={19} strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight">iMart Billing</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200">Business made simple</p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg py-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-[11px] font-semibold text-blue-100 backdrop-blur-sm">
            <Sparkles aria-hidden="true" size={14} />
            Built for growing Indian businesses
          </div>
          <h1 className="max-w-md text-3xl font-extrabold leading-[1.15] tracking-tight xl:text-4xl">
            Run your business with clarity and confidence.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            Billing, inventory, and party accounts come together in one simple workspace.
          </p>

          <div className="mt-7 grid gap-4">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div key={title} className="group flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.07] text-blue-200 transition-colors group-hover:bg-white/[0.12]">
                  <Icon aria-hidden="true" size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} iMart Billing</p>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Secure sign in
          </div>
        </div>
      </section>

      <section className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-5 sm:px-8 sm:py-8 lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(37,99,235,0.45),transparent_34%),radial-gradient(circle_at_95%_90%,rgba(14,165,233,0.2),transparent_36%)] lg:hidden" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:32px_32px] lg:hidden" />
        <div className="relative w-full max-w-sm rounded-[1.5rem] border border-white/70 bg-white p-5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.75)] sm:p-7 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
          <div className="mb-5 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-200">
              <ReceiptText aria-hidden="true" size={19} strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-base font-extrabold tracking-tight">iMart Billing</p>
              <p className="whitespace-nowrap text-[7px] font-semibold uppercase tracking-[0.14em] text-blue-600">Business made simple</p>
            </div>
          </div>

          <header className="mb-5 text-center lg:text-left">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Welcome back</p>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">Sign in to your account</h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">Enter your account details to continue to your dashboard.</p>
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:h-11 lg:rounded-lg"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor={passwordId} className="block text-xs font-semibold text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Forgot password?</Link>
              </div>
              <div className="group relative">
                <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 lg:h-11 lg:rounded-lg"
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
            </div>

            {mfaRequired && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                <label htmlFor="mfa-code" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  {useRecoveryCode ? 'Recovery code' : 'Authenticator code'}
                </label>
                <input
                  id="mfa-code"
                  required
                  autoFocus
                  inputMode={useRecoveryCode ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => {
                    setMfaCode(event.target.value);
                    if (error) setError('');
                  }}
                  maxLength={useRecoveryCode ? 32 : 6}
                  placeholder={useRecoveryCode ? 'XXXX-XXXX-XXXX' : '000000'}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-center font-mono text-sm tracking-[0.2em] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode((value) => !value);
                    setMfaCode('');
                  }}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {useRecoveryCode ? 'Use authenticator code' : 'Use a recovery code'}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password || (mfaRequired && !mfaCode.trim())}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 hover:shadow-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none lg:h-11 lg:rounded-lg"
            >
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  {mfaRequired ? 'Verify and sign in' : 'Sign in securely'}
                  <ArrowRight aria-hidden="true" size={18} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check aria-hidden="true" size={13} strokeWidth={3} />
            </span>
            <p>Need access? Ask your business owner or administrator to add your account.</p>
          </div>

          <p className="mt-5 text-center text-[11px] text-slate-400">
            By continuing, you agree to keep your account credentials secure.
          </p>
        </div>
      </section>
    </main>
  );
}
