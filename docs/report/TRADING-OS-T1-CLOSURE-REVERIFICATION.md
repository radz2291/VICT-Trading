# Trading OS T1 — Independent Re-Verification of the Closure Remediation

> **Status:** Focused independent re-verification of the T1 closure
> remediation commit `5a726d8` (`feat(t1): remediate verification findings
and record closure`), performed per the bounded scope defined in
> [`TRADING-OS-T1-CLOSURE.md`](TRADING-OS-T1-CLOSURE.md) §7. This is the only
> file created in the repository by this audit. Established 2026-09-10.

## 0. Independence statement

This audit was performed with no participation in the closure remediation
work. The authoritative checkout was treated as read-only: no production
code, tests, manifests, lockfiles, reports, roadmap documents, or historical
evidence were modified. All adversarial probes (HTTP scripts, browser
automation, direct SQLite injection, a broken-`prepare` trial, and two extra
unit probes) were executed in disposable locations (temporary clones at the
audit target commit and `%TEMP%`/`C:\tmp` scratch directories), all of which
were removed afterwards. The governing documents — the T1 independent
verification report and the T1 closure record — were read completely before
probing, alongside the roadmap and implementation report needed to interpret
the findings. No `AGENTS.md` file exists in this repository (verified).

## 1. Environment and exact SHAs

| Item                               | Value                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audited repository                 | `C:\Users\RZ1\Desktop\RZ\260909-VCT-Trading` (remote `https://github.com/radz2291/VICT-Trading`)                                                    |
| Audit baseline                     | `279fb29e39c9de7d91c8d4efceeba8e1e9da7a18`                                                                                                          |
| Remediation target / initial state | `5a726d84e4042d9cb973014729bda471c42ae7a5` — `HEAD == origin/main` verified after `git fetch`; working tree clean (`git status --porcelain` empty)  |
| Delta                              | Exactly **one** commit, `279fb29..5a726d8`; linear ancestry verified (`git merge-base --is-ancestor` both directions); 30 files changed, +1478/−166 |
| Node / npm                         | v22.13.1 / 10.9.2 (Windows 10, MINGW64); Playwright 1.63.0 against real system Chrome (`channel: 'chrome'`)                                         |

## 2. Formatting and evidence integrity (F-1, F-2, F-8)

- **`format:check` genuinely passes.** Exit 0 in the authoritative checkout
  and in a fresh clone (see §7). Additionally, `npx prettier --list-different .`
  reports zero files.
- **`.prettierignore` is minimal and honest.** It freezes exactly two
  patterns: `docs/audit/*.md` and
  `docs/report/TRADING-OS-T1-INDEPENDENT-VERIFICATION.md`. Bypassing the
  ignore (`--ignore-path <empty>`) confirms both frozen records genuinely
  would fail Prettier (their audited bytes are unformatted) — the ignore is
  protecting evidence, not concealing failures. Every non-ignored document
  (roadmap, README, implementation report, closure record, consumer-fit
  audit) passes Prettier individually.
- **Byte-identity verified with `cmp` against git blobs:**
  - T1 independent verification report ≡ `279fb29` blob;
  - all six `docs/evidence/t1/*.png` ≡ `279fb29` blobs;
  - T0 reconciliation record ≡ `22a6b34` blob (the F-2 byte-restore is real).
- **`.gitattributes` produces consistent checkouts.** Two test clones —
  `core.autocrlf=true` (worst-case Windows) and `core.autocrlf=false`
  (Linux/macOS-like) — both materialized LF text files (0 CRLF bytes in
  sampled files; `* text=auto eol=lf`), and PNGs stayed byte-identical
  (`*.png binary`). The format gate therefore behaves identically across
  environments; this also fixed a pre-existing divergence (Windows-clone
  checkouts previously failed the gate) that earlier clean-clone ladders
  never exercised because they omitted `format:check`.
- **Browser tests cannot overwrite committed evidence.** All
  `page.screenshot()` destinations in the specs are under gitignored
  `test-results/evidence/`; `docs/evidence` appears only in comments;
  Playwright's failure screenshots go to gitignored `test-results/`.
  Proven empirically: after full e2e runs, both the authoritative tree and
  a fresh clone showed **zero** modifications under `docs/evidence`.
- **Closure evidence is genuine.** The three committed
  `docs/evidence/t1-closure/*.png` files are real 1440×900 captures of the
  production build, distinct from the historical set, and were visually
  inspected (see the finding in §6 about one caption).
- **F-8 erratum is additive.** The implementation report's non-whitespace
  diff vs `279fb29` contains only (a) four Markdown table-delimiter re-pads
  from Prettier and (b) the appended Errata section. The original false
  claims (`69d8ad4`, "format:check clean", "no module-level mutable
  singleton") remain untouched in the historical body and are corrected only
  by the erratum — as claimed.

## 3. Persistence truth and ordering (F-4) — independent probes

All probes were authored fresh for this audit against the real production
build (`vite preview`, isolated `TRADING_OS_DB_PATH` SQLite files) in real
Chrome, plus direct `node:sqlite` inspection of the database files.

**Server ordering over real HTTP + real SQLite — 11/11 PASS
(disposable-clone probe):**

1. first save (T1) ok; 2. newer save (T2) ok; 3. row holds T2; 4. stale write
   (T0 < T1) refused with structured `STALE_WRITE`; 5. row survives the stale
   attempt; 6. equal-timestamp replay accepted (idempotent); 7. row unchanged
   after replay; 8. future schema via API → structured `CONTRACT_REJECTED`, row
   untouched; 9. a future-schema record (`trading.workspace-instance@99`)
   injected **directly** into `appdata_workspace_instances` → save refused with
   `SCHEMA_CONFLICT`; 10. the @99 row is not overwritten; 11. reads fail safe
   (verified post-restart, below).

**Real process restart:** saved FXT-B → the preview server process was
killed → restarted on the same DB → SSR of `/markets` renders FXT-B from
SQLite. With an injected @99 record, a restarted server renders the
documented default (FXT-A) — no crash, no reinterpretation — and still
refuses the overwrite with `SCHEMA_CONFLICT`, row intact.

**Client save channel in real Chrome — 33/33 PASS (disposable-clone probe):**

- `localStorage`/`sessionStorage` empty (never authoritative); a bundle grep
  independently found **zero** `localStorage`/`sessionStorage` occurrences in
  the built client output.
- genuine change → transient `saving` observed → truthful `Workspace saved`;
- three rapid changes → exactly **one** `/api/act` request carrying the
  latest state (coalescing);
- server severed → bounded retries → explicit
  `Save failed — not persisted` state while the workspace stays usable →
  recovery to `Workspace saved` on the next change after the server returns;
- 1.2 s delayed response → channel truthfully holds `saving`, then `saved`;
- hung response → client timeout aborts (5 s) → retry succeeds (≥2 requests,
  final `saved`) — `saving` is never pinned forever;
- **out-of-order, real HTTP:** two held concurrent requests; fulfilling the
  newer one first yields `saved`, and a subsequent stale success — and
  separately a stale HTTP-500 failure — is ignored with **no duplicate or
  retry-storm requests** (request count stays 2, state stays `saved`);
- **pagehide flush on a REAL reload** inside the 300 ms debounce window: the
  keepalive request landed in SQLite (row changed balanced → chart-focus);
- close-flush re-verified rigorously (see §6 note): settled baseline →
  genuine toggle → tab closed inside the debounce window → new state in
  SQLite (inspect → balanced);
- the interface never claims unsaved state is persisted: the indicator is
  hidden at idle, shows `Saving…` whenever anything is un-persisted,
  `Workspace saved` only for confirmed persistence, and the explicit failed
  state otherwise; retries do not duplicate or regress state.

**Teardown:** an independently authored unit probe (disposable clone)
mounted the real `TradingShell`, executed a real palette workspace command,
unmounted inside the debounce window → the save still fired with the change
(no loss); after persistence, unmount fired nothing further (no duplicates).
A shuffled-order run of the full app project (44 tests) also passed.

**Repo test inventory check:** the closure record's §4 inventory matches the
actual test files (15 save-channel + 3 ordering + 4 shell + 5 browser tests);
the pre-existing suites are not weakened (verified by reading the diffs of
touched test files — all changes are additive or selector/label updates; no
assertion was loosened and no timeout was raised).

## 4. Test-starvation remediation (F-10)

- **No timeout was raised or added:** zero `testTimeout` entries exist in any
  vitest config; per-test timeouts remain at vitest's strict 5 s default.
- **Worker math is safe on low-core machines:** `max(2, floor(cores/2))`
  yields 2 for 1–4 cores, 3 for 6, 4 for 8 — it can never produce zero.
- **Stress attempt to reproduce the former flake:** in a disposable clone
  with `maxWorkers` removed (pre-fix behavior) and six CPU burners (~75%
  external load), three stressed runs of the trading-data project passed,
  with the 36-series fixture loop at 87–106 ms; the committed configuration
  passed three stressed **full-suite** runs (101 tests, shuffled-order run
  included) at 88–96 ms. **The probabilistic flake did not reproduce today in
  either configuration** — honestly recorded. The failure mode itself is
  established history (audit observation at 6.07 s; reproduced during
  remediation at 5.57 s under load), and the fix mechanically addresses its
  cause (five projects × unbounded workers oversubscribing 8 cores) while
  keeping strict timeouts. Non-blocking.

## 5. Shell and accessibility changes (F-5, F-6) — real browser

- Windows runner shows `Ctrl K` (probe + committed screenshot); spoofing
  `navigator.platform = 'MacIntel'` yields `⌘K` — the platform logic is
  correct in both directions.
- **One** `Ctrl+K` press opens the palette on cold load; **one** `Meta+K`
  press likewise after reload.
- `aria-expanded="true"` with results **and at zero results** (popup/status
  row visible); `aria-activedescendant` is removed at zero results.
- ArrowDown + Enter activates navigation; Escape closes; focus restores to
  the opener; the strip button opens the palette.
- Independent axe-core scan (WCAG 2.0/2.1 AA) on desktop Markets with the
  save indicator active: **zero critical/serious violations**.

## 6. Findings of this re-verification

| ID   | Severity                    | Evidence                                                                                                                                                                                                                                                                                             | Impact                                                                                                                                                                                                        | Disposition                                                                                                                                       |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| RV-1 | Minor (record accuracy)     | Closure record §5 table describes `docs/evidence/t1-closure/desktop-markets-save-failed.png` as "Markets, **Inspect**"; the committed image shows the **Balanced** layout (Balanced segment active, watchlist beside the chart; produced by the spec's state-dependent toggle parity).               | The evidentiary claims that matter — explicit `Save failed — not persisted` state, warning color with dot + text, workspace usable — are genuine and verified; only the layout label in the caption is wrong. | **Non-blocking.** Correct the caption in the closure record at its next revision; the image itself is accurate evidence of the failed-save state. |
| RV-2 | Observation (audit process) | First ladder attempt aborted: `npm ci` failed with `EPERM unlink esbuild.exe` — a stale `vite preview` process from earlier probing held the binary — leaving `node_modules` gutted; a harness bug briefly masked command exits.                                                                     | Environment failure during the audit, not a repository defect.                                                                                                                                                | Re-verified after terminating the stray process; the recorded ladder is the clean re-run with per-step exit codes.                                |
| RV-3 | Observation                 | The close-flush browser check inside the closure spec can pass vacuously depending on preceding state (as can any toggle-based check); this audit re-verified the behavior with a strengthened independent probe (settled baseline ≠ target; new state confirmed in SQLite after `context.close()`). | None.                                                                                                                                                                                                         | Behavior confirmed; noted for future suite hardening.                                                                                             |

No finding was declared resolved merely through documentation: F-1 was
proven by running the gate (checkout + clone), F-4/F-5/F-6 by behavioral
probes in a real browser and over real SQLite, F-9's defect was wording (the
rewording is the fix, verified accurate against the code), F-10 by config +
load testing, F-11 by a forced-failure probe, F-14 by audit + versions. The
accepted limitations (F-7 documented upgrade gate in `shell.css`; F-12
re-proven: plain `npm ci` still fails on npm 10.9.2 with the yaml peer
inconsistency while the documented command succeeds; F-13 visible in the Desk
evidence, honest and later-stage) and the upstream deferral (F-3: the
published 0.1.1 tarball verifiably ships `src/` without `dist/` while
declaring `./dist/index.d.ts`; the shim is a `tsconfig` types mapping only —
the real renderer implementation is in the client bundle, realpaths stay in
the consumer's own `node_modules`, and no `file:`/`link:`/`git` specifiers
exist) are all accurately recorded.

## 7. Full regression ladder (authoritative checkout, exact results)

| #   | Command                                                           | Exit | Notes                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm ci --legacy-peer-deps --registry https://registry.npmjs.org` | 0    | clean install; only npm deprecation notices                                                                                                                                                                             |
| 2   | `npm run verify:registry`                                         | 0    | 6 packages at exact 0.1.1; release set `v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf` recomputed and matched; realpaths inside this repo's `node_modules`, never the VICT checkout               |
| 3   | `npm run format:check`                                            | 0    | —                                                                                                                                                                                                                       |
| 4   | `npm run lint`                                                    | 0    | —                                                                                                                                                                                                                       |
| 5   | `npm run typecheck`                                               | 0    | tsc clean; `svelte-check found 0 errors and 0 warnings`                                                                                                                                                                 |
| 6   | `npm run build`                                                   | 0    | only the expected `node:sqlite` ExperimentalWarning (from `@victframework/appdata-sqlite`)                                                                                                                              |
| 7   | `npm test`                                                        | 0    | **11 files, 99 passed (99)**, 0 failed, 0 skipped                                                                                                                                                                       |
| 8   | `npm run verify:client-boundary`                                  | 0    | client bundle free of Node-only storage code                                                                                                                                                                            |
| 9   | `npm audit`                                                       | 0    | **found 0 vulnerabilities** (full tree)                                                                                                                                                                                 |
| 10  | `npm audit --omit=dev`                                            | 0    | **found 0 vulnerabilities**                                                                                                                                                                                             |
| 11  | `git diff --check`                                                | 0    | clean                                                                                                                                                                                                                   |
| 12  | `npm run test:e2e` (canonical, 3 projects, real Chrome)           | 0    | **19 passed / 38 skipped**; math verified intentional: desktop.spec 9 + persistence-truth.spec 5 (desktop-only) + laptop.spec 1 + mobile.spec 4 = 19 runnable; 3 projects → 57 executions − 19 = 38 project-guard skips |

Dependency changes verified as intentional and lockfile-consistent:
`happy-dom 20.14.3`, `vite 6.4.3` (override + direct pin agree),
`cookie 0.7.2` via the `^0.7.0` override (kit remains 2.70.3, the latest);
`npm ls` clean of extraneous/invalid entries after the upgrades. The
upgrades introduced no build, SSR, hydration, browser, or type regressions
(all suites and the real-browser probes above ran on the upgraded tree).

## 8. Fresh-clone verification (including browser tests)

A fresh external clone of `5a726d8` (remote-identical tree) was verified with
per-step exit codes: `npm ci --legacy-peer-deps` (0) → `verify:registry` (0)
→ `format:check` (0) → `lint` (0) → `typecheck` (0) → `build` (0) →
`npm test` (0; 99/99) → `verify:client-boundary` (0) → `npm audit` (0) →
`npm audit --omit=dev` (0) → `npm run test:e2e` (**0; 19 passed / 38
skipped**, self-built application, real Chrome). A separate plain-`npm ci`
trial in the clone reproduced the documented F-12 failure ("does not
satisfy" — the yaml peer inconsistency), confirming the accepted limitation
and the necessity of the documented workaround remain truthfully recorded.
Zero tracked-file modifications existed in the clone after the full e2e run.

## 9. Verdict

Every closure condition defined in `TRADING-OS-T1-CLOSURE.md` §7 was
independently re-verified against primary evidence: the persistence-truth
remediation over real HTTP, real SQLite, and real Chrome (including failure,
delay, timeout, out-of-order, flush, restart, and recovery paths); the
adversarial test inventory (exists, runs, asserts what it claims; nothing
weakened); the F-10 fix (strict timeouts, safe worker math, green under
load); the F-14 upgrades (0 vulnerabilities, no regressions); and the
evidence policy (byte-identity of every frozen record; format gate green in
checkout and clones). One minor caption inaccuracy was found in the closure
record's evidence table (RV-1) and one environment-only incident occurred
during the audit (RV-2); neither affects any acceptance-relevant claim.

```text
VERIFIED WITH NON-BLOCKING ISSUES — FORMAL T1 CLOSURE PERMITTED
```
