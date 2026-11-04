"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

const menuItemClass = "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition";

export function MenuButton({ icon, danger, onClick, children }: { icon?: ReactNode; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`${menuItemClass} ${danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
      {icon}
      {children}
    </button>
  );
}

export function MenuLink({ icon, href, external, onClick, children }: { icon?: ReactNode; href: string; external?: boolean; onClick: () => void; children: ReactNode }) {
  const className = `${menuItemClass} text-slate-700 hover:bg-slate-50`;
  return external ? (
    <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>{icon}{children}</a>
  ) : (
    <Link role="menuitem" href={href} onClick={onClick} className={className}>{icon}{children}</Link>
  );
}

/**
 * A button that opens a floating panel. The panel is fixed-positioned so the
 * table's horizontal scroll container can't clip it.
 */
export function Popover({ label, trigger, align = "left", children }: { label: string; trigger: (open: boolean) => ReactNode; align?: "left" | "right"; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const below = rect.bottom + 4;
    const top = below + panelHeight > window.innerHeight - 8 && rect.top - panelHeight - 4 > 8 ? rect.top - panelHeight - 4 : below;
    setPosition(align === "right" ? { top, right: Math.max(8, window.innerWidth - rect.right) } : { top, left: Math.max(8, rect.left) });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return (
    <>
      <button ref={buttonRef} type="button" title={label} aria-label={label} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="h-full">
        {trigger(open)}
      </button>
      {open && (
        <div ref={panelRef} style={{ position: "fixed", ...position }} className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white text-left normal-case tracking-normal shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
          {children(close)}
        </div>
      )}
    </>
  );
}
