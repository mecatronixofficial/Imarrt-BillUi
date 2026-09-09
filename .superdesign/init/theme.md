# Theme

## Compact token summary

- Framework: Tailwind CSS 3.4 with a custom `brand` blue scale.
- Font: Inter with system sans-serif fallbacks.
- Base canvas: slate-50 (`#f8fafc`); primary text: slate-900 (`#0f172a`).
- Surfaces: white with slate-200 borders; focus and primary actions use blue/brand 500–700.
- Radius: mostly `rounded-lg` (8px), `rounded-xl` (12px), and `rounded-2xl` (16px).
- Shadows: restrained `shadow-sm` for cards and `shadow-2xl` for modal surfaces.
- Breakpoints: Tailwind defaults; mobile-first, `sm` and `md` are the main UI transitions.
- Motion: short color/background transitions; reduced-motion media query disables animation.

## Raw sources

Complete theme sources are in `tailwind.config.ts` and `src/app/globals.css`. Both are under the payload threshold and should be supplied in full to design generation.
