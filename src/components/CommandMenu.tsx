'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  Building2,
  CircleDollarSign,
  FilePlus2,
  Files,
  Factory,
  Landmark,
  LayoutDashboard,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import Modal from './Modal';

type CommandGroup = 'Create' | 'Navigate' | 'Manage';

type Command = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: CommandGroup;
  keywords?: string;
};

const COMMANDS: Command[] = [
  {
    href: '/invoices/new',
    label: 'Create Invoice',
    description: 'Create a new customer sales invoice',
    icon: FilePlus2,
    group: 'Create',
    keywords: 'new bill sale',
  },
  {
    href: '/sales/payment-in',
    label: 'Payment In',
    description: 'Record money received from customers',
    icon: ArrowDownToLine,
    group: 'Create',
    keywords: 'receipt collection',
  },
  {
    href: '/purchases/payment-out',
    label: 'Payment Out',
    description: 'Record outgoing business payments',
    icon: ArrowUpFromLine,
    group: 'Create',
    keywords: 'expense supplier',
  },

  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'View your complete business overview',
    icon: LayoutDashboard,
    group: 'Navigate',
  },
  {
    href: '/parties',
    label: 'Parties',
    description: 'Manage customers and suppliers',
    icon: Users,
    group: 'Navigate',
  },
  {
    href: '/items',
    label: 'Items',
    description: 'Products, services and inventory',
    icon: Package,
    group: 'Navigate',
    keywords: 'inventory stock',
  },
  {
    href: '/sales',
    label: 'Sales',
    description: 'Invoices, estimates and sales orders',
    icon: CircleDollarSign,
    group: 'Navigate',
  },
  {
    href: '/purchases',
    label: 'Purchases',
    description: 'Bills, expenses and purchase orders',
    icon: ShoppingCart,
    group: 'Navigate',
  },
  {
    href: '/documents',
    label: 'Documents',
    description: 'Quotes, returns and delivery challans',
    icon: Files,
    group: 'Navigate',
  },
  {
    href: '/cash-banks',
    label: 'Cash & Banks',
    description: 'Manage accounts and payment details',
    icon: Landmark,
    group: 'Navigate',
  },
  {
    href: '/production',
    label: 'Production',
    description: 'Track garment production workflow',
    icon: Factory,
    group: 'Navigate',
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'Sales, finance and inventory insights',
    icon: BarChart3,
    group: 'Navigate',
  },

  {
    href: '/businesses',
    label: 'Companies & Branches',
    description: 'Choose and manage business workspaces',
    icon: Building2,
    group: 'Manage',
    keywords: 'business branch company',
  },
  {
    href: '/team',
    label: 'Team',
    description: 'Members, roles and permissions',
    icon: Users,
    group: 'Manage',
  },
  {
    href: '/security',
    label: 'Security',
    description: 'Account security and MFA protection',
    icon: ShieldCheck,
    group: 'Manage',
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Configure business preferences',
    icon: Settings,
    group: 'Manage',
  },
];

const GROUP_INFO: Record<
  CommandGroup,
  {
    title: string;
    subtitle: string;
  }
> = {
  Create: {
    title: 'Quick Create',
    subtitle: 'Start a transaction',
  },
  Navigate: {
    title: 'Business',
    subtitle: 'Open a module',
  },
  Manage: {
    title: 'Management',
    subtitle: 'Workspace settings',
  },
};

export default function CommandMenu({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const searchId = useId();
  const listId = useId();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setQuery('');
    setActiveIndex(0);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return COMMANDS;

    return COMMANDS.filter(
      ({ label, description, keywords, group }) =>
        `${label} ${description} ${keywords ?? ''} ${group}`
          .toLowerCase()
          .includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const activeOption =
      listRef.current?.querySelector<HTMLElement>(
        `[data-command-index="${activeIndex}"]`,
      );

    activeOption?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeIndex]);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');

    if (href !== pathname) {
      router.push(href);
    }
  }

  const grouped = useMemo(
    () =>
      (['Create', 'Navigate', 'Manage'] as CommandGroup[])
        .map((group) => ({
          group,
          commands: results.filter(
            (command) => command.group === group,
          ),
        }))
        .filter(({ commands }) => commands.length > 0),
    [results],
  );

  return (
    <>
      {/* SEARCH TRIGGER */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Open quick navigation"
        title={
          compact ? 'Quick navigation (Ctrl + K)' : undefined
        }
        className={
          compact
            ? `
              group
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              border border-slate-200
              bg-white
              text-slate-600
              shadow-sm
              transition-all
              duration-200
              hover:-translate-y-0.5
              hover:border-slate-300
              hover:bg-slate-950
              hover:text-white
              hover:shadow-md
              focus-visible:outline-none
              focus-visible:ring-4
              focus-visible:ring-slate-200
            `
            : `
              group
              flex h-11 w-full
              max-w-[340px]
              items-center
              gap-3
              rounded-xl
              border border-slate-200
              bg-white
              px-3.5
              text-left
              shadow-sm
              transition-all
              duration-200
              hover:border-slate-300
              hover:shadow-md
              focus-visible:outline-none
              focus-visible:ring-4
              focus-visible:ring-slate-100
            `
        }
      >
        <span
          className={`
            flex shrink-0
            items-center justify-center
            rounded-lg
            transition
            ${
              compact
                ? ''
                : 'h-7 w-7 bg-slate-100 group-hover:bg-slate-900 group-hover:text-white'
            }
          `}
        >
          <Search
            aria-hidden="true"
            size={compact ? 18 : 15}
          />
        </span>

        {!compact && (
          <>
            <span className="flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Quick Search
              </span>

              <span className="block text-[13px] font-bold text-slate-800">
                Search pages & actions
              </span>
            </span>

            <kbd
              className="
                hidden
                rounded-lg
                border border-slate-200
                bg-slate-50
                px-2
                py-1
                font-sans
                text-[10px]
                font-extrabold
                text-slate-500
                shadow-sm
                sm:inline-flex
              "
            >
              Ctrl K
            </kbd>
          </>
        )}
      </button>

      {/* COMMAND MODAL */}
      {open && (
        <Modal
          title="Quick Navigation"
          onClose={() => setOpen(false)}
          size="full"
          initialFocusRef={inputRef}
          className="
            flex
            flex-col
            overflow-hidden
            [&>div:last-child]:flex
            [&>div:last-child]:min-h-0
            [&>div:last-child]:flex-1
            [&>div:last-child]:flex-col
            [&>div:last-child]:p-0
          "
        >
          {/* TOP DARK AREA */}
          <div
            className="
              relative
              shrink-0
              overflow-hidden
              bg-slate-950
              px-5
              pb-7
              pt-6
              sm:px-8
              sm:pb-8
              sm:pt-8
            "
          >
            {/* background decoration */}
            <div
              className="
                pointer-events-none
                absolute
                -right-20
                -top-32
                h-80
                w-80
                rounded-full
                bg-blue-500/10
                blur-3xl
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                -bottom-40
                left-1/4
                h-72
                w-72
                rounded-full
                bg-violet-500/10
                blur-3xl
              "
            />

            <div className="relative mx-auto w-full max-w-6xl">
              {/* HEADING */}
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div
                    className="
                      mb-2
                      inline-flex
                      items-center
                      gap-2
                      rounded-full
                      border border-white/10
                      bg-white/5
                      px-3
                      py-1
                    "
                  >
                    <Sparkles
                      size={13}
                      className="text-blue-400"
                    />

                    <span
                      className="
                        text-[10px]
                        font-extrabold
                        uppercase
                        tracking-[0.16em]
                        text-slate-300
                      "
                    >
                      Command Center
                    </span>
                  </div>

                  <h2
                    className="
                      text-2xl
                      font-black
                      tracking-[-0.04em]
                      text-white
                      sm:text-3xl
                    "
                  >
                    What do you want to do?
                  </h2>

                  <p className="mt-1.5 text-sm font-medium text-slate-400">
                    Search and quickly access any business
                    module.
                  </p>
                </div>

                <div
                  className="
                    hidden
                    items-center
                    gap-2
                    rounded-xl
                    border border-white/10
                    bg-white/5
                    px-3
                    py-2
                    text-xs
                    font-bold
                    text-slate-400
                    md:flex
                  "
                >
                  <span>{COMMANDS.length}</span>
                  <span>Actions</span>
                </div>
              </div>

              {/* SEARCH */}
              <label
                htmlFor={searchId}
                className="sr-only"
              >
                Search pages and actions
              </label>

              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={22}
                  strokeWidth={2.5}
                  className="
                    absolute
                    left-5
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  ref={inputRef}
                  id={searchId}
                  role="combobox"
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-activedescendant={
                    results[activeIndex]
                      ? `${listId}-${activeIndex}`
                      : undefined
                  }
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();

                      setActiveIndex((index) =>
                        results.length
                          ? (index + 1) % results.length
                          : 0,
                      );
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault();

                      setActiveIndex((index) =>
                        results.length
                          ? (index - 1 + results.length) %
                            results.length
                          : 0,
                      );
                    }

                    if (event.key === 'Home') {
                      event.preventDefault();
                      setActiveIndex(0);
                    }

                    if (event.key === 'End') {
                      event.preventDefault();

                      setActiveIndex(
                        Math.max(0, results.length - 1),
                      );
                    }

                    if (
                      event.key === 'Escape' &&
                      query
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      setQuery('');
                    }

                    if (
                      event.key === 'Enter' &&
                      results[activeIndex]
                    ) {
                      event.preventDefault();
                      navigate(results[activeIndex].href);
                    }
                  }}
                  className="
                    h-[64px]
                    w-full
                    rounded-2xl
                    border
                    border-white/10
                    bg-white
                    pl-14
                    pr-28
                    text-[15px]
                    font-bold
                    text-slate-950
                    shadow-[0_18px_50px_rgba(0,0,0,0.25)]
                    outline-none
                    transition-all
                    placeholder:font-medium
                    placeholder:text-slate-400
                    focus:border-blue-400
                    focus:ring-4
                    focus:ring-blue-500/20
                  "
                  placeholder="Search dashboard, invoice, production, reports..."
                  autoComplete="off"
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    right-4
                    top-1/2
                    hidden
                    -translate-y-1/2
                    items-center
                    gap-1.5
                    sm:flex
                  "
                >
                  <kbd
                    className="
                      rounded-md
                      border border-slate-200
                      bg-slate-100
                      px-2
                      py-1
                      text-[10px]
                      font-black
                      text-slate-500
                    "
                  >
                    ↑↓
                  </kbd>

                  <kbd
                    className="
                      rounded-md
                      border border-slate-200
                      bg-slate-100
                      px-2
                      py-1
                      text-[10px]
                      font-black
                      text-slate-500
                    "
                  >
                    Enter
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* COMMAND CONTENT */}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Navigation results"
            className="
              min-h-0
              flex-1
              overflow-y-auto
              bg-[#f6f7f9]
              px-4
              py-5
              sm:px-7
              sm:py-7
            "
          >
            <div className="mx-auto w-full max-w-6xl">
              {results.length > 0 && (
                <div
                  className="
                    grid
                    items-start
                    gap-5
                    lg:grid-cols-3
                  "
                >
                  {grouped.map(
                    ({ group, commands }) => {
                      const groupInfo =
                        GROUP_INFO[group];

                      return (
                        <section
                          key={group}
                          className="
                            overflow-hidden
                            rounded-[20px]
                            border
                            border-slate-200/80
                            bg-white
                            shadow-[0_8px_28px_rgba(15,23,42,0.06)]
                          "
                        >
                          {/* GROUP HEADING */}
                          <div
                            className="
                              flex
                              items-center
                              justify-between
                              border-b
                              border-slate-100
                              px-4
                              py-4
                            "
                          >
                            <div>
                              <p
                                className="
                                  text-[15px]
                                  font-black
                                  tracking-[-0.02em]
                                  text-slate-900
                                "
                              >
                                {groupInfo.title}
                              </p>

                              <p
                                className="
                                  mt-0.5
                                  text-[11px]
                                  font-semibold
                                  text-slate-400
                                "
                              >
                                {groupInfo.subtitle}
                              </p>
                            </div>

                            <span
                              className="
                                flex
                                h-7
                                min-w-7
                                items-center
                                justify-center
                                rounded-lg
                                bg-slate-100
                                px-2
                                text-[10px]
                                font-black
                                text-slate-500
                              "
                            >
                              {commands.length}
                            </span>
                          </div>

                          {/* COMMANDS */}
                          <div className="p-2">
                            {commands.map(
                              (command) => {
                                const index =
                                  results.indexOf(
                                    command,
                                  );

                                const Icon =
                                  command.icon;

                                const selected =
                                  index === activeIndex;

                                const current =
                                  pathname ===
                                  command.href;

                                return (
                                  <button
                                    id={`${listId}-${index}`}
                                    data-command-index={
                                      index
                                    }
                                    role="option"
                                    aria-selected={
                                      selected
                                    }
                                    key={command.href}
                                    type="button"
                                    onMouseEnter={() =>
                                      setActiveIndex(
                                        index,
                                      )
                                    }
                                    onClick={() =>
                                      navigate(
                                        command.href,
                                      )
                                    }
                                    className={`
                                      group
                                      relative
                                      flex
                                      w-full
                                      items-center
                                      gap-3
                                      rounded-2xl
                                      border
                                      px-3
                                      py-3
                                      text-left
                                      transition-all
                                      duration-200
                                      focus-visible:outline-none
                                      focus-visible:ring-4
                                      focus-visible:ring-blue-100

                                      ${
                                        selected
                                          ? `
                                            border-slate-900
                                            bg-slate-950
                                            shadow-lg
                                            shadow-slate-950/10
                                          `
                                          : `
                                            border-transparent
                                            bg-transparent
                                            hover:border-slate-200
                                            hover:bg-slate-50
                                          `
                                      }
                                    `}
                                  >
                                    {/* ICON */}
                                    <span
                                      className={`
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-xl
                                        transition-all
                                        duration-200

                                        ${
                                          selected
                                            ? `
                                              bg-white
                                              text-slate-950
                                              shadow-sm
                                            `
                                            : `
                                              bg-slate-100
                                              text-slate-600
                                              group-hover:bg-white
                                              group-hover:text-slate-950
                                              group-hover:shadow-sm
                                            `
                                        }
                                      `}
                                    >
                                      <Icon
                                        aria-hidden="true"
                                        size={19}
                                        strokeWidth={
                                          2.3
                                        }
                                      />
                                    </span>

                                    {/* TEXT */}
                                    <span className="min-w-0 flex-1">
                                      <span
                                        className={`
                                          flex
                                          items-center
                                          gap-2
                                          truncate
                                          text-[13px]
                                          font-black
                                          tracking-[-0.01em]

                                          ${
                                            selected
                                              ? 'text-white'
                                              : 'text-slate-900'
                                          }
                                        `}
                                      >
                                        {
                                          command.label
                                        }

                                        {current && (
                                          <span
                                            className={`
                                              rounded-full
                                              px-2
                                              py-0.5
                                              text-[8px]
                                              font-black
                                              uppercase
                                              tracking-wider

                                              ${
                                                selected
                                                  ? 'bg-blue-500 text-white'
                                                  : 'bg-blue-50 text-blue-600'
                                              }
                                            `}
                                          >
                                            Current
                                          </span>
                                        )}
                                      </span>

                                      <span
                                        className={`
                                          mt-1
                                          block
                                          truncate
                                          text-[11px]
                                          font-medium

                                          ${
                                            selected
                                              ? 'text-slate-400'
                                              : 'text-slate-500'
                                          }
                                        `}
                                      >
                                        {
                                          command.description
                                        }
                                      </span>
                                    </span>

                                    {/* ARROW */}
                                    <span
                                      className={`
                                        flex
                                        h-8
                                        w-8
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-lg
                                        transition-all

                                        ${
                                          selected
                                            ? 'bg-white/10 text-white'
                                            : 'text-slate-300 group-hover:bg-white group-hover:text-slate-700 group-hover:shadow-sm'
                                        }
                                      `}
                                    >
                                      <ArrowRight
                                        size={15}
                                        strokeWidth={
                                          2.5
                                        }
                                      />
                                    </span>
                                  </button>
                                );
                              },
                            )}
                          </div>
                        </section>
                      );
                    },
                  )}
                </div>
              )}

              {/* EMPTY SEARCH */}
              {results.length === 0 && (
                <div
                  className="
                    mx-auto
                    flex
                    min-h-[320px]
                    max-w-xl
                    flex-col
                    items-center
                    justify-center
                    rounded-3xl
                    border
                    border-dashed
                    border-slate-300
                    bg-white
                    px-6
                    text-center
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex
                      h-14
                      w-14
                      items-center
                      justify-center
                      rounded-2xl
                      bg-slate-100
                      text-slate-400
                    "
                  >
                    <ReceiptText
                      aria-hidden="true"
                      size={24}
                    />
                  </div>

                  <p
                    className="
                      mt-4
                      text-lg
                      font-black
                      tracking-tight
                      text-slate-900
                    "
                  >
                    No matching action
                  </p>

                  <p
                    className="
                      mt-1
                      max-w-sm
                      text-sm
                      font-medium
                      leading-6
                      text-slate-500
                    "
                  >
                    We couldn&apos;t find anything for
                    &quot;{query}&quot;. Try invoice,
                    sales, production or reports.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM HELP BAR */}
          <div
            className="
              shrink-0
              border-t
              border-slate-200
              bg-white
              px-5
              py-3
            "
          >
            <div
              className="
                mx-auto
                flex
                w-full
                max-w-6xl
                items-center
                justify-between
                gap-4
                text-[10px]
                font-bold
                text-slate-400
              "
            >
              <span>
                Quick navigation across your business
              </span>

              <div className="hidden items-center gap-3 sm:flex">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                    ↑
                  </kbd>
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                    ↓
                  </kbd>
                  Navigate
                </span>

                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                    Enter
                  </kbd>
                  Open
                </span>

                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                    Esc
                  </kbd>
                  Close
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}