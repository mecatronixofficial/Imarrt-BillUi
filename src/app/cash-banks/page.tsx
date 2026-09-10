"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Landmark,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import {
  getActiveBusinessId,
} from "@/lib/api";

import {
  formatCurrency,
} from "@/lib/format";

import {
  loadEncrypted,
  saveEncrypted,
} from "@/lib/encryptedStorage";

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

type AccountType =
  | "CURRENT"
  | "SAVINGS"
  | "CASH_CREDIT"
  | "OVERDRAFT";

type BankAccount = {
  id: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: AccountType;
  upiId: string;
  openingBalance: number;
  primary: boolean;
  updatedAt: string;
};

type BankForm = Omit<
  BankAccount,
  "id" | "updatedAt" | "openingBalance"
> & {
  openingBalance: string;
};

/* ========================================================================== */
/* CONSTANTS                                                                  */
/* ========================================================================== */

const EMPTY_FORM: BankForm = {
  accountHolder: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  branch: "",
  accountType: "CURRENT",
  upiId: "",
  openingBalance: "0",
  primary: false,
};

const ACCOUNT_LABELS: Record<
  AccountType,
  string
> = {
  CURRENT: "Current account",
  SAVINGS: "Savings account",
  CASH_CREDIT: "Cash credit",
  OVERDRAFT: "Overdraft",
};

const storageKey = () =>
  `vyapar:bank-accounts:${
    getActiveBusinessId() ?? "default"
  }`;

const maskAccount = (
  number: string,
) =>
  `•••• •••• ${number.slice(-4)}`;

/* ========================================================================== */
/* PAGE                                                                       */
/* ========================================================================== */

export default function CashBanksPage() {
  const [
    accounts,
    setAccounts,
  ] = useState<BankAccount[]>([]);

  const [
    form,
    setForm,
  ] = useState<BankForm>(
    EMPTY_FORM,
  );

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null,
  );

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    showNumbers,
    setShowNumbers,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  /* ------------------------------------------------------------------------ */
  /* LOAD                                                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true;

    loadEncrypted<
      BankAccount[]
    >(
      storageKey(),
      [],
    )
      .then((saved) => {
        if (active) {
          setAccounts(saved);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* TOTAL                                                                    */
  /* ------------------------------------------------------------------------ */

  const totalBalance =
    useMemo(
      () =>
        accounts.reduce(
          (
            sum,
            account,
          ) =>
            sum +
            account.openingBalance,
          0,
        ),
      [accounts],
    );

  /* ------------------------------------------------------------------------ */
  /* UPDATE FORM                                                              */
  /* ------------------------------------------------------------------------ */

  const updateField = <
    K extends keyof BankForm,
  >(
    field: K,
    value: BankForm[K],
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );

    setError("");
  };

  /* ------------------------------------------------------------------------ */
  /* ADD                                                                      */
  /* ------------------------------------------------------------------------ */

  function startAdd() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      primary:
        accounts.length === 0,
    });

    setShowForm(true);
    setMessage("");
    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* EDIT                                                                     */
  /* ------------------------------------------------------------------------ */

  function startEdit(
    account: BankAccount,
  ) {
    setEditingId(
      account.id,
    );

    setForm({
      ...account,
      openingBalance:
        String(
          account.openingBalance,
        ),
    });

    setShowForm(true);
    setMessage("");
    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* CLOSE                                                                    */
  /* ------------------------------------------------------------------------ */

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* SAVE                                                                     */
  /* ------------------------------------------------------------------------ */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const accountNumber =
      form.accountNumber.replace(
        /\s+/g,
        "",
      );

    const ifsc =
      form.ifsc
        .trim()
        .toUpperCase();

    if (
      !/^\d{9,18}$/.test(
        accountNumber,
      )
    ) {
      return setError(
        "Enter a valid 9 to 18 digit account number.",
      );
    }

    if (
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
        ifsc,
      )
    ) {
      return setError(
        "Enter a valid 11 character IFSC code.",
      );
    }

    const record: BankAccount = {
      ...form,

      id:
        editingId ??
        crypto.randomUUID(),

      accountNumber,

      ifsc,

      accountHolder:
        form.accountHolder.trim(),

      bankName:
        form.bankName.trim(),

      branch:
        form.branch.trim(),

      upiId:
        form.upiId.trim(),

      openingBalance:
        Number(
          form.openingBalance,
        ) || 0,

      updatedAt:
        new Date().toISOString(),
    };

    let next = editingId
      ? accounts.map(
          (account) =>
            account.id ===
            editingId
              ? record
              : account,
        )
      : [
          ...accounts,
          record,
        ];

    if (record.primary) {
      next = next.map(
        (account) => ({
          ...account,
          primary:
            account.id ===
            record.id,
        }),
      );
    }

    setSaving(true);

    try {
      await saveEncrypted(
        storageKey(),
        next,
      );

      setAccounts(next);

      closeForm();

      setMessage(
        editingId
          ? "Bank details updated securely."
          : "Bank account added securely.",
      );
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not securely save bank details.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* REMOVE                                                                   */
  /* ------------------------------------------------------------------------ */

  async function removeAccount(
    account: BankAccount,
  ) {
    if (
      !window.confirm(
        `Remove ${account.bankName} ending in ${account.accountNumber.slice(
          -4,
        )}?`,
      )
    ) {
      return;
    }

    const next =
      accounts.filter(
        ({ id }) =>
          id !== account.id,
      );

    if (
      account.primary &&
      next.length
    ) {
      next[0] = {
        ...next[0],
        primary: true,
      };
    }

    try {
      await saveEncrypted(
        storageKey(),
        next,
      );

      setAccounts(next);

      setMessage(
        "Bank account removed.",
      );
    } catch {
      setError(
        "Could not update encrypted bank details.",
      );
    }
  }

  /* ======================================================================== */
  /* UI                                                                       */
  /* ======================================================================== */

  return (
    <>
      <div className="min-h-screen bg-slate-50/60">
        {/* ================================================================ */}
        {/* PREMIUM HEADER                                                   */}
        {/* ================================================================ */}

        <section
          className="
            relative
            mb-4
            overflow-hidden
            rounded-2xl
            border
            border-blue-100
            bg-gradient-to-r
            from-blue-50
            via-white
            to-cyan-50
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
          "
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 left-[38%] h-40 w-40 rounded-full bg-cyan-100/60 blur-3xl" />

          <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Heading */}

            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-blue-600" />

                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Finance Workspace
                </span>
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Cash & Banks
              </h1>

              <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">
                Manage company bank
                accounts, balances and
                secure payment details
                from one workspace.
              </p>
            </div>

            {/* Action */}

            <button
              type="button"
              onClick={
                startAdd
              }
              className="
                group
                inline-flex
                h-10
                w-fit
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-blue-600
                px-4
                text-[10px]
                font-extrabold
                text-white
                shadow-[0_8px_20px_rgba(37,99,235,0.20)]
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:bg-blue-700
                hover:shadow-[0_12px_28px_rgba(37,99,235,0.28)]
              "
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 transition-transform duration-300 group-hover:rotate-90">
                <Plus
                  size={
                    13
                  }
                />
              </span>

              Add Bank Account
            </button>
          </div>

          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
        </section>

        {/* ================================================================ */}
        {/* MESSAGE                                                          */}
        {/* ================================================================ */}

        {message && (
          <div
            role="status"
            className="
              mb-4
              flex
              items-center
              gap-2.5
              rounded-xl
              border
              border-emerald-200
              bg-emerald-50
              px-3.5
              py-2.5
              text-[9px]
              font-bold
              text-emerald-700
            "
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2
                size={
                  12
                }
              />
            </span>

            {message}
          </div>
        )}

        {/* ================================================================ */}
        {/* SUMMARY                                                          */}
        {/* ================================================================ */}

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={
              WalletCards
            }
            label="Total Bank Balance"
            value={formatCurrency(
              totalBalance,
            )}
            description="Combined opening balance"
            tone="blue"
          />

          <SummaryCard
            icon={
              Landmark
            }
            label="Linked Accounts"
            value={String(
              accounts.length,
            )}
            description="Active bank accounts"
            tone="emerald"
          />

          <SummaryCard
            icon={
              ShieldCheck
            }
            label="Storage Security"
            value="AES-256"
            description="Encrypted on this device"
            tone="violet"
          />
        </div>

        {/* ================================================================ */}
        {/* BANK REGISTER                                                    */}
        {/* ================================================================ */}

        <section
          className="
            mt-4
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-[0_8px_28px_rgba(15,23,42,0.05)]
          "
        >
          {/* Register heading */}

          <div
            className="
              flex
              flex-col
              gap-3
              border-b
              border-slate-200
              bg-gradient-to-r
              from-slate-50
              via-white
              to-blue-50/50
              px-4
              py-3.5

              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Landmark
                    size={
                      14
                    }
                  />
                </span>

                <div>
                  <h2 className="text-[11px] font-black text-slate-950">
                    Bank Accounts
                  </h2>

                  <p className="mt-0.5 text-[8px] text-slate-400">
                    {accounts.length}{" "}
                    linked account
                    {accounts.length ===
                    1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>
            </div>

            {accounts.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  setShowNumbers(
                    (
                      visible,
                    ) =>
                      !visible,
                  )
                }
                className="
                  inline-flex
                  h-8
                  w-fit
                  items-center
                  justify-center
                  gap-1.5
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-[8px]
                  font-extrabold
                  text-slate-600
                  shadow-sm
                  transition-all
                  hover:border-blue-200
                  hover:bg-blue-50
                  hover:text-blue-700
                "
              >
                {showNumbers ? (
                  <EyeOff
                    size={
                      12
                    }
                  />
                ) : (
                  <Eye
                    size={
                      12
                    }
                  />
                )}

                {showNumbers
                  ? "Hide Numbers"
                  : "Show Numbers"}
              </button>
            )}
          </div>

          {/* Loading */}

          {loading ? (
            <div className="flex min-h-44 items-center justify-center px-5 py-14">
              <div className="text-center">
                <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                <p className="mt-3 text-[9px] font-semibold text-slate-400">
                  Opening encrypted bank
                  details...
                </p>
              </div>
            </div>
          ) : accounts.length ===
            0 ? (
            <EmptyBankState
              onAdd={
                startAdd
              }
            />
          ) : (
            /* No horizontal slider */
            <div className="grid gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-3">
              {accounts.map(
                (
                  account,
                ) => (
                  <BankAccountCard
                    key={
                      account.id
                    }
                    account={
                      account
                    }
                    showNumbers={
                      showNumbers
                    }
                    onEdit={() =>
                      startEdit(
                        account,
                      )
                    }
                    onDelete={() =>
                      void removeAccount(
                        account,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>

        {/* ================================================================ */}
        {/* SECURITY NOTE                                                    */}
        {/* ================================================================ */}

        <div
          className="
            mt-4
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-blue-100
            bg-gradient-to-r
            from-blue-50
            to-cyan-50/60
            p-3.5
          "
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <LockKeyhole
              size={
                14
              }
            />
          </span>

          <div>
            <p className="text-[9px] font-extrabold text-blue-900">
              Protected on this
              device
            </p>

            <p className="mt-0.5 max-w-4xl text-[8px] leading-5 text-blue-700">
              Bank details are
              encrypted using AES-GCM
              with a non-exportable
              browser key. Clearing
              browser site data removes
              both the encryption key
              and saved bank accounts.
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODAL                                                            */}
      {/* ================================================================ */}

      {showForm && (
        <BankAccountDialog
          form={form}
          editing={Boolean(
            editingId,
          )}
          saving={saving}
          error={error}
          onClose={
            closeForm
          }
          onSubmit={
            handleSubmit
          }
          updateField={
            updateField
          }
        />
      )}
    </>
  );
}

/* ========================================================================== */
/* BANK ACCOUNT CARD                                                          */
/* ========================================================================== */

function BankAccountCard({
  account,
  showNumbers,
  onEdit,
  onDelete,
}: {
  account: BankAccount;
  showNumbers: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`
        group
        relative
        min-w-0
        overflow-hidden
        rounded-2xl
        border
        p-4
        transition-all
        duration-300

        ${
          account.primary
            ? "border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-cyan-50/60 shadow-[0_10px_25px_rgba(37,99,235,0.08)]"
            : "border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_14px_28px_rgba(37,99,235,0.08)]"
        }
      `}
    >
      {/* Hover glow */}

      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-blue-100/70 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      {/* Top */}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              transition-all
              duration-300

              ${
                account.primary
                  ? "bg-blue-600 text-white shadow-[0_6px_15px_rgba(37,99,235,0.20)]"
                  : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
              }
            `}
          >
            <Landmark
              size={
                17
              }
            />
          </span>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-[12px] font-black text-slate-950">
                {
                  account.bankName
                }
              </h3>

              {account.primary && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider text-emerald-700">
                  <Star
                    size={
                      7
                    }
                    fill="currentColor"
                  />
                  Primary
                </span>
              )}
            </div>

            <p className="mt-1 truncate text-[9px] font-medium text-slate-500">
              {
                account.accountHolder
              }
            </p>

            <p className="mt-1 text-[8px] font-bold text-slate-400">
              {
                ACCOUNT_LABELS[
                  account.accountType
                ]
              }
            </p>
          </div>
        </div>

        {/* Actions */}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${account.bankName}`}
            onClick={
              onEdit
            }
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              border
              border-transparent
              text-slate-400
              transition-all
              hover:border-blue-100
              hover:bg-blue-50
              hover:text-blue-600
            "
          >
            <Pencil
              size={
                13
              }
            />
          </button>

          <button
            type="button"
            aria-label={`Delete ${account.bankName}`}
            onClick={
              onDelete
            }
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              border
              border-transparent
              text-slate-400
              transition-all
              hover:border-red-100
              hover:bg-red-50
              hover:text-red-600
            "
          >
            <Trash2
              size={
                13
              }
            />
          </button>
        </div>
      </div>

      {/* Account Number */}

      <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-950 px-3.5 py-3 text-white">
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />

        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[6px] font-black uppercase tracking-[0.14em] text-slate-400">
              Account Number
            </p>

            <p className="mt-1 truncate font-mono text-[11px] font-bold tracking-[0.10em] text-white">
              {showNumbers
                ? account.accountNumber
                : maskAccount(
                    account.accountNumber,
                  )}
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[7px] font-bold text-blue-200">
            {
              account.ifsc
            }
          </span>
        </div>
      </div>

      {/* Details */}

      <dl className="relative mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        <BankDetail
          label="Branch"
          value={
            account.branch ||
            "Not provided"
          }
        />

        <BankDetail
          label="UPI ID"
          value={
            account.upiId ||
            "Not provided"
          }
        />

        <BankDetail
          label="IFSC"
          value={
            account.ifsc
          }
        />

        <BankDetail
          label="Balance"
          value={formatCurrency(
            account.openingBalance,
          )}
          highlight
        />
      </dl>

      {/* Accent */}

      <span
        className={`
          absolute
          bottom-0
          left-0
          h-[3px]
          transition-all
          duration-300

          ${
            account.primary
              ? "w-full bg-blue-600"
              : "w-0 bg-blue-600 group-hover:w-full"
          }
        `}
      />
    </article>
  );
}

/* ========================================================================== */
/* BANK DETAIL                                                                */
/* ========================================================================== */

function BankDetail({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50">
      <dt className="text-[6px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </dt>

      <dd
        title={value}
        className={`
          mt-1
          truncate
          text-[9px]
          font-extrabold

          ${
            highlight
              ? "text-blue-700"
              : "text-slate-700"
          }
        `}
      >
        {value}
      </dd>
    </div>
  );
}

/* ========================================================================== */
/* SUMMARY CARD                                                               */
/* ========================================================================== */

const SUMMARY_TONES = {
  blue: {
    icon:
      "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",

    border:
      "hover:border-blue-200",

    accent:
      "bg-blue-600",
  },

  emerald: {
    icon:
      "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",

    border:
      "hover:border-emerald-200",

    accent:
      "bg-emerald-500",
  },

  violet: {
    icon:
      "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",

    border:
      "hover:border-violet-200",

    accent:
      "bg-violet-500",
  },
} as const;

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  description: string;
  tone: keyof typeof SUMMARY_TONES;
}) {
  const style =
    SUMMARY_TONES[tone];

  return (
    <div
      className={`
        group
        relative
        min-w-0
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-[0_4px_18px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-1
        hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]

        ${style.border}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[7px] font-black uppercase tracking-[0.13em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">
            {value}
          </p>

          <p className="mt-1 truncate text-[8px] text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={`
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            transition-all
            duration-300
            group-hover:scale-110

            ${style.icon}
          `}
        >
          <Icon
            size={
              17
            }
          />
        </span>
      </div>

      <span
        className={`
          absolute
          bottom-0
          left-0
          h-[3px]
          w-0
          transition-all
          duration-300
          group-hover:w-full

          ${style.accent}
        `}
      />
    </div>
  );
}

/* ========================================================================== */
/* EMPTY STATE                                                                */
/* ========================================================================== */

function EmptyBankState({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-5 py-10">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <Building2
            size={
              21
            }
          />
        </span>

        <h3 className="mt-4 text-[12px] font-black text-slate-900">
          No Bank Accounts
        </h3>

        <p className="mx-auto mt-1.5 text-[9px] leading-5 text-slate-500">
          Add your business bank
          details for quick access
          while receiving payments
          and preparing invoices.
        </p>

        <button
          type="button"
          onClick={
            onAdd
          }
          className="
            group
            mt-4
            inline-flex
            h-9
            items-center
            gap-1.5
            rounded-lg
            bg-blue-600
            px-3
            text-[9px]
            font-extrabold
            text-white
            transition-all
            hover:-translate-y-0.5
            hover:bg-blue-700
            hover:shadow-md
          "
        >
          <Plus
            size={
              12
            }
            className="transition-transform group-hover:rotate-90"
          />

          Add First Account
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* BANK ACCOUNT DIALOG                                                        */
/* ========================================================================== */

function BankAccountDialog({
  form,
  editing,
  saving,
  error,
  onClose,
  onSubmit,
  updateField,
}: {
  form: BankForm;
  editing: boolean;
  saving: boolean;
  error: string;

  onClose: () => void;

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;

  updateField: <
    K extends keyof BankForm,
  >(
    field: K,
    value: BankForm[K],
  ) => void;
}) {
  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-end
        justify-center
        bg-slate-950/50
        backdrop-blur-sm

        sm:items-center
        sm:p-4
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-form-title"
    >
      <form
        onSubmit={
          onSubmit
        }
        className="
          max-h-[95vh]
          w-full
          overflow-y-auto
          rounded-t-2xl
          bg-white
          shadow-[0_30px_80px_rgba(15,23,42,0.30)]

          sm:max-w-2xl
          sm:rounded-2xl
        "
      >
        {/* Modal Header */}

        <div
          className="
            sticky
            top-0
            z-10
            flex
            items-center
            justify-between
            gap-4
            border-b
            border-slate-200
            bg-gradient-to-r
            from-blue-50
            via-white
            to-cyan-50
            px-5
            py-4
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Landmark
                size={
                  16
                }
              />
            </span>

            <div className="min-w-0">
              <h2
                id="bank-form-title"
                className="truncate text-[13px] font-black text-slate-950"
              >
                {editing
                  ? "Update Bank Details"
                  : "Add Bank Account"}
              </h2>

              <p className="mt-0.5 text-[8px] text-slate-500">
                Details are encrypted
                before saving.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={
              onClose
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 hover:shadow-sm"
          >
            <X
              size={
                15
              }
            />
          </button>
        </div>

        {/* Form */}

        <div className="grid gap-3.5 p-5 sm:grid-cols-2">
          <Field
            label="Account Holder"
            required
          >
            <PremiumInput
              required
              autoFocus
              value={
                form.accountHolder
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "accountHolder",
                  value,
                )
              }
              placeholder="Business or account holder"
            />
          </Field>

          <Field
            label="Bank Name"
            required
          >
            <PremiumInput
              required
              value={
                form.bankName
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "bankName",
                  value,
                )
              }
              placeholder="e.g. HDFC Bank"
            />
          </Field>

          <Field
            label="Account Number"
            required
          >
            <PremiumInput
              required
              inputMode="numeric"
              autoComplete="off"
              value={
                form.accountNumber
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "accountNumber",
                  value.replace(
                    /[^\d ]/g,
                    "",
                  ),
                )
              }
              placeholder="9–18 digit account number"
            />
          </Field>

          <Field
            label="IFSC Code"
            required
          >
            <PremiumInput
              required
              maxLength={11}
              value={
                form.ifsc
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "ifsc",
                  value
                    .toUpperCase()
                    .replace(
                      /[^A-Z0-9]/g,
                      "",
                    ),
                )
              }
              placeholder="HDFC0001234"
              uppercase
            />
          </Field>

          <Field label="Account Type">
            <select
              className="
                h-10
                w-full
                rounded-xl
                border
                border-slate-200
                bg-white
                px-3
                text-[10px]
                font-semibold
                text-slate-700
                outline-none
                transition-all
                hover:border-slate-300
                focus:border-blue-400
                focus:ring-4
                focus:ring-blue-100/60
              "
              value={
                form.accountType
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "accountType",
                  event.target
                    .value as AccountType,
                )
              }
            >
              {Object.entries(
                ACCOUNT_LABELS,
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field label="Branch">
            <PremiumInput
              value={
                form.branch
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "branch",
                  value,
                )
              }
              placeholder="Branch name or city"
            />
          </Field>

          <Field label="UPI ID">
            <PremiumInput
              value={
                form.upiId
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "upiId",
                  value,
                )
              }
              placeholder="business@bank"
            />
          </Field>

          <Field label="Opening Balance">
            <PremiumInput
              type="number"
              step="0.01"
              value={
                form.openingBalance
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "openingBalance",
                  value,
                )
              }
              placeholder="0.00"
            />
          </Field>

          {/* Primary */}

          <label
            className={`
              group
              flex
              cursor-pointer
              items-center
              gap-3
              rounded-xl
              border
              p-3
              transition-all

              sm:col-span-2

              ${
                form.primary
                  ? "border-blue-200 bg-blue-50/70"
                  : "border-slate-200 bg-slate-50/50 hover:border-blue-200 hover:bg-blue-50/40"
              }
            `}
          >
            <span
              className={`
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                transition

                ${
                  form.primary
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-400 ring-1 ring-slate-200"
                }
              `}
            >
              {form.primary ? (
                <Check
                  size={
                    14
                  }
                  strokeWidth={
                    3
                  }
                />
              ) : (
                <Star
                  size={
                    13
                  }
                />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold text-slate-800">
                Primary Account
              </span>

              <span className="mt-0.5 block text-[8px] text-slate-500">
                Use this account by
                default for payment
                details.
              </span>
            </span>

            <input
              type="checkbox"
              className="sr-only"
              checked={
                form.primary
              }
              onChange={(
                event,
              ) =>
                updateField(
                  "primary",
                  event.target
                    .checked,
                )
              }
            />
          </label>

          {/* Error */}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[9px] font-semibold text-red-700 sm:col-span-2"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur">
          <button
            type="button"
            onClick={
              onClose
            }
            className="
              inline-flex
              h-9
              items-center
              justify-center
              rounded-lg
              border
              border-slate-200
              bg-white
              px-4
              text-[9px]
              font-extrabold
              text-slate-600
              transition
              hover:bg-slate-50
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving
            }
            className="
              inline-flex
              h-9
              min-w-28
              items-center
              justify-center
              gap-1.5
              rounded-lg
              bg-blue-600
              px-4
              text-[9px]
              font-extrabold
              text-white
              shadow-[0_6px_16px_rgba(37,99,235,0.20)]
              transition-all
              hover:-translate-y-0.5
              hover:bg-blue-700
              disabled:pointer-events-none
              disabled:opacity-50
            "
          >
            <Save
              size={
                12
              }
            />

            {saving
              ? "Encrypting..."
              : editing
                ? "Save Changes"
                : "Save Account"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/* FIELD                                                                      */
/* ========================================================================== */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[7px] font-black uppercase tracking-[0.11em] text-slate-400">
        {label}

        {required && (
          <span className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

/* ========================================================================== */
/* PREMIUM INPUT                                                              */
/* ========================================================================== */

function PremiumInput({
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoFocus,
  maxLength,
  autoComplete,
  inputMode,
  step,
  uppercase = false,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  autoComplete?: string;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal"
    | "search"
    | "email"
    | "tel"
    | "url";
  step?: string;
  uppercase?: boolean;
}) {
  return (
    <input
      type={type}
      required={required}
      autoFocus={
        autoFocus
      }
      maxLength={
        maxLength
      }
      autoComplete={
        autoComplete
      }
      inputMode={
        inputMode
      }
      step={step}
      value={value}
      onChange={(
        event,
      ) =>
        onChange(
          event.target.value,
        )
      }
      placeholder={
        placeholder
      }
      className={`
        h-10
        w-full
        rounded-xl
        border
        border-slate-200
        bg-white
        px-3
        text-[10px]
        font-semibold
        text-slate-800
        outline-none
        transition-all
        placeholder:font-medium
        placeholder:text-slate-400
        hover:border-slate-300
        focus:border-blue-400
        focus:ring-4
        focus:ring-blue-100/60

        ${
          uppercase
            ? "uppercase"
            : ""
        }
      `}
    />
  );
}