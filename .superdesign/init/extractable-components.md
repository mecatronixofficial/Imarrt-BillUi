# Extractable Components

## Sidebar
- Source: `src/components/Sidebar.tsx`
- Category: layout
- Description: Primary application navigation shell containing the quick-search trigger.
- Extractable props: compact state and active route.
- Hardcoded: navigation labels, icons, Tailwind classes.

## CommandMenu
- Source: `src/components/CommandMenu.tsx`
- Category: basic
- Description: Searchable keyboard-first route and action palette.
- Extractable props: `compact` (boolean, default false).
- Hardcoded: command definitions, labels, route URLs, icons, keyboard behavior.

## Modal
- Source: `src/components/Modal.tsx`
- Category: basic
- Description: Accessible portal dialog shell with four sizes.
- Extractable props: title, size.
- Hardcoded: focus trap, overlay treatment, close affordance.
