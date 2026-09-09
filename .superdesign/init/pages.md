# Key Page Dependency Trees

## Command palette (shared feature)
Entry: `src/components/CommandMenu.tsx`
Dependencies:
- `src/components/Modal.tsx`
- `src/components/Sidebar.tsx`
  - `src/components/CommandMenu.tsx`
- `src/components/AppFrame.tsx`
  - `src/components/Sidebar.tsx`
- `src/app/globals.css`
- `tailwind.config.ts`

## /dashboard
Entry: `src/app/dashboard/page.tsx`
Dependencies:
- `src/components/AppFrame.tsx`
  - `src/components/Sidebar.tsx`
    - `src/components/CommandMenu.tsx`
      - `src/components/Modal.tsx`
- `src/components/DashboardShell.tsx`
- `src/app/globals.css`

## /settings
Entry: `src/app/settings/page.tsx`
Dependencies:
- `src/components/AppFrame.tsx`
  - `src/components/Sidebar.tsx`
    - `src/components/CommandMenu.tsx`
      - `src/components/Modal.tsx`
- `src/app/globals.css`
