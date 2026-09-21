'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Factory, Package, Plus, ReceiptText, ShoppingCart, Users } from 'lucide-react';

/* One floating button in the bottom-right corner. Its five options fan out as round buttons along a quarter arc:
   the first level with the button on its left, the last directly above it, like the sweep of a gauge. */
const actions = [
  { href: '/production', label: 'Production', icon: Factory, color: 'from-violet-500 to-purple-600 shadow-violet-600/40' },
  { href: '/invoices', label: 'Invoice', icon: ReceiptText, color: 'from-blue-500 to-indigo-600 shadow-blue-600/40' },
  { href: '/purchases', label: 'Purchase', icon: ShoppingCart, color: 'from-orange-400 to-orange-600 shadow-orange-600/40' },
  { href: '/items', label: 'Items', icon: Package, color: 'from-cyan-500 to-sky-600 shadow-cyan-600/40' },
  { href: '/parties', label: 'Parties', icon: Users, color: 'from-emerald-400 to-emerald-600 shadow-emerald-600/40' },
] as const;

const RADIUS = 132;
const CIRCLE = 48;

/** Offset of option `index` from the button's centre along the arc. */
function arc(index: number) {
  const angle = (index / (actions.length - 1)) * (Math.PI / 2);
  return { x: -Math.cos(angle) * RADIUS, y: -Math.sin(angle) * RADIUS };
}

export default function FloatingQuickActions() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div ref={ref}>
      <div aria-hidden="true" className={`fixed inset-0 z-[35] bg-slate-900/25 backdrop-blur-[2px] transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />

      <div className="fixed bottom-5 right-4 z-40 h-12 w-12 sm:bottom-6 sm:right-6">
        <div role="menu" aria-label="Quick actions" className="absolute inset-0">
          {actions.map(({ href, label, icon: Icon, color }, index) => {
            const { x, y } = arc(index);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                aria-label={label}
                title={label}
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  left: (48 - CIRCLE) / 2,
                  top: (48 - CIRCLE) / 2,
                  transform: open ? `translate(${x}px, ${y}px) scale(1)` : 'translate(0, 0) scale(0.3)',
                  transitionDelay: open ? `${index * 35}ms` : '0ms',
                }}
                className={`group absolute flex items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg transition-all duration-300 ease-out hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${color} ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
              >
                <Icon aria-hidden="true" size={20} />
                <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-md ring-1 ring-slate-900/5">{label}</span>
              </Link>
            );
          })}
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          aria-expanded={open}
          title="Quick actions"
          className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-600/40 transition hover:scale-105 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95"
        >
          <Plus aria-hidden="true" size={24} strokeWidth={2.6} className={`transition-transform duration-300 ${open ? 'rotate-[135deg]' : ''}`} />
        </button>
      </div>
    </div>
  );
}
