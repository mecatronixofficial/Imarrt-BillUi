# Vyapar Clone Design System

## Product context

A desktop-first billing and business-management application for invoices, payments, parties, inventory, purchases, reports, production, teams, and business settings. The command menu is a high-frequency keyboard-accessible launcher used from the persistent app shell.

## Visual language

- Keep the existing Inter/system sans typography and slate/white/blue palette.
- Favor crisp, compact operational UI over decorative dashboard styling.
- Use white elevated surfaces, slate-200 separators, slate-950 headings, slate-500 secondary copy, and blue-600 selection/action states.
- Use 8–16px radii, subtle borders, restrained shadows, and no gradients.
- Icons remain Lucide outline icons at 16–20px.

## Command-menu requirements

- Center a desktop-style palette within the viewport rather than occupying the whole screen.
- The page and modal must not scroll vertically. The palette must fit within the viewport at common laptop heights.
- Use compact category tabs or segmented controls so only one group is displayed at a time; avoid a long stacked list.
- Render the active group's commands in a dense two- or three-column grid with concise labels and descriptions.
- Search results may replace the grouped view and should remain within the fixed palette bounds.
- Preserve Ctrl/Cmd+K, arrow keys, Home/End, Enter, Escape, current-route state, and accessible combobox/listbox semantics.
- On narrow mobile screens, fit inside viewport padding and use a compact single-column result area without page-level scrolling.
- Motion should be limited to fast color, opacity, and subtle scale transitions and respect reduced motion.
