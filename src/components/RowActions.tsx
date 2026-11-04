"use client";

import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  Ban,
  Copy,
  Download,
  Eye,
  IndianRupee,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { MenuButton, MenuLink, Popover } from "@/components/PopoverMenu";

/** The same verbs use the same icons in every register. */
export const ACTION_ICONS = {
  view: <Eye size={15} />,
  edit: <Pencil size={15} />,
  duplicate: <Copy size={15} />,
  print: <Printer size={15} />,
  download: <Download size={15} />,
  whatsapp: <MessageCircle size={15} />,
  email: <Mail size={15} />,
  send: <Send size={15} />,
  convert: <ArrowRightLeft size={15} />,
  payment: <IndianRupee size={15} />,
  undo: <Undo2 size={15} />,
  restore: <RotateCcw size={15} />,
  cancel: <Ban size={15} />,
  delete: <Trash2 size={15} />,
} as const;

export type RowAction = {
  label: string;
  icon?: keyof typeof ACTION_ICONS | ReactNode;
  /** A link; `external` opens it in a new tab (WhatsApp, mail). */
  href?: string;
  external?: boolean;
  onClick?: () => void;
  /** Destructive actions are shown in red, after a divider. */
  danger?: boolean;
};

/**
 * A row's ⋮ menu. Falsy entries are skipped, so callers can write
 * `canDelete && { label: "Delete", ... }`.
 */
export default function RowActions({ label, actions }: { label: string; actions: Array<RowAction | false | null | undefined> }) {
  const items = actions.filter((action): action is RowAction => Boolean(action));
  if (!items.length) return null;
  const safe = items.filter((action) => !action.danger);
  const danger = items.filter((action) => action.danger);
  const icon = (value: RowAction["icon"]) => (typeof value === "string" && value in ACTION_ICONS ? ACTION_ICONS[value as keyof typeof ACTION_ICONS] : value);
  const render = (action: RowAction, close: () => void) =>
    action.href ? (
      <MenuLink key={action.label} icon={icon(action.icon)} href={action.href} external={action.external} onClick={close}>{action.label}</MenuLink>
    ) : (
      <MenuButton key={action.label} icon={icon(action.icon)} danger={action.danger} onClick={() => { close(); action.onClick?.(); }}>{action.label}</MenuButton>
    );
  return (
    <Popover
      label={label}
      align="right"
      trigger={(open) => (
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100 hover:text-slate-800 ${open ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>
          <MoreVertical size={16} />
        </span>
      )}
    >
      {(close) => (
        <div role="menu" className="w-56 py-1">
          {safe.map((action) => render(action, close))}
          {safe.length > 0 && danger.length > 0 && <div role="separator" className="my-1 border-t border-slate-100" />}
          {danger.map((action) => render(action, close))}
        </div>
      )}
    </Popover>
  );
}
