'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ReceiptText } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    void getCurrentUser()
      .then((user) => router.replace(user ? '/dashboard' : '/login'))
      .catch(() => router.replace('/login'));
  }, [router]);
  return (
    <main className="flex min-h-screen min-h-dvh items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/50">
          <ReceiptText aria-hidden="true" size={22} />
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 aria-hidden="true" size={14} className="animate-spin text-blue-400" />
          Opening iMart Billing...
        </div>
      </div>
    </main>
  );
}
