# Trading OS T1 — Closure Record

**Stage:** T1 — Platform Shell and Trading-Surface Proof
**Record type:** Formal closure record (remediation and disposition of the
independent verification findings)
**Date:** 2026-09-10
**Status:** Remediation complete and fully verified in-repo; **formal closure
is conditional on a focused independent re-verification of the remediation**
(see §1 and §7).

---

## 0. Inputs and exact SHAs

| Item                                                | Value                                                                                                                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                                          | `C:\Users\RZ1\Desktop\RZ\260909-VCT-Trading` (remote `https://github.com/radz2291/VICT-Trading`)                                                                                                |
| Audit baseline (independent verification committed) | `279fb29e39c9de7d91c8d4efceeba8e1e9da7a18` — `HEAD == origin/main` at closure start (verified after `git fetch`); clean tracked tree                                                            |
| Governing audit                                     | [`TRADING-OS-T1-INDEPENDENT-VERIFICATION.md`](TRADING-OS-T1-INDEPENDENT-VERIFICATION.md) — preserved **byte-identically** through this closure (verified by `cmp` against the `279fb29` blob)   |
| Implementation report                               | [`TRADING-OS-T1-PLATFORM-SHELL-IMPLEMENTATION.md`](TRADING-OS-T1-PLATFORM-SHELL-IMPLEMENTATION.md) — formatted (audit F-1 disposition) with an appended Errata section; original body preserved |
| T0 reconciliation record                            | Byte-restored to its `22a6b34` revision (audit F-2 disposition); verified byte-identical to the `22a6b34` blob                                                                                  |
| Environment                                         | Windows 10, Node v22.13.1, npm 10.9.2, Playwright 1.63.0 against real system Chrome (`channel: 'chrome'`)                                                                                       |

Ancestry remains linear: `22a6b34 → 2889765 → cebfa9a → 94da4db → 279fb29 →
<this closure>`. The remote was confirmed not advanced before the closure
commit, and the push was a normal fast-forward.

## 1. Closure semantics — what is and is not claimed

The independent audit verdict at `279fb29` was **VERIFIED WITH NON-BLOCKING
ISSUES — FORMAL T1 CLOSURE PERMITTED**, with conditions carried into closure
(its §15): F-1 formatting remediation, an upstream VICT issue for the
renderer type shim (F-3), and F-4/F-11 remediation.

This closure performs those remediations — and several more — **after** the
audit. The remediation changes production behavior, most materially the
Workspace Instance persistence path (client save channel and server write
ordering). **Nothing in this record claims independent verification of the
remediated state.** The correct formal status is therefore:

```text
T1 IMPLEMENTED — INDEPENDENTLY VERIFIED AT 279fb29 (VERIFIED WITH
NON-BLOCKING ISSUES) — CLOSURE REMEDIATION APPLIED AND IN-REPO VERIFIED —
FOCUSED INDEPENDENT RE-VERIFICATION OF THE REMEDIATION REQUIRED BEFORE
FORMAL CLOSURE
```

The re-verification scope is bounded (§7): the remediation diff, the
persistence-truth behavior it introduced, and the adversarial test evidence —
not a repeat of the full T1 audit, whose verdict stands for `279fb29`.

## 2. Remediation summary by audit finding (F-1 … F-14)

| ID                                                         | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| F-1 (format gate fails)                                    | **Remediated.** Active documents (roadmap, implementation report, README, this record) are Prettier-formatted and `format:check` passes — in the authoritative checkout AND in fresh clones (a new `.gitattributes` enforces LF checkouts, fixing a pre-existing clone-vs-checkout gate divergence that prior clean-clone ladders never exercised). Evidentiary records are excluded from formatting by policy (`.prettierignore`) instead of being rewritten — the audit report is byte-identical to `279fb29`, and the T0 reconciliation was byte-restored to `22a6b34` (F-2). | Ladder §6; `git diff 279fb29 -- docs/report/TRADING-OS-T1-INDEPENDENT-VERIFICATION.md` is empty                            |
| F-2 (T0 record reformatted at T1)                          | **Remediated.** `docs/audit/TRADING-OS-T0-INDEPENDENT-REVIEW-RECONCILIATION.md` restored byte-exactly to the `22a6b34` revision; `docs/audit/*.md` and the T1 verification report are `.prettierignore`d forever so no future formatting can mutate evidence.                                                                                                                                                                                                                                                                                                                    | Byte-compare against `git show 22a6b34:…` passes; `.prettierignore` (with rationale) committed                             |
| F-3 (renderer-svelte ships no `dist/` types)               | **Deferred upstream (recorded obligation).** The consumer shim is verified non-behavioral by the audit (§5). Filing the upstream VICT issue requires the product owner; recorded here as a required pre-condition for any renderer upgrade, and the shim is an upgrade re-verification gate. No code change (none possible consumer-side).                                                                                                                                                                                                                                       | Audit §5; upgrade-gate noted in `shell.css` header and this record                                                         |
| F-4 (persistence failure truth)                            | **Remediated (primary closure work).** The save channel now truthfully exposes `saving` / `saved` / `failed`; failures are retried with a bounded backoff and never silently suppressed; hung requests time out; stale responses cannot corrupt newer state; page-hide flush closes the reload-inside-debounce loss gap; the server refuses stale and future-schema writes with structured codes. See §3.                                                                                                                                                                        | `services.svelte.ts`, `application-server.ts`, `ContextStrip.svelte`, `TradingShell.svelte`; tests §4; browser evidence §5 |
| F-5 (`⌘K` on Windows)                                      | **Remediated.** The strip button now renders a platform-aware label (`Ctrl K` on Windows/Linux, `⌘K` on Apple platforms), resolved client-side so SSR output stays deterministic. Browser test asserts `Ctrl K` on the Windows runner; accessible name unchanged.                                                                                                                                                                                                                                                                                                                | `ContextStrip.svelte`; `persistence-truth.spec.ts` (closure-evidence test); `docs/evidence/t1-closure/desktop-desk.png`    |
| F-6 (`aria-expanded=false` with visible popup)             | **Remediated.** The listbox popup (including its zero-results status row) is visible whenever the palette is open, so `aria-expanded` is now always `true` while the palette is open — it can never report "collapsed" with a visible popup. Unit-tested for both the with-results and zero-results states.                                                                                                                                                                                                                                                                      | `CommandPalette.svelte`; `TradingShell.test.ts` ("reports combobox expanded…")                                             |
| F-7 (shell CSS targets renderer-internal selectors)        | **Accepted limitation, documented in place.** The coupling is additive layout only (audit-confirmed); the failure mode of a renderer rename is degraded layout, not broken behavior. `shell.css` now documents the coupling, its failure mode, and its status as an upgrade re-verification gate. Upstream stable-host-hook proposal remains optional future work.                                                                                                                                                                                                               | `shell.css` header comment                                                                                                 |
| F-8 (dangling SHA cited in T1 report §1)                   | **Recorded as erratum.** The implementation report body is preserved; an Errata section records the correct SHA (`94da4db…`) and the F-1 ladder-claim correction. Historical report text was not rewritten.                                                                                                                                                                                                                                                                                                                                                                      | Implementation report, "Errata" section                                                                                    |
| F-9 (misleading "no module-level mutable singleton" claim) | **Remediated.** `services.svelte.ts` header now states accurately that all mutable service state is per-shell-instance and the only module-level value is the deterministic fixture market-data source (immutable memoized series). Also recorded in the report Errata.                                                                                                                                                                                                                                                                                                          | `services.svelte.ts` header; report Errata §3                                                                              |
| F-10 (load-induced unit-test timeout)                      | **Remediated at the cause; no timeout raised.** Root cause reproduced: under full-suite load, vitest's five projects oversubscribe CPU (8 logical cores), starving the 45 ms fixture loop past the strict 5 s default timeout (reproduced at 5.57 s under load; passed idle). Fix: `maxWorkers` bounded to half the cores in the root vitest config. The full suite then passed repeatedly under the same external CPU load that reproduced the failure, with unchanged wall time. Per-test timeouts remain at the strict default.                                               | `vitest.config.ts`; reproduction + fix evidence in the closure verification log                                            |
| F-11 (`prepare` fail-open)                                 | **Remediated.** `apps/trading-os` prepare is now `svelte-kit sync` (strict). A failing sync now fails install truthfully; build/typecheck still run sync strictly. Proven working by the fresh-clone `npm ci` ladder (§6).                                                                                                                                                                                                                                                                                                                                                       | `apps/trading-os/package.json`; fresh-clone ladder                                                                         |
| F-12 (plain `npm ci` fails on npm 10.9.2)                  | **Accepted limitation (upstream npm defect).** Unchanged from the audit; the documented `--legacy-peer-deps` workaround remains necessary and is recorded in the README. Not re-run per the audit's single-attempt record.                                                                                                                                                                                                                                                                                                                                                       | README; audit §3.4/§13 F-12                                                                                                |
| F-13 (Desk lower half sparse)                              | **Accepted limitation.** Honest presentation observation; Desk content arrives in later stages per the roadmap. No change (none authorized at T1).                                                                                                                                                                                                                                                                                                                                                                                                                               | Audit §10/§13                                                                                                              |
| F-14 (dev-tree advisories)                                 | **Remediated.** `happy-dom` 15.11.7 → 20.14.3 (critical VM-escape class fixed), `vite` 6.3.6 → 6.4.3 (high dev-server class fixed, override + direct dep), `cookie` overridden to `^0.7.0` (installed 0.7.2; fixes the `@sveltejs/kit`-chained advisory; kit remains 2.70.3 = latest). Full-tree `npm audit` is now **0 vulnerabilities** (was 1 critical, 1 high, 8 further). Unit, typecheck, build, and the full browser suite pass on the upgraded tree.                                                                                                                     | `package.json`, `apps/trading-os/package.json`, `package-lock.json`; ladder §6                                             |

## 3. The F-4 remediation in detail (production behavior change)

**Client save channel** (`apps/trading-os/src/lib/services.svelte.ts`):

- `WorkspaceService` gains `saveState: 'idle' | 'saving' | 'saved' | 'failed'`
  (new `WorkspaceSaveState` type in `@trading-os/trading-surfaces`) and
  `flush()`. The shell's context strip renders the state truthfully
  (`Saving…`, `Workspace saved`, `Save failed — not persisted`) with
  `role="status"` and a state dot — never color alone.
- Every genuine change bumps a state version and (re)schedules the single
  debounced save (300 ms, unchanged). At most one save timer exists.
- Each request is stamped with a monotonic sequence and the state version it
  carries. A stale (superseded) response — success or failure — cannot
  change the channel state; a success that raced a newer change schedules an
  immediate follow-up save instead of falsely reporting the newer state
  saved.
- Failures retry with bounded linear backoff (500 ms × attempt, max 3
  attempts per episode) and always snapshot the latest state (a change made
  during a delay or retry rides the next attempt). Budget exhausted ⇒ the
  strip shows the explicit failed state; the next genuine change re-arms the
  channel.
- Each request carries a 5 s timeout (abort), so a hung server cannot pin
  `saving` forever.
- `flush()` (bound to `pagehide` on the shell) persists immediately with
  `keepalive` whenever un-persisted state exists, closing the
  reload-inside-the-debounce-window loss gap the audit measured.
- An unmounted shell does not cancel a pending save (the timer closure still
  fires) — preserving the audit's probe-A8 no-loss property.

**Server write ordering** (`apps/trading-os/src/lib/server/application-server.ts`):

- The persisted record's `updatedAt` (client-issued per attempt) is now
  preserved as the write-ordering token instead of being re-stamped by the
  server.
- `act.saveWorkspace` refuses a strictly older write with structured
  `STALE_WRITE` and refuses to overwrite a stored record this build cannot
  parse (e.g. a future schema) with structured `SCHEMA_CONFLICT` — a
  data-destroying downgrade is never silently performed. Equal-timestamp
  replays remain idempotent; newer writes are accepted.
- Reads are unchanged in behavior: an unreadable record yields the documented
  default (fail safe), now via an explicit `EMPTY | UNPARSABLE` record read.

**Documented residual limitation.** Two literally concurrent writes can still
interleave read-then-write and serialize at SQLite last-write-wins (a
conditional update needs adapter support the 0.1.1 data port does not
expose). Sequential stale arrivals — the realistic retry/replay case — are
fully refused. Recorded for the T3 persistence work; single-user impact is
one coalesced layout change at worst, self-healing on the next save.

## 4. Adversarial test evidence (new)

**Unit — client save channel** (`apps/trading-os/src/lib/__tests__/workspace-save.test.ts`,
15 tests, fake timers + controlled fetch doubles):

1. saving → saved across the debounce window (single request, latest state);
2. rapid changes coalesce into one save;
3. network failure retries with backoff then truthfully `failed`, with
   nothing further scheduled (no silent hammering);
4. structured non-2xx rejections count as failed attempts, retry, recover;
5. a change during the retry window rides the next attempt (latest state);
6. delayed responses keep the channel truthfully `saving`;
7. hung requests are aborted (timeout) and retried;
8. out-of-order responses: a stale failure cannot corrupt a newer `saved`;
9. out-of-order responses: a stale success cannot mask a newer `failed`;
10. a success that raced a newer change does not report the newer change
    saved (immediate follow-up save carries it);
11. `flush()` persists immediately with `keepalive` inside the debounce
    window;
12. `flush()` is a no-op when everything is persisted;
13. `flush()` after terminal failure attempts immediate recovery;
14. a pending save survives losing the service reference (teardown safety);
15. a failed episode recovers on the next genuine change.

**Unit — server ordering** (`apps/trading-os/src/lib/server/__tests__/persistence.test.ts`,
+3 tests over the real SQLite adapter): stale write refused (`STALE_WRITE`)
with the newer state retained; equal-timestamp replay idempotent and newer
write accepted; a future-schema record forced directly into SQLite is refused
on save (`SCHEMA_CONFLICT`) and never overwritten, while reads still fail
safe to the documented default.

**Unit — shell** (`TradingShell.test.ts`, +4): the strip exposes
`saving`/`saved` through a real palette-driven workspace command; the failed
state renders after the retry budget exhausts; `pagehide` triggers an
immediate `keepalive` save inside the debounce window; the palette reports
`aria-expanded="true"` with a visible popup including at zero results (F-6).

**Browser — real Chrome, production build** (`test/browser/persistence-truth.spec.ts`,
desktop project, 5 tests): strip cycles saving → `Workspace saved` on genuine
changes (screenshot evidence); with `/api/act` severed the strip turns
explicitly negative (`Save failed — not persisted`, screenshot evidence) and
recovers to `Workspace saved` when the server returns; a pagehide-flushed
change survives a full reload; the save indicator introduces zero
critical/serious axe violations; and the closure-evidence check asserts the
platform-aware `Ctrl K` label.

**Full suite totals:** 99 unit tests across 11 files (was 77/10 before
closure), and the canonical browser suite across all three viewport projects:
**19 passed / 38 skipped, exit 0** (was 14/28). No test was weakened, skipped,
or loosened; per-test timeouts remain at vitest's strict 5 s default.

## 5. Visual inspection of the real UI (post-remediation)

Fresh screenshots from the production build served by `vite preview`, real
Chrome, captured by the browser suite at closure time into
`docs/evidence/t1-closure/` (once, then frozen — runs now write evidence to
gitignored `test-results/evidence/` so no run can ever mutate committed
evidence) and inspected:

| File                              | View                        | Inspection result                                                                      |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `desktop-desk.png`                | Desk, 1440×900              | `Ctrl K` label (F-5); truthful chrome; declared navigation; no layout regression       |
| `desktop-markets-saved.png`       | Markets, Balanced, 1440×900 | `Workspace saved` in the strip; chart, watchlist, controls intact                      |
| `desktop-markets-save-failed.png` | Markets, Inspect, 1440×900  | `Save failed — not persisted` in warning color with dot + text; workspace fully usable |

The historical T1 evidence in `docs/evidence/t1/` is preserved byte-identical
(verified against `279fb29`; the closure browser run initially overwrote
these files — they were restored before committing, and the suite was
re-pointed at gitignored paths so this class of mutation cannot recur); the
closure evidence is additive.

## 6. Verification ladder (authoritative checkout, exact results at closure)

| #   | Command                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run verify:registry`                                                                                                                                                                            | exit 0 — 6 packages at exact 0.1.1, release set `v1_e31e8dd6…` verified                                                                                                                                                                                                                                                                                                                                                     |
| 2   | `npm run format:check`                                                                                                                                                                               | **pass (was failing at `94da4db`/`279fb29` — F-1)**                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | `npm run lint`                                                                                                                                                                                       | clean, exit 0                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | `npm run typecheck`                                                                                                                                                                                  | tsc clean; `svelte-check found 0 errors and 0 warnings`                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | `npm run build`                                                                                                                                                                                      | success (Node `node:sqlite` experimental warning only, from `@victframework/appdata-sqlite`)                                                                                                                                                                                                                                                                                                                                |
| 6   | `npm test`                                                                                                                                                                                           | **99 passed (99)** across 11 files; also passed twice more under 6–8 external CPU burners (F-10 fix evidence)                                                                                                                                                                                                                                                                                                               |
| 7   | `npm run verify:client-boundary`                                                                                                                                                                     | OK — client bundle free of Node-only storage code                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | `npm audit --omit=dev`                                                                                                                                                                               | **0 vulnerabilities**                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9   | `npm audit` (full tree)                                                                                                                                                                              | **0 vulnerabilities** (was 10: 1 critical, 1 high, 6 moderate, 2 low — F-14)                                                                                                                                                                                                                                                                                                                                                |
| 10  | `git diff --check`                                                                                                                                                                                   | clean                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 11  | `npm run test:e2e` (canonical, 3 projects, real Chrome)                                                                                                                                              | **19 passed / 38 skipped, exit 0**                                                                                                                                                                                                                                                                                                                                                                                          |
| 12  | Fresh external clone of the closure commit → `npm ci --legacy-peer-deps` → `verify:registry` → `format:check` → `lint` → `typecheck` → `build` → `npm test` → `verify:client-boundary` → `npm audit` | all exit 0, verified with unmasked per-step exit codes (strict `prepare: svelte-kit sync` included — F-11). `format:check` in a fresh clone exposed a pre-existing gate divergence: Windows autocrlf checkouts materialized CRLF and failed Prettier — never caught because prior clean-clone ladders omitted the gate. Fixed by a new `.gitattributes` enforcing LF checkouts; the gate now behaves identically everywhere |

The reproduce-then-fix evidence for F-10: with the previous config, the
36-series fixture test failed at 5.57 s under external CPU load (matching the
audit's 6.07 s observation); with bounded workers, the full suite passed
repeatedly under the same load, transform CPU totals halved, wall time
unchanged.

## 7. Focused independent re-verification required (bounded scope)

Because the remediation changed production behavior after the audit, formal
closure requires a focused independent re-verification of exactly:

1. **The persistence-truth remediation (§3)** — client save-channel states
   and server write ordering, against the real application in a real
   browser, including failure, retry, stale, flush, and recovery behavior;
2. **The adversarial test inventory (§4)** — that the tests exist, run, and
   actually assert what they claim (no weakening of pre-existing tests);
3. **The F-10 fix** — full-suite stability under load with strict timeouts;
4. **The F-14 dependency upgrades** — clean audit and green ladder on the
   upgraded tree;
5. **The evidence policy** — audit records byte-identical to their audited
   revisions (F-1/F-2 handling).

Everything else about T1 stands on the independent audit at `279fb29` and is
not re-litigated.

## 8. Explicitly not done (boundary discipline)

- **T2 is not started and is not authorized by this record.** No method
  model, capability pack, authoring surface, or method vocabulary exists.
- No VICT source was copied, linked, or modified; the reference checkout
  remains read-only and unreferenced at runtime (release identity
  re-verified at closure by `verify:registry`).
- No runtime database, secret, or build output is committed (`.gitignore`
  covers `.data/`, `test-results/`, build output; `git ls-files` verified).
- The upstream VICT obligations (F-3 issue; optional F-7 host-hook proposal)
  remain with the product owner — recorded, not discharged.

## 9. Formal T1 status

```text
T1 IMPLEMENTED — INDEPENDENTLY VERIFIED AT 279fb29 (VERIFIED WITH
NON-BLOCKING ISSUES, F-1…F-14) — CLOSURE REMEDIATION APPLIED AND VERIFIED
IN-REPO (LADDER §6 GREEN, 99/99 UNIT, 19/0 BROWSER, 0 AUDIT) — FINDINGS:
9 REMEDIATED (F-1, F-4, F-5, F-6, F-9, F-10, F-11, F-14 + F-2 RESTORATION),
1 ERRATUM RECORDED (F-8), 3 ACCEPTED LIMITATIONS (F-7, F-12, F-13),
1 DEFERRED UPSTREAM (F-3) — FOCUSED INDEPENDENT RE-VERIFICATION OF THE
REMEDIATION REQUIRED BEFORE FORMAL CLOSURE — T2 NOT STARTED
```
