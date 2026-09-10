"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  MonitorSmartphone,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react";

import QRCode from "qrcode";

import {
  api,
  getApiError,
  getCurrentUser,
  resetSession,
  SessionUser,
} from "@/lib/api";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type AuthSession = {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  mfaVerified: boolean;
  current: boolean;
};

type MfaSetup = {
  secret: string;
  otpauthUri: string;
};

/* -------------------------------------------------------------------------- */
/* Device Name                                                                */
/* -------------------------------------------------------------------------- */

function getDeviceName(
  userAgent?: string,
) {
  if (!userAgent) {
    return "Unknown device";
  }

  const browserPatterns: Array<
    [string, RegExp]
  > = [
    [
      "Edge",
      /Edg\/([\d.]+)/,
    ],
    [
      "Opera",
      /(?:OPR|Opera)\/([\d.]+)/,
    ],
    [
      "Chrome",
      /(?:Chrome|CriOS)\/([\d.]+)/,
    ],
    [
      "Firefox",
      /(?:Firefox|FxiOS)\/([\d.]+)/,
    ],
    [
      "Safari",
      /Version\/([\d.]+).*Safari/,
    ],
  ];

  const browser =
    browserPatterns.find(
      ([, pattern]) =>
        pattern.test(userAgent),
    );

  const match =
    browser?.[1].exec(
      userAgent,
    );

  const browserName =
    browser
      ? `${browser[0]}${
          match?.[1]
            ? ` ${match[1].split(".")[0]}`
            : ""
        }`
      : "Web browser";

  let operatingSystem =
    "Unknown OS";

  if (
    /Windows NT/i.test(
      userAgent,
    )
  ) {
    operatingSystem =
      "Windows";
  } else if (
    /Android/i.test(
      userAgent,
    )
  ) {
    operatingSystem =
      "Android";
  } else if (
    /iPhone|iPad|iPod/i.test(
      userAgent,
    )
  ) {
    operatingSystem =
      "iOS";
  } else if (
    /Mac OS X/i.test(
      userAgent,
    )
  ) {
    operatingSystem =
      "macOS";
  } else if (
    /Linux/i.test(
      userAgent,
    )
  ) {
    operatingSystem =
      "Linux";
  }

  return `${browserName} on ${operatingSystem}`;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function SecurityPage() {
  const router =
    useRouter();

  const [user, setUser] =
    useState<SessionUser | null>(
      null,
    );

  const [
    sessions,
    setSessions,
  ] = useState<
    AuthSession[]
  >([]);

  const [setup, setSetup] =
    useState<MfaSetup | null>(
      null,
    );

  const [
    qrCodeUrl,
    setQrCodeUrl,
  ] = useState("");

  const [
    secretCopied,
    setSecretCopied,
  ] = useState(false);

  const [
    mfaCode,
    setMfaCode,
  ] = useState("");

  const [
    recoveryCodes,
    setRecoveryCodes,
  ] = useState<string[]>(
    [],
  );

  const [
    passwordForm,
    setPasswordForm,
  ] = useState({
    currentPassword: "",
    newPassword: "",
  });

  const [
    disableForm,
    setDisableForm,
  ] = useState({
    password: "",
    code: "",
  });

  const [busy, setBusy] =
    useState("");

  const [error, setError] =
    useState("");

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

  const loadSecurity =
    useCallback(async () => {
      try {
        const currentUser =
          await getCurrentUser();

        if (!currentUser) {
          return;
        }

        setUser(currentUser);

        const { data } =
          await api.get<
            AuthSession[]
          >(
            "/auth/sessions",
          );

        setSessions(data);
      } catch (
        loadError
      ) {
        setError(
          getApiError(
            loadError,
            "Could not load security settings.",
          ),
        );
      }
    }, []);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  /* ------------------------------------------------------------------------ */
  /* QR                                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true;

    setQrCodeUrl("");
    setSecretCopied(false);

    if (
      !setup?.otpauthUri
    ) {
      return () => {
        active = false;
      };
    }

    void QRCode.toDataURL(
      setup.otpauthUri,
      {
        errorCorrectionLevel:
          "M",
        margin: 2,
        width: 240,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      },
    )
      .then((url) => {
        if (active) {
          setQrCodeUrl(
            url,
          );
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "Could not generate the authenticator QR code. Use the setup key instead.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [setup]);

  /* ------------------------------------------------------------------------ */
  /* Copy Secret                                                              */
  /* ------------------------------------------------------------------------ */

  async function copySetupSecret() {
    if (!setup?.secret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        setup.secret,
      );

      setSecretCopied(
        true,
      );

      window.setTimeout(
        () =>
          setSecretCopied(
            false,
          ),
        2000,
      );
    } catch {
      setError(
        "Could not copy the setup key. Select and copy it manually.",
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Start MFA                                                                */
  /* ------------------------------------------------------------------------ */

  async function startMfaSetup() {
    setBusy("setup");
    setError("");

    try {
      const { data } =
        await api.post<MfaSetup>(
          "/auth/mfa/setup",
        );

      setSetup(data);
    } catch (
      requestError
    ) {
      setError(
        getApiError(
          requestError,
          "Could not start MFA setup.",
        ),
      );
    } finally {
      setBusy("");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Enable MFA                                                               */
  /* ------------------------------------------------------------------------ */

  async function enableMfa(
    event: FormEvent,
  ) {
    event.preventDefault();

    setBusy("enable");
    setError("");

    try {
      const { data } =
        await api.post<{
          recoveryCodes: string[];
        }>(
          "/auth/mfa/enable",
          {
            code: mfaCode,
          },
        );

      setRecoveryCodes(
        data.recoveryCodes,
      );

      setSetup(null);

      resetSession();
    } catch (
      requestError
    ) {
      setError(
        getApiError(
          requestError,
          "Could not enable MFA.",
        ),
      );
    } finally {
      setBusy("");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Disable MFA                                                              */
  /* ------------------------------------------------------------------------ */

  async function disableMfa(
    event: FormEvent,
  ) {
    event.preventDefault();

    setBusy("disable");
    setError("");

    try {
      await api.post(
        "/auth/mfa/disable",
        disableForm,
      );

      resetSession();

      router.replace(
        "/login",
      );
    } catch (
      requestError
    ) {
      setError(
        getApiError(
          requestError,
          "Could not disable MFA.",
        ),
      );
    } finally {
      setBusy("");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Change Password                                                          */
  /* ------------------------------------------------------------------------ */

  async function changePassword(
    event: FormEvent,
  ) {
    event.preventDefault();

    setBusy("password");
    setError("");

    try {
      await api.post(
        "/auth/change-password",
        passwordForm,
      );

      resetSession();

      router.replace(
        "/login",
      );
    } catch (
      requestError
    ) {
      setError(
        getApiError(
          requestError,
          "Could not change password.",
        ),
      );
    } finally {
      setBusy("");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Revoke Session                                                           */
  /* ------------------------------------------------------------------------ */

  async function revokeSession(
    id: string,
  ) {
    setBusy(id);
    setError("");

    try {
      await api.delete(
        `/auth/sessions/${id}`,
      );

      setSessions(
        (current) =>
          current.filter(
            (session) =>
              session.id !==
              id,
          ),
      );
    } catch (
      requestError
    ) {
      setError(
        getApiError(
          requestError,
          "Could not revoke the session.",
        ),
      );
    } finally {
      setBusy("");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Revoke Others                                                            */
  /* ------------------------------------------------------------------------ */

  async function revokeOthers() {
    setBusy("others");
    setError("");

    try {
      await api.delete(
        "/auth/sessions/others",
      );

      setSessions(
        (current) =>
          current.filter(
            (session) =>
              session.current,
          ),
      );
    } catch (
      requestError
    ) {
      setError(
        getApiError(
          requestError,
          "Could not revoke other sessions.",
        ),
      );
    } finally {
      setBusy("");
    }
  }

  /* ======================================================================== */
  /* RECOVERY CODE PAGE                                                       */
  /* ======================================================================== */

  if (
    recoveryCodes.length >
    0
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4 sm:p-6">
        <section className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
              <ShieldCheck
                size={23}
              />
            </span>

            <p className="mt-5 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Security Activated
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight">
              MFA is enabled
            </h1>

            <p className="mt-2 text-[11px] leading-5 text-slate-300">
              Save these
              one-time recovery
              codes in a secure
              location. They will
              not be shown again.
            </p>

            <div className="my-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              {recoveryCodes.map(
                (code) => (
                  <span
                    key={code}
                    className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-center font-mono text-[11px] font-bold tracking-wider text-slate-200"
                  >
                    {code}
                  </span>
                ),
              )}
            </div>

            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[10px] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-xl"
              onClick={() =>
                router.replace(
                  "/login",
                )
              }
            >
              <Check
                size={14}
              />

              I saved them —
              sign in again
            </button>
          </div>
        </section>
      </main>
    );
  }

  /* ======================================================================== */
  /* MAIN SECURITY PAGE                                                       */
  /* ======================================================================== */

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* ================================================================ */}
      {/* PREMIUM HEADER                                                   */}
      {/* ================================================================ */}

      <section className="relative mb-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-20 left-[45%] h-40 w-40 rounded-full bg-cyan-100/60 blur-3xl" />

        <div className="relative flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-blue-600" />

              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                Security Center
              </span>
            </div>

            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Account Security
            </h1>

            <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">
              Manage authentication,
              account password and
              signed-in devices from
              one secure workspace.
            </p>
          </div>

          {/* MFA Status */}

          <div
            className={`
              inline-flex
              w-fit
              items-center
              gap-2
              rounded-xl
              border
              px-3
              py-2
              ${
                user?.mfaEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }
            `}
          >
            <span
              className={`
                flex h-7 w-7
                items-center
                justify-center
                rounded-lg
                ${
                  user?.mfaEnabled
                    ? "bg-emerald-100"
                    : "bg-amber-100"
                }
              `}
            >
              {user?.mfaEnabled ? (
                <ShieldCheck
                  size={14}
                />
              ) : (
                <ShieldOff
                  size={14}
                />
              )}
            </span>

            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.12em] opacity-70">
                MFA Status
              </p>

              <p className="text-[9px] font-extrabold">
                {user?.mfaEnabled
                  ? "Protected"
                  : "Not Enabled"}
              </p>
            </div>
          </div>
        </div>

        <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
      </section>

      {/* ================================================================ */}
      {/* ERROR                                                            */}
      {/* ================================================================ */}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[10px] font-semibold leading-5 text-red-700"
        >
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />

          <span>
            {error}
          </span>
        </div>
      )}

      {/* ================================================================ */}
      {/* SECURITY CARDS                                                   */}
      {/* ================================================================ */}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* ============================================================ */}
        {/* MFA CARD                                                     */}
        {/* ============================================================ */}

        <section className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-blue-200 hover:shadow-[0_14px_32px_rgba(37,99,235,0.08)]">
          <div className="absolute left-0 top-0 h-full w-[3px] bg-blue-600" />

          {/* Heading */}

          <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 to-white px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_6px_15px_rgba(37,99,235,0.20)] transition-transform duration-300 group-hover:scale-105">
              <ShieldCheck
                size={18}
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[12px] font-black text-slate-950">
                  Authenticator MFA
                </h2>

                <span
                  className={`
                    rounded-md
                    px-2
                    py-0.5
                    text-[7px]
                    font-black
                    uppercase
                    tracking-wider
                    ${
                      user?.mfaEnabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }
                  `}
                >
                  {user?.mfaEnabled
                    ? "Enabled"
                    : "Optional"}
                </span>
              </div>

              <p className="mt-1 text-[9px] leading-4 text-slate-500">
                Add an extra
                verification layer
                when signing in to
                your account.
              </p>
            </div>
          </div>

          {/* Body */}

          <div className="p-4">
            {!user?.mfaEnabled ? (
              <>
                {!setup ? (
                  <div className="flex min-h-[180px] flex-col justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Smartphone
                          size={15}
                          className="text-blue-600"
                        />

                        <p className="text-[10px] font-extrabold text-slate-800">
                          Secure with
                          authenticator app
                        </p>
                      </div>

                      <p className="mt-2 max-w-md text-[9px] leading-5 text-slate-500">
                        Use Google
                        Authenticator,
                        Microsoft
                        Authenticator,
                        1Password or a
                        compatible TOTP
                        application.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy ===
                        "setup"
                      }
                      onClick={() =>
                        void startMfaSetup()
                      }
                      className="
                        mt-4
                        inline-flex
                        h-9
                        w-fit
                        items-center
                        justify-center
                        gap-2
                        rounded-lg
                        bg-blue-600
                        px-3
                        text-[9px]
                        font-extrabold
                        text-white
                        transition-all
                        hover:-translate-y-0.5
                        hover:bg-blue-700
                        disabled:pointer-events-none
                        disabled:opacity-60
                      "
                    >
                      {busy ===
                      "setup" ? (
                        <>
                          <Loader2
                            size={12}
                            className="animate-spin"
                          />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <ShieldCheck
                            size={12}
                          />

                          Set Up
                          Authenticator
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* MFA Setup */
                  <form
                    onSubmit={
                      enableMfa
                    }
                    className="space-y-4"
                  >
                    {/* QR */}

                    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {qrCodeUrl ? (
                          <img
                            src={
                              qrCodeUrl
                            }
                            alt="QR code for setting up authenticator MFA"
                            className="h-[190px] w-[190px] rounded-xl bg-white p-2 shadow-sm"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500">
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />

                            Generating
                            QR code...
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-blue-600">
                          Step 01
                        </p>

                        <h3 className="mt-1 text-[11px] font-extrabold text-slate-900">
                          Scan the QR
                          Code
                        </h3>

                        <p className="mt-1 text-[9px] leading-5 text-slate-500">
                          Open your
                          authenticator
                          app and scan
                          this QR code.
                        </p>

                        <a
                          href={
                            setup.otpauthUri
                          }
                          className="mt-3 inline-flex text-[9px] font-bold text-blue-600 sm:hidden"
                        >
                          Open in
                          authenticator
                          app
                        </a>

                        {/* Secret */}

                        <div className="mt-4">
                          <p className="text-[8px] font-bold text-slate-500">
                            Manual setup
                            key
                          </p>

                          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-slate-950 p-2.5 text-white">
                            <code className="min-w-0 flex-1 select-all break-all text-center text-[10px] font-bold tracking-widest text-slate-200">
                              {
                                setup.secret
                              }
                            </code>

                            <button
                              type="button"
                              onClick={() =>
                                void copySetupSecret()
                              }
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                              aria-label="Copy setup key"
                            >
                              {secretCopied ? (
                                <Check
                                  size={
                                    13
                                  }
                                  className="text-emerald-400"
                                />
                              ) : (
                                <Copy
                                  size={
                                    13
                                  }
                                />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Code */}

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                      <label
                        htmlFor="mfa-setup-code"
                        className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-500"
                      >
                        Step 02 · Enter
                        6-Digit Code
                      </label>

                      <input
                        id="mfa-setup-code"
                        required
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(
                          event,
                        ) =>
                          setMfaCode(
                            event.target.value.replace(
                              /\D/g,
                              "",
                            ),
                          )
                        }
                        placeholder="000000"
                        className="
                          mt-2
                          h-11
                          w-full
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-4
                          text-center
                          font-mono
                          text-sm
                          font-bold
                          tracking-[0.35em]
                          text-slate-900
                          outline-none
                          transition-all
                          placeholder:text-slate-300
                          focus:border-blue-400
                          focus:ring-4
                          focus:ring-blue-100
                        "
                      />

                      <button
                        type="submit"
                        disabled={
                          busy ===
                            "enable" ||
                          mfaCode.length !==
                            6
                        }
                        className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[9px] font-extrabold text-white transition hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {busy ===
                        "enable" ? (
                          <>
                            <Loader2
                              size={
                                12
                              }
                              className="animate-spin"
                            />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Check
                              size={
                                12
                              }
                            />
                            Verify &
                            Enable
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              /* Disable MFA */

              <form
                onSubmit={
                  disableMfa
                }
                className="space-y-3"
              >
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <ShieldCheck
                      size={14}
                    />
                  </span>

                  <div>
                    <p className="text-[10px] font-extrabold text-emerald-800">
                      MFA protection
                      is active
                    </p>

                    <p className="mt-0.5 text-[8px] text-emerald-600">
                      Sign-in requires
                      additional
                      verification.
                    </p>
                  </div>
                </div>

                <p className="text-[9px] leading-5 text-slate-500">
                  Disabling MFA
                  signs out every
                  device. Confirm
                  with your password
                  and authenticator
                  or recovery code.
                </p>

                <SecurityInput
                  type="password"
                  required
                  placeholder="Current password"
                  value={
                    disableForm.password
                  }
                  onChange={(
                    value,
                  ) =>
                    setDisableForm(
                      {
                        ...disableForm,
                        password:
                          value,
                      },
                    )
                  }
                />

                <SecurityInput
                  required
                  placeholder="Authenticator or recovery code"
                  value={
                    disableForm.code
                  }
                  onChange={(
                    value,
                  ) =>
                    setDisableForm(
                      {
                        ...disableForm,
                        code: value,
                      },
                    )
                  }
                />

                <button
                  type="submit"
                  disabled={
                    busy ===
                    "disable"
                  }
                  className="
                    inline-flex
                    h-9
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-red-200
                    bg-white
                    px-3
                    text-[9px]
                    font-extrabold
                    text-red-600
                    transition-all
                    hover:bg-red-50
                    disabled:opacity-50
                  "
                >
                  {busy ===
                  "disable" ? (
                    <Loader2
                      size={12}
                      className="animate-spin"
                    />
                  ) : (
                    <ShieldOff
                      size={12}
                    />
                  )}

                  {busy ===
                  "disable"
                    ? "Disabling..."
                    : "Disable MFA"}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* PASSWORD CARD                                                */}
        {/* ============================================================ */}

        <section className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-violet-200 hover:shadow-[0_14px_32px_rgba(139,92,246,0.07)]">
          <div className="absolute left-0 top-0 h-full w-[3px] bg-violet-500" />

          <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50/60 to-white px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-[0_6px_15px_rgba(139,92,246,0.20)] transition-transform group-hover:scale-105">
              <KeyRound
                size={18}
              />
            </span>

            <div>
              <h2 className="text-[12px] font-black text-slate-950">
                Change Password
              </h2>

              <p className="mt-1 text-[9px] leading-4 text-slate-500">
                Update your login
                password. All active
                devices will be
                signed out.
              </p>
            </div>
          </div>

          <form
            onSubmit={
              changePassword
            }
            className="p-4"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <LockKeyhole
                  size={13}
                  className="text-violet-600"
                />

                <p className="text-[9px] font-extrabold text-slate-700">
                  Password Update
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Current Password
                  </label>

                  <SecurityInput
                    type="password"
                    required
                    maxLength={72}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    value={
                      passwordForm.currentPassword
                    }
                    onChange={(
                      value,
                    ) =>
                      setPasswordForm(
                        {
                          ...passwordForm,
                          currentPassword:
                            value,
                        },
                      )
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    New Password
                  </label>

                  <SecurityInput
                    type="password"
                    required
                    minLength={10}
                    maxLength={72}
                    autoComplete="new-password"
                    placeholder="Enter new strong password"
                    value={
                      passwordForm.newPassword
                    }
                    onChange={(
                      value,
                    ) =>
                      setPasswordForm(
                        {
                          ...passwordForm,
                          newPassword:
                            value,
                        },
                      )
                    }
                  />
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2">
                <p className="text-[8px] leading-4 text-violet-700">
                  Use at least 10
                  characters including
                  uppercase,
                  lowercase, number
                  and symbol.
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  busy ===
                  "password"
                }
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-4 text-[9px] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ===
                "password" ? (
                  <Loader2
                    size={12}
                    className="animate-spin"
                  />
                ) : (
                  <KeyRound
                    size={12}
                  />
                )}

                {busy ===
                "password"
                  ? "Changing..."
                  : "Change Password"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* ================================================================ */}
      {/* ACTIVE SESSIONS                                                  */}
      {/* ================================================================ */}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
        {/* Header */}

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <MonitorSmartphone
                size={16}
              />
            </span>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-black text-slate-950">
                  Active Sessions
                </h2>

                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[7px] font-black text-slate-500">
                  {sessions.length}
                </span>
              </div>

              <p className="mt-0.5 text-[8px] text-slate-400">
                Review devices
                currently signed in
                to your account.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={
              busy ===
                "others" ||
              sessions.length <=
                1
            }
            onClick={() =>
              void revokeOthers()
            }
            className="
              inline-flex
              h-8
              items-center
              justify-center
              gap-1.5
              rounded-lg
              border
              border-red-100
              bg-white
              px-3
              text-[8px]
              font-extrabold
              text-red-600
              transition-all
              hover:border-red-200
              hover:bg-red-50
              disabled:pointer-events-none
              disabled:opacity-40
            "
          >
            {busy ===
            "others" ? (
              <Loader2
                size={11}
                className="animate-spin"
              />
            ) : (
              <Trash2
                size={11}
              />
            )}

            {busy ===
            "others"
              ? "Signing out..."
              : "Sign Out Other Devices"}
          </button>
        </div>

        {/* No horizontal slider */}

        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map(
            (session) => (
              <div
                key={
                  session.id
                }
                className="
                  group
                  relative
                  min-w-0
                  bg-white
                  p-4
                  transition-all
                  duration-200
                  hover:bg-blue-50/40
                "
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      transition-all
                      duration-300
                      ${
                        session.current
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500 group-hover:bg-blue-600 group-hover:text-white"
                      }
                    `}
                  >
                    <MonitorSmartphone
                      size={15}
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[10px] font-extrabold text-slate-800">
                        {getDeviceName(
                          session.userAgent,
                        )}
                      </p>

                      {session.current && (
                        <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider text-emerald-700">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-[8px] text-slate-400">
                      {session.ipAddress ||
                        "Unknown IP"}
                    </p>

                    <p className="mt-0.5 text-[8px] text-slate-400">
                      Last used{" "}
                      {new Date(
                        session.lastUsedAt,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        session.mfaVerified
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}
                    />

                    <span className="text-[7px] font-bold text-slate-400">
                      {session.mfaVerified
                        ? "MFA Verified"
                        : "Standard Session"}
                    </span>
                  </div>

                  {!session.current && (
                    <button
                      type="button"
                      disabled={
                        busy ===
                        session.id
                      }
                      onClick={() =>
                        void revokeSession(
                          session.id,
                        )
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[8px] font-extrabold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy ===
                      session.id ? (
                        <Loader2
                          size={11}
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2
                          size={10}
                        />
                      )}

                      Revoke
                    </button>
                  )}
                </div>

                {session.current && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full bg-emerald-500" />
                )}
              </div>
            ),
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECURITY NOTE                                                    */}
      {/* ================================================================ */}

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50/50 p-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <ShieldCheck
            size={14}
          />
        </span>

        <div>
          <p className="text-[9px] font-extrabold text-blue-900">
            Account Protection
          </p>

          <p className="mt-0.5 text-[8px] leading-5 text-blue-700">
            Keep MFA enabled,
            use a unique password
            and revoke any session
            you do not recognize.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* INPUT                                                                      */
/* ========================================================================== */

function SecurityInput({
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  minLength,
  maxLength,
  autoComplete,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      autoComplete={
        autoComplete
      }
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      placeholder={
        placeholder
      }
      className="
        h-10
        w-full
        rounded-xl
        border
        border-slate-200
        bg-white
        px-3
        text-[10px]
        font-medium
        text-slate-800
        outline-none
        transition-all
        placeholder:text-slate-400
        hover:border-slate-300
        focus:border-blue-400
        focus:ring-4
        focus:ring-blue-100/70
      "
    />
  );
}