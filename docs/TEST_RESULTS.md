# Test Results

Run on 2026-11-27 on the development machine (Windows 11, Bun 1.4.2; Node.js is not installed, so all scripts ran under Bun). Commands are the projects' own scripts. All tests use mocked persistence; **no test touched the production site or database.**

| Check | Command | Result |
|---|---|---|
| Backend type-check | `bunx tsc --noEmit -p tsconfig.json` | PASS — 0 errors |
| Backend unit tests | `bun run test` (Vitest) | PASS — 37 files, **265 tests passed**, 0 failed |
| Backend compile | `bunx nest build` | PASS |
| Backend full build | `bun run build` (`prisma generate && nest build`) | Not completed on this machine: `prisma generate` could not replace the Prisma engine DLL because the backend dev server was running (Windows file lock). The compile step itself passes. Stop the server and rerun. |
| Frontend type-check | `bunx tsc --noEmit -p tsconfig.json` | PASS — 0 errors |
| Frontend lint | `bun run lint` (ESLint, `--max-warnings=0`) | PASS — 0 errors, 0 warnings |
| Frontend unit tests | `bun test tests` | PASS — 15 files, **54 tests passed**, 0 failed |
| Frontend production build | `next build` into a separate output folder | PASS — compiled, 62 static pages generated |
| Invoice editor layout | Puppeteer (installed Chrome) with mocked API, 4 viewports | PASS — measurements in `BUG_REPORT.md` BUG-10 |
| Regression check for BUG-01 | New test run against the old numbering code | FAILED on old code as expected; PASS on the fix |
| Database integration (Supertest) | — | NOT RUN — staging database pending |
| Browser end-to-end (Playwright) | — | NOT RUN — staging database pending; Playwright not yet set up |
| Security tests (active) | — | NOT RUN — staging environment pending |

## Notes

- Test counts grew during the engagement: backend 229 → 265, frontend 47 → 54.
- One earlier frontend run showed a single failure while the machine was under build load (54 s runtime); the immediate rerun and every later run passed. It looked like a timing issue rather than a failing test.
- `tsconfig.json` was not changed by the verification build (the temporary output folder entry added by Next.js was removed).
