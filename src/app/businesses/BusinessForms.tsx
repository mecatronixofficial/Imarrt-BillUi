"use client";

import { type FormEvent, type ReactNode, useState } from "react";

import Modal from "@/components/Modal";
import { api, getApiError } from "@/lib/api";
import { useGeneralPreferences } from "@/lib/useGeneralPreferences";

import type { Business, WorkspaceBranch } from "@/types";

/* ========================================================================== */
/* COMPANY FORM (create + edit)                                               */
/* ========================================================================== */

export function BusinessFormModal({
  business,
  branch,
  onClose,
  onSaved,
}: {
  /** When provided the modal edits this company instead of creating one. */
  business?: Business;
  /** New companies inherit this selected logical branch. */
  branch?: Pick<WorkspaceBranch, "id" | "name" | "code">;
  onClose: () => void;
  onSaved: (business: Business) => void;
}) {
  const editing = Boolean(business);
  const { tinNumber: showTin } = useGeneralPreferences();

  const [form, setForm] = useState({
    name: business?.name ?? "",
    legalName: business?.legalName ?? "",
    gstRegistered: business?.gstRegistered ?? true,
    gstin: business?.gstin ?? "",
    address: business?.address ?? "",
    stateCode: business?.stateCode ?? "",
    tin: business?.tin ?? "",
    phone: business?.phone ?? "",
    email: business?.email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    // Creating omits blank fields; editing sends null so a value can be cleared.
    const blank = editing ? null : undefined;
    const text = (value: string) => value.trim() || blank;

    const payload = {
      name: form.name.trim(),
      legalName: text(form.legalName),
      gstRegistered: form.gstRegistered,
      gstin: form.gstRegistered ? form.gstin.trim().toUpperCase() : blank,
      address: text(form.address),
      stateCode: text(form.stateCode),
      ...(showTin ? { tin: form.tin.trim().toUpperCase() || blank } : {}),
      phone: text(form.phone),
      email: form.email.trim() ? form.email.trim().toLowerCase() : blank,
      ...(!editing && branch
        ? { workspaceBranchId: branch.id }
        : {}),
    };

    try {
      const { data } = business
        ? await api.patch<Business>(`/businesses/${business.id}`, payload)
        : await api.post<Business>("/businesses", payload);
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, editing ? "Could not update company." : "Could not create company."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit company" : "Add company"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <ModalError message={error} />}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" aria-pressed={form.gstRegistered} onClick={() => update("gstRegistered", true)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${form.gstRegistered ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
            GST registered
          </button>
          <button type="button" aria-pressed={!form.gstRegistered} onClick={() => setForm((current) => ({ ...current, gstRegistered: false, gstin: "" }))} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${!form.gstRegistered ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>
            Without GST
          </button>
        </div>

        <ModalField id="business-name" label="Business name *">
          <input id="business-name" required autoFocus maxLength={120} className="input-field" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Sunrise Traders" />
        </ModalField>
        <ModalField id="business-legal-name" label="Legal name">
          <input id="business-legal-name" maxLength={160} className="input-field" value={form.legalName} onChange={(event) => update("legalName", event.target.value)} />
        </ModalField>

        {form.gstRegistered && (
          <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
            <ModalField id="business-gstin" label="GSTIN *">
              <input
                id="business-gstin"
                required
                minLength={15}
                maxLength={15}
                pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
                title="15-character GSTIN, e.g. 22AAAAA0000A1Z5"
                className="input-field uppercase"
                value={form.gstin}
                onChange={(event) => {
                  const gstin = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  setForm((current) => ({
                    ...current,
                    gstin,
                    stateCode: /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : current.stateCode,
                  }));
                }}
                placeholder="22AAAAA0000A1Z5"
              />
            </ModalField>
            <ModalField id="business-state" label="State code">
              <input id="business-state" inputMode="numeric" pattern="\d{2}" title="Two digit state code" maxLength={2} className="input-field" value={form.stateCode} onChange={(event) => update("stateCode", event.target.value.replace(/\D/g, ""))} placeholder="22" />
            </ModalField>
          </div>
        )}

        {showTin && (
          <ModalField id="business-tin" label="TIN number">
            <input id="business-tin" maxLength={20} pattern="[A-Za-z0-9-]{4,20}" title="4-20 letters, numbers, or hyphens" className="input-field uppercase" value={form.tin} onChange={(event) => update("tin", event.target.value.replace(/\s/g, "").toUpperCase())} placeholder="Tax identification number" />
          </ModalField>
        )}

        <ModalField id="business-address" label="Business address">
          <textarea id="business-address" rows={2} maxLength={1000} className="input-field resize-none" value={form.address} onChange={(event) => update("address", event.target.value)} />
        </ModalField>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModalField id="business-phone" label="Phone">
            <input id="business-phone" type="tel" maxLength={20} className="input-field" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          </ModalField>
          <ModalField id="business-email" label="Email">
            <input id="business-email" type="email" maxLength={160} className="input-field" value={form.email} onChange={(event) => update("email", event.target.value)} />
          </ModalField>
        </div>

        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
          {form.gstRegistered
            ? "GST invoices will include tax rates and your GSTIN."
            : "Tax will be fixed at 0% and invoices will be marked non-GST."}
          {!editing && (
            branch
              ? ` This company will be added to ${branch.name} (${branch.code}).`
              : " A Main Branch is created automatically."
          )}
        </p>
        <ModalActions saving={saving} onClose={onClose} label={editing ? "Save changes" : "Create company"} busyLabel={editing ? "Saving..." : "Creating..."} />
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/* BRANCH FORM (create + edit)                                                */
/* ========================================================================== */

export function BranchFormModal({
  branch,
  onClose,
  onSaved,
}: {
  /** When provided the modal edits this branch instead of creating one. */
  branch?: WorkspaceBranch;
  onClose: () => void;
  onSaved: (branch: WorkspaceBranch) => void;
}) {
  const editing = Boolean(branch);

  const [form, setForm] = useState({
    name: branch?.name ?? "",
    code: branch?.code ?? "",
    address: branch?.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    const blank = editing ? null : undefined;
    const text = (value: string) => value.trim() || blank;

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: text(form.address),
    };

    try {
      const { data } = branch
        ? await api.patch<WorkspaceBranch>(`/workspace-branches/${branch.id}`, payload)
        : await api.post<WorkspaceBranch>("/workspace-branches", payload);
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, editing ? "Could not update branch." : "Could not create branch."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit branch" : "Add branch"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <ModalError message={error} />}
        <ModalField id="branch-name" label="Branch name *">
          <input id="branch-name" required autoFocus maxLength={120} className="input-field" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Mumbai Branch" />
        </ModalField>
        <ModalField id="branch-code" label="Branch code *">
          <input id="branch-code" required minLength={2} maxLength={24} pattern="[A-Za-z0-9_\-]{2,24}" title="2-24 letters, numbers, underscores or hyphens" className="input-field uppercase" value={form.code} onChange={(event) => update("code", event.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} placeholder="MUM" />
        </ModalField>
        <ModalField id="branch-address" label="Address">
          <textarea id="branch-address" rows={2} maxLength={1000} className="input-field resize-none" value={form.address} onChange={(event) => update("address", event.target.value)} />
        </ModalField>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
          Use the same branch code in other companies to make them available under one branch. Parties, suppliers, and items are shared by that branch; transactions stay company-specific.
        </p>
        <ModalActions saving={saving} onClose={onClose} label={editing ? "Save changes" : "Create branch"} busyLabel={editing ? "Saving..." : "Creating..."} />
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/* SHARED PIECES                                                              */
/* ========================================================================== */

function ModalField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  );
}

function ModalError({ message }: { message: string }) {
  return <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</div>;
}

function ModalActions({ saving, onClose, label, busyLabel }: { saving: boolean; onClose: () => void; label: string; busyLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
      <button type="submit" disabled={saving} className="btn-primary min-w-32">{saving ? busyLabel : label}</button>
    </div>
  );
}
