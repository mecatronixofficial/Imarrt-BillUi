'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 400);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      title="Scroll to top"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-[4.75rem] right-[1.125rem] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl shadow-slate-950/25 transition-all duration-200 hover:-translate-y-1 hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:bottom-[5.5rem] sm:right-[1.625rem] ${visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <ArrowUp aria-hidden="true" size={18} strokeWidth={2.5} />
    </button>
  );
}
