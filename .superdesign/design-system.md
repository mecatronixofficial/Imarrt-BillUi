# iMart Billing Design System

## Product context

A desktop-first billing and business-management application for invoices, payments, parties, inventory, purchases, reports, production, teams, and business settings. The persistent dark sidebar and compact top bar frame every operational workspace.

## Visual language

- Keep the existing Inter/system sans typography and slate/white/blue palette.
- Favor crisp, compact operational UI with premium dashboard hierarchy.
- Use white elevated surfaces, slate-200 separators, slate-950 headings, slate-500 secondary copy, and blue-600 selection/action states.
- Use 8–16px radii, subtle borders, and restrained shadows.
- Dashboard hero panels may use the established slate-950 to blue-950 treatment with subtle blue radial lighting. Keep gradients limited to these high-level summary surfaces.
- Icons remain Lucide outline icons at 16–20px.

## Dashboard patterns

- Begin major dashboard pages with a compact dark hero summarizing the workspace, reporting period, and primary actions.
- Follow with four KPI cards using blue, emerald, amber, or violet semantic accents.
- Use dense white operational panels for charts, recent activity, status distribution, shortcuts, and ranked lists.
- Charts should be clear and lightweight, with labels visible without hover-only interactions.
- Search controls use a white rounded input with a leading Search icon and immediate filtering.
- Preserve strong mobile behavior: stack panels, keep actions reachable, and allow tables to scroll only when necessary.

## Sales dashboard requirements

- The `/sales` route is the sales command center reached by selecting Sale in the sidebar.
- Provide prominent global sales search across invoice number, customer, workflow name, and status.
- Include net sales, amount collected, outstanding receivables, and active orders/quotations.
- Surface a six-month sales trend, payment status breakdown, top customers, recent invoices, and overdue/collection attention items.
- Keep direct shortcuts for invoices, quotations, proforma invoices, payment-in, sale orders, delivery challans, and returns.
- Include clear links to the full Reports workspace and invoice creation.

## Command-menu requirements

- Center a desktop-style palette within the viewport rather than occupying the whole screen.
- The page and modal must not scroll vertically. The palette must fit within the viewport at common laptop heights.
- Use compact category tabs or segmented controls so only one group is displayed at a time; avoid a long stacked list.
- Render the active group's commands in a dense two- or three-column grid with concise labels and descriptions.
- Search results may replace the grouped view and should remain within the fixed palette bounds.
- Preserve Ctrl/Cmd+K, arrow keys, Home/End, Enter, Escape, current-route state, and accessible combobox/listbox semantics.
- On narrow mobile screens, fit inside viewport padding and use a compact single-column result area without page-level scrolling.
- Motion should be limited to fast color, opacity, and subtle scale transitions and respect reduced motion.
