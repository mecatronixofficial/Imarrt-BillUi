# Security Audit

Method: source review of both repositories plus the automated suite. **No security testing was performed against the production site or API.** Active testing (cross-tenant access attempts, upload abuse, rate-limit checks) is pending the staging environment and listed in `TEST_CASES.md`.

## Summary

| Area | Status | Evidence / notes |
|---|---|---|
| Secrets | PASS | No `.env` committed in either repo (only `.env.example`). Field encryption key, JWT secrets and DB URL come from environment. |
| Authentication | PASS | JWT access + rotating refresh tokens in httpOnly cookies; `secure` and `SameSite=None` in production, `lax` in development; Argon2id password hashing with legacy bcrypt hashes still verified (`password.util.spec.ts`); optional TOTP MFA (`totp.util.spec.ts`, `mfa.guard.spec.ts`); session list and revoke. |
| Brute force | PARTIAL | Login / reset / MFA routes limited to 3–5 requests per minute per IP. No per-account lockout (OPEN-05). |
| CSRF | PASS | Cookie auth + `OriginGuard`: state-changing requests carrying an `Origin` must match the `CORS_ORIGIN` allow-list. CORS restricted to the same list with credentials. |
| Authorization (roles) | PASS (code review) | `@Roles` on mutations; team members limited to staff/accountant; owners cannot be edited from Team. Roles are global per user (OPEN-08). |
| Business isolation / IDOR | PASS (code review) / NOT TESTED (live) | `BusinessGuard` requires active membership of the company in `X-Business-Id`; `BranchGuard` requires the branch to belong to it; services filter every lookup by `businessId`/`branchId` before by-id writes (sampled in `API_AUDIT.md`). A cross-tenant integration test is pending. |
| Input validation | PASS | Global `ValidationPipe` with whitelist + forbid unknown fields; DTO patterns (e.g. invoice number `^[A-Za-z0-9][A-Za-z0-9/_.-]{0,39}$`, tax 0–100); preference patch validated field by field (new invoice prefix pattern rejects spaces, quotes and unknown tokens). |
| SQL injection | PASS | Prisma query builder; the few raw queries use tagged templates (`$queryRaw\`…${value}\``) or a fixed allow-list of table names (`lockBillingRecord`). |
| XSS | PASS | No `dangerouslySetInnerHTML` in the UI; print HTML built in the UI escapes values (`escapeMarkup`); PDF HTML on the server escapes values (`escapeHtml`). Helmet sets security headers; CSP enabled in production. |
| File uploads | PARTIAL | Count and size limits (10 files, 10 MB each, 25 MB total); allow-listed MIME types without HTML/SVG; downloads forced as attachments. Content signature not verified (OPEN-06). |
| Rate limiting | PASS | Global 100 requests/min per IP plus stricter auth limits. |
| Sensitive actions | PASS | Optional action passcode with lockout (`action-security.spec.ts`). |
| Data at rest | PASS (partial) | GSTIN and bank account numbers encrypted with a field key plus blind index for lookups. |
| Error leakage | PASS (code review) | Global exception filter returns message, path, timestamp, request id; unexpected errors return "Internal server error" and the stack trace is only logged on the server. |

## Recommendations (priority order)

1. Add an automated cross-tenant test: user A must get 403/404 for company B's invoices, parties, items and reports (pending staging DB).
2. Per-account login lockout or progressive delay (OPEN-05).
3. Verify upload content signatures for images and PDFs (OPEN-06).
4. If users may hold different roles in different companies, move the role onto the membership (OPEN-08).
5. Keep `CORS_ORIGIN` limited to the exact production and staging origins.
