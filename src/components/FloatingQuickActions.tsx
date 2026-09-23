'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Factory, Package, Plus, ReceiptText, ShoppingCart, Users } from 'lucide-react';

/**
 * One floating button in the bottom-right corner.
 * Its five options fan out as round buttons along a quarter arc:
 * first option on the left and last option directly above.
 */

const actions = [
  {
    href: '/production',
    label: 'Production',
    icon: Factory,
  },
  {
    href: '/invoices',
    label: 'Invoice',
    icon: ReceiptText,
  },
  {
    href: '/purchases',
    label: 'Purchase',
    icon: ShoppingCart,
  },
  {
    href: '/items',
    label: 'Items',
    icon: Package,
  },
  {
    href: '/parties',
    label: 'Parties',
    icon: Users,
  },
] as const;

const RADIUS = 132;
const CIRCLE = 48;
const MAIN_BUTTON_SIZE = 48;

/**
 * Calculates each quick action position
 * along a 90-degree quarter circle.
 */
function arc(index: number) {
  const angle =
    (index / (actions.length - 1)) * (Math.PI / 2);

  return {
    x: -Math.cos(angle) * RADIUS,
    y: -Math.sin(angle) * RADIUS,
  };
}

export default function FloatingQuickActions() {
  const [open, setOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (event: PointerEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutside,
      );
      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [open]);

  return (
    <div ref={ref}>
      {/* Background overlay */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[35] bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Floating action area */}
      <div className="fixed bottom-5 right-4 z-40 h-12 w-12 sm:bottom-6 sm:right-6">
        {/* Quick action buttons */}
        <div
          role="menu"
          aria-label="Quick actions"
          className="absolute inset-0"
        >
          {actions.map(
            ({ href, label, icon: Icon }, index) => {
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
                    left:
                      (MAIN_BUTTON_SIZE - CIRCLE) / 2,
                    top:
                      (MAIN_BUTTON_SIZE - CIRCLE) / 2,
                    transform: open
                      ? `translate(${x}px, ${y}px) scale(1)`
                      : 'translate(0px, 0px) scale(0.3)',
                    transitionDelay: open
                      ? `${index * 35}ms`
                      : '0ms',
                  }}
                  className={`group absolute flex items-center justify-center rounded-full border border-white/15 bg-slate-900/95 text-slate-100 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.9)] backdrop-blur-md transition-all duration-300 ease-out hover:scale-110 hover:border-blue-400/70 hover:bg-blue-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                    open
                      ? 'visible opacity-100'
                      : 'invisible opacity-0'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    size={20}
                    strokeWidth={2}
                  />

                  <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white [text-shadow:0_1px_4px_rgba(15,23,42,0.9)]">
                    {label}
                  </span>
                </Link>
              );
            },
          )}
        </div>

        {/* Main floating button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() =>
            setOpen((current) => !current)
          }
          aria-label={
            open
              ? 'Close quick actions'
              : 'Open quick actions'
          }
          aria-expanded={open}
          title="Quick actions"
          className="absolute inset-0 flex items-center justify-center rounded-full border border-blue-400/40 bg-blue-600 text-white shadow-[0_10px_30px_-8px_rgba(37,99,235,0.65)] transition duration-200 hover:scale-105 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95"
        >
          <Plus
            aria-hidden="true"
            size={24}
            strokeWidth={2.6}
            className={`transition-transform duration-300 ${
              open ? 'rotate-[135deg]' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}
