# Trading OS T2 — Independent Verification

> **Status:** Independent adversarial verification of Trading OS Stage T2 —
> Method and Capability Foundation, performed against the completed T2
> delivery at `1d372d7f5f76b63918bc1e2fa35d2a21b0367ca2`. Established
> 2026-09-11. This is the only file created in the repository by this audit.
> T2 is **not** formally closed by this document; T3 remains unstarted and
> blocked.

## 0. Independence statement

This audit was performed with no participation in the T2 implementation. The
implementation report was read only after the governing documents had been
read, a T2 acceptance matrix had been derived, the complete `ad860465… →
1d372d7…` diff had been inspected, and the consumed public VICT packages had
been examined. All conclusions below were re-derived from primary evidence:
real git objects, real registry responses, real SQLite files, real HTTP, and
real Chrome — never from test names, screenshots, or the implementation
report alone. The authoritative checkout was treated as read-only: no
production code, tests, manifests, lockfiles, configurations, active
specifications, historical reports, or screenshots were modified. All probes
ran in disposable locations: `/c/tmp/t2-audit-probes/` (scratch scripts, a
fresh external clone, an empty-cache install consumer, a registry-severed
consumer, and browser/SQLite/HTTP probe scripts with their own temporary
databases and screenshots). No `AGENTS.md` file exists in either repository
(verified by filesystem search).

One audit-process event is disclosed in §11 (AV-8): the canonical
`npx playwright test` run in the authoritative checkout reset Playwright's
gitignored `test-results/` output directory, which removed the implementing
agent's disclosed `test-results/t2-curated/` copies and earlier run outputs.
No tracked file and no committed evidence was affected (§1, §11).

## 1. Environment, exact SHAs and lineage

| Item                         | Value                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audited repository           | `C:\Users\RZ1\Desktop\RZ\260909-VCT-Trading` (remote `https://github.com/radz2291/VICT-Trading`)                                                                                                                                                                                                                                                                     |
| Audit start state            | `HEAD == origin/main == 1d372d7f5f76b63918bc1e2fa35d2a21b0367ca2` (verified after `git fetch`; tracked tree clean)                                                                                                                                                                                                                                                   |
| T1 formal closure (baseline) | `ad860465bf404b7bd1f4359c712f7f6bdf52a6d1`                                                                                                                                                                                                                                                                                                                           |
| T2 commits, in order         | `04ebbbf851057e89e272122a9a6f9a1cf63970a7` (domain, catalog, persistence) → `0b98203b095e777f622cad1b21e46be43dbac2ba` (authoring workspace) → `784498d82441d726fc05d8b512746f17d22b74f0` (lifecycle/verification tests — final executable tree) → `bb8230e8c5e29520b386288362018bb2ef309639` (architecture/report/evidence) → `1d372d7…` (cleanup-exception record) |
| Environment                  | Windows 10, Node v22.13.1, npm 10.9.2, Playwright 1.63.0, real system Chrome (`channel: 'chrome'`)                                                                                                                                                                                                                                                                   |

**Lineage.** `git merge-base --is-ancestor` proves a strictly linear chain:
`ad860465 → 04ebbbf → 0b98203 → 784498d → bb8230e → 1d372d7 (HEAD)`. The
remote was fetched at audit start and re-fetched at report time; it did not
advance. All five T2 commits are descendants of the T1 closure commit.

**Commit boundaries.**

- `784498d…` is the final executable implementation tree: it changes exactly
  6 files (surfaces test, playwright config, boundary scanner, architecture
  test, two browser specs). Every later commit is documentation/evidence
  only.
- `bb8230e…` changes exactly 12 files: README, roadmap, the T2 architecture
  document, eight `docs/evidence/t2/*.png`, and the T2 implementation
  report — as claimed.
- `1d372d7…` changes exactly one file
  (`docs/report/TRADING-OS-T2-METHOD-SYSTEM-IMPLEMENTATION.md`, +6/−4) to
  record the user-approved local cleanup exception, including the disclosed
  verification-clone path.

**Changed-file inventory** (`git diff --name-status ad860465..1d372d7`): 59
files — 4 manifests/lockfile, 13 app files, 10 domain files, 7 data files, 10
capabilities files (incl. README), 11 surfaces files, 3 test-config/script
files, 4 browser/architecture test files, 12 documentation/evidence files.
Inspected in full; contains **no** secrets, environment files, SQLite
databases, caches, dependencies, build output, test output, or temporary
files; **no** copied or locally linked VICT source (`git ls-files` contains
no VICT path; the lockfile contains no `260831-VCT-02` reference and no
`file:`/`link:`/git specifiers); **no T3+ behavior** (§9).

**Protected records.** All 17 protected T0/T1 records are byte-identical to
their `ad860465…` blobs, verified with `cmp` against `git show ad860465:…`:
both `docs/audit/*.md`, all four T1 reports (independent verification,
implementation, closure, closure re-verification), the Product Constitution,
the original Surface Architecture, and all nine `docs/evidence/t1*/` PNGs.
T1 remains formally closed and is not rewritten. Active documentation
(README, roadmap) truthfully reports T2 as _implemented — independent
verification required; not formally closed_ and T3 as not begun.

## 2. Acceptance matrix (derived before reading the implementation report)

From the Product Constitution (§3–§6, §8), Surface Architecture (§1–§6, §9,
§11), Roadmap (T2 scope/acceptance/exclusions and §2 flexibility proof), and
the T1 closure records:

| #   | Requirement                                                                                                                                                                                  | Source                                  | Result                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| A1  | Method = named lineage; Method Version = immutable unit with inputs, analysis layers, rules, judgment questions, risk requirements, execution assumptions, observation requirements, lineage | Constitution §5                         | **Pass with recorded trade-offs** (§5)         |
| A2  | Deterministic identity; no silent behavior change; capability revisions pinned                                                                                                               | Constitution §3.9, §5                   | **Pass** (§5)                                  |
| A3  | Independently versioned Workspace Profiles referencing compatible Method Versions; profile change never creates a Method Version                                                             | Roadmap T2 scope; Constitution §5       | **Partial — decision required** (§7)           |
| A4  | Capability authoring catalog, definitions only, atomic registration, revision-pinned                                                                                                         | Roadmap T2 scope                        | **Pass** (§6)                                  |
| A5  | Two contrasting fixtures, definition-only, zero shell changes (first flexibility gate)                                                                                                       | Roadmap T2 acceptance, §2               | **Pass** (§6)                                  |
| A6  | Clone/compare/version flows; cloning preserves provenance                                                                                                                                    | Roadmap T2; Constitution §5             | **Pass** (§5)                                  |
| A7  | Authoring through the registered VICT custom-surface boundary with native controls                                                                                                           | Roadmap T2 scope                        | **Pass** (§4, §8)                              |
| A8  | No evaluation/indicators/mode orchestration (T2 exclusions); no VICT upgrade                                                                                                                 | Roadmap T2 exclusions                   | **Pass** (§9)                                  |
| A9  | Persistence: versioned migrations from the closed T1 database, immutable versions, truthful failure/concurrency behavior                                                                     | Surface Arch §9; T1 closure F-4 lineage | **Pass** (§6)                                  |
| A10 | Shell/navigation free of strategy and framework vocabulary; `Definition available — Evaluation begins in T3` truthful                                                                        | Constitution §8; Surface Arch §3        | **Pass** (§8)                                  |
| A11 | Professional, accessible, responsive authoring UI                                                                                                                                            | Constitution §3.11; Surface Arch §10    | **Pass with one inherited visual defect** (§8) |
| A12 | Registry-only consumption of `@victframework/*@0.1.1` with unchanged release identity                                                                                                        | Roadmap standing rules                  | **Pass** (§3)                                  |

## 3. Registry and dependency integrity

- All six consumed packages are installed at exactly `0.1.1`:
  `@victframework/application`, `appdata-sqlite`, `contracts`,
  `renderer-svelte`, `sdk`, `scaffolder`. Manifest specifiers are exact
  versions (no ranges).
- `npm run verify:registry` (exit 0) re-verified: lockfile resolutions from
  `https://registry.npmjs.org` with integrity, installed realpaths inside
  this repository's `node_modules` (never the VICT checkout — realpaths
  independently confirmed via `fs.realpathSync`), and the live public
  registry release set recomputed to content ID
  `v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf` —
  unchanged from T1.
- Clean-clone install used an **empty npm cache** (`--cache` to a fresh
  directory) and succeeded from the registry alone.
- **Registry-severed probe:** a disposable consumer with command-scoped
  `--registry=http://127.0.0.1:9` and `--@victframework:registry=http://127.0.0.1:9`
  and an empty cache failed (`npm ci` exit 1), left an incomplete tree (no
  usable `@victframework/*` — `require` of the package fails), and has zero
  local-checkout references in its lockfile. Installation cannot fall back
  to the VICT checkout or any cache.
- Dependency changes vs `ad860465…`: workspace edges `trading-capabilities →
trading-domain` and `apps → trading-capabilities`, plus
  `@victframework/appdata-sqlite@0.1.1` made an explicit dependency of
  `trading-data` (already present in the accepted 0.1.1 release set and
  lockfile). **No new external dependency, no upgrade, no concealment
  vector.** The VICT reference repository was not modified (tracked tree
  clean; only a pre-existing untracked `.pi/` tooling directory) and the
  consumed 0.1.1 registry packages — not the checkout (which has advanced
  toward a 0.2.0 candidate) — are authoritative here.
- Plain `npm ci` in a separate disposable clone still fails on npm 10.9.2
  (exit 1, "lock file's yaml@1.10.3 does not satisfy yaml@2.9.0") — the
  documented F-12 limitation remains reproducible and truthfully recorded;
  the `--legacy-peer-deps` path remains necessary.

## 4. Package and composition architecture

Verified from source imports **and** emitted bundles:

- `trading-domain` imports only relative modules (architecture test enforces
  dependency-free manifests); it owns models, strict parsers, validation,
  canonicalization/fingerprint, comparison, lifecycle use cases, and the
  repository _port_. No Node builtins, no framework imports, no global
  mutable domain truth (all acknowledged state is `immutableCopy`-frozen).
- `trading-data`: the browser barrel (`.`) still exports only T1 fixtures;
  SQLite/Node code lives solely in the `./method-store` subpath, imported
  only by `apps/trading-os/src/lib/server/application-server.ts`. Emitted
  client bundles contain no `node:sqlite`/`node:fs`/`node:path`/SQLite
  markers (scanner + independent bundle grep).
- `trading-capabilities` depends only on `trading-domain` and contains
  metadata only (no evaluator, network, or clock — enforced by a permanent
  test that also bans capability IDs and "SS Breakout" from
  `trading-surfaces`).
- `trading-surfaces` contains presentation only; the Methods workspace
  renders entirely from catalog metadata (no hardcoded capability IDs; the
  extension test proves a new compatible definition needs no screen change).
- `apps/trading-os` is the sole composition root: it alone binds the SQLite
  repository, authoring catalog, method service, action dispatch, and
  per-shell client controller. The process-level server singleton holds only
  composed connections/services (database connections, adapters, grants) —
  appropriate for a single local server process; no domain truth lives at
  module scope. VICT does not depend on Trading OS.
- Server-only files (`$lib/server/`), filesystem paths, and SQLite details
  never enter client bundles (verified by the boundary scanner, its negative
  controls in §8, and manual bundle inspection).

## 5. Method lifecycle and immutable identity — independent proof

Independent probes (scratch scripts importing the real product modules, plus
real-HTTP probes against the built production server):

- **Identity normalization:** NFC (`Cafe\u0301` ≡ `Café`), CRLF→LF, and
  surrounding-whitespace trimming produce identical canonical bytes and
  fingerprints; JSON and configuration keys sort (order non-semantic);
  observation declaration order is normalized while capability dependency
  order remains semantic (reversing capabilities changes the fingerprint);
  changed name, description, rule policy, scope, config, or revision each
  change the fingerprint; changed instance IDs change the fingerprint
  (recorded trade-off, below); storage IDs, version numbers, timestamps,
  counters, provenance, and profiles are excluded (two versions differing
  only in those fields share a fingerprint and compare with zero changes).
- **Known vector:** `contentFingerprint('abc')` =
  `sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`,
  cross-checked against Node `crypto` independently of the product test.
- **Tamper evidence:** the store recomputes the SHA-256 from canonical bytes
  on every version read/insert; the record parser rejects canonical-bytes
  mismatch and malformed/future schemas fail closed without overwrite
  (`UNSUPPORTED_SCHEMA`/`INVALID_RECORD`), confirmed by direct SQLite
  injection probes.
- **Lifecycle:** draft saves are CAS-guarded (`expectedRevision`) and draft
  revisions never reset (no ABA — an older version starting a new revision
  gets `revision+1`, proven by test reading and probe); freezing requires a
  saved, valid draft, produces a sequential immutable version, consumes the
  draft, and records a receipt atomically; `revise` refuses when a draft
  exists (one mutable Working Draft per lineage — structurally safe
  incomplete drafts can be saved); `clone` creates a new lineage with
  pinned `sourceVersionId`/`sourceMethodId`/`sourceFingerprint`; revision
  and clone provenance verified by probes and store tests; archiving and
  deletion **do not exist** (no such operation, endpoint, or UI — absence,
  not partial implementation). Selecting/assigning a Method Version creates
  no run and leaves the shell at `No active run` (browser-verified).
- **Cross-boundary identity:** identical content yields identical
  fingerprints across fresh catalogs, independent databases, browser and
  Node (Web Crypto vs `node:crypto`), and a genuine new Node process
  (committed spawnSync test) and across a real production server restart
  (my HTTP probe: byte-identical `get` reply after kill + restart).
- **Recorded identity trade-offs (accepted, honest):** authored
  name/description are part of content identity (renaming a frozen lineage
  requires a new version — defensible for evidence attribution since each
  version carries the name it was frozen with, at the cost of version churn
  on cosmetic renames); random instance IDs participate in identity, so
  independently authored but semantically identical methods have different
  fingerprints (documented as "not graph-isomorphism normalization"). Both
  are consistent with the governing meaning of a Method Version as the unit
  of proof, provided the canonical copy — not the mutable lineage name — is
  the evidence anchor, which the architecture document states.

## 6. Persistence, concurrency and failure truth — independent probes

All against real SQLite files and real processes:

- **Immutability triggers:** direct SQL `UPDATE`/`DELETE` on
  `appdata_method_versions`, `appdata_method_requests`, and
  `appdata_workspace_profiles` are all aborted by triggers (probed).
- **Profile semantics at the store level:** append-only history confirmed —
  after assign → remove → second-workspace assign, the table holds
  `(wsA,1,v1)`, `(wsA,2,null)`, `(wsB,1,v1)`; stale CAS writes are refused
  with `CONFLICT`; methods are untouched by profile operations; multiple
  workspaces are isolated; `getProfile` returns the latest revision.
- **Concurrency:** committed tests (independently read and accepted) prove
  simultaneous freezes produce exactly one version and one receipt;
  simultaneous saves through two independent SQLite connections serialize
  with exactly one winner and a structured `CONFLICT` for the loser;
  injected mid-transaction failures roll back version, draft consumption,
  counter, and receipt together.
- **Idempotency over real HTTP (my probe):** same `requestId` + same payload
  replays the original byte-identical reply — including after the draft was
  consumed; same `requestId` + different payload (or different op) fails
  `IDEMPOTENCY_CONFLICT`; an exact-retry path in the client retains the
  failed command (browser-verified: the retried request is `toEqual` the
  failed one).
- **Migrations:** a genuine v1 (T1-foundation) database with pre-existing
  workspace rows migrates to `[1,2,3]` with rows retained; a future
  physical schema (`version 99`) refuses to open; a failed migration rolls
  back its statements and bookkeeping together; repeat migration is
  idempotent (applied versions are skipped by the VICT migrator, re-verified
  by reopen across all probes).
- **Corruption probes (disposable DBs, triggers dropped only to simulate
  out-of-product tampering):** version number column vs JSON number and
  method row id vs JSON id disagreements are _not_ cross-checked on read —
  a tampered row is returned as self-consistent JSON retrievable under the
  row key (`getMethod(rowId)` returns a record whose JSON id differs), and a
  profile row moved to another `workspace_id` reads as `null` under the
  original key. **No product write path can create these states** (columns
  are always derived from the same parsed record; inserts validate before
  writing), canonical-content tampering does fail closed, and the immutable
  rows cannot be modified in place without first dropping triggers.
  Classification: fail-open only under direct out-of-product database
  tampering — a hardening gap, not a reachable product failure. Recorded as
  finding AV-2 with a T3 hardening recommendation (cross-check indexed
  columns against parsed values on read).
- **Documented limitations assessed:** one draft per lineage (adequate for
  single-owner authoring; conflicts are structured, not silent); reads using
  `BEGIN IMMEDIATE` (correctness-favoring, acceptable at local scale);
  unbounded receipt/profile retention and no pagination (real but
  later-stage concerns; volume is tiny at T2 usage). Classified non-blocking.

## 7. Capability catalog, flexibility proof, and the mandatory expressiveness decision

**Catalog.** Exactly eight definition-only entries at revision `1`
(`analysis.range`, `analysis.mean`, `rule.range-relation`, `rule.mean-distance`,
`rule.session-window`, `judgment.question`, `risk.request`,
`execution.assumption`), all metadata bounded and meaningful; registration is
atomic (one invalid or duplicate definition aborts the whole catalog —
probed); duplicate ID/revision pairs throw; unsupported revisions remain
inspectable and savable but block freezing (browser-verified with a rev-99
fixture); references resolve only to compatible **earlier** instances
(forward references and dangling references are refused — probed), which
makes cycles unrepresentable by construction. No evaluator, indicator
implementation, clock, session execution, opportunity detector, signal, fill
model, or market-data read exists anywhere in the package (source-audited
and test-enforced).

**Fixtures.** The two contrasting fixtures (multi-context weekly/15-minute
range/session/judgment; single-context daily mean-distance) flow through the
same domain model, catalog, persistence, and the same generic surface with
zero shell or strategy-specific changes — the browser suite seeds them
through the public HTTP actions and drives them through the generic editor;
the architecture test proves no fixture vocabulary exists in the shell. The
T2 **first flexibility gate is satisfied**.

**Mandatory expressiveness probe (temporary data only).** The required
shape — higher-timeframe context AND (lower-timeframe trigger A OR
lower-timeframe trigger B) AND not-invalidated — **cannot be faithfully
authored today**: the single global `all`/`any` rule policy either ands
everything (context loses its gating role under `any`) or forbids
disjunction (`all`); rule instances cannot reference rule instances (rules
declare `output: null`, and `instance` fields resolve only to matching
analysis outputs — probed). **However**, my independent extension probe
constructed a compatible new capability definition (a composite rule with
two pinned `instance` references plus a context) and, with
`rulePolicy: 'all'`, expressed exactly `HTF-context AND (A OR B)`
structurally, with clean diagnostics — **without any Method schema change**.
"Not invalidated" is expressible as a relation vocabulary value in a future
definition revision.

**Decision.** The model satisfies T2's first flexibility gate and its
required structured composition (typed capability instances, explicit rule
policy, judgment/risk/execution kept distinct). The disjunction limitation
is real but does **not** force a Method schema redesign in T3:
disjunctive/composite conditions fit inside the existing capability
definition mechanism — the roadmap's explicitly permitted "new reusable
capability" change class — and `MethodContent@1` can remain stable. This is
recorded as finding AV-4 (accepted T2 limitation with a named T3 watch-item:
the first method requiring server-evaluated disjunction must add such a
composite definition — or explicit rule grouping — with recorded evidence,
and T3's evaluation core must consume the capability list in its declared
order).

Also probed and representable: zero analysis layers with a valid rule
(`rule.session-window` alone validates); multiple analyses feeding different
rules; one analysis feeding two rules (branching); more than one judgment
question; separate risk and execution declarations (rich-shape probe with 8
instances validates cleanly).

## 8. HTTP, SSR, client recovery, and boundary evidence

- **HTTP boundary:** all Method operations cross `/api/act`; action ID and
  op must match (mismatch → `INVALID_REQUEST`); malformed bodies, oversized
  bodies (>300 kB), unknown extra fields, future schemas, and unknown
  actions fail safely with stable codes; cross-origin requests are refused
  (403); read/write grants are checked server-side against the deployment
  grant list; responses use `no-store`; errors are sanitized (no paths,
  SQL, stack traces — browser test asserts negative regexes and my probes
  confirm stable prose only); SSR of `/research/methods` succeeds without
  browser-only behavior; reload produces no hydration errors (browser
  suite).
- **Client-boundary scanner negative controls (disposable clone):** a real
  `node:crypto` import in client code, injected SQLite table markers
  (`appdata_method_versions`, `appdata_workspace_profiles`),
  `createSqliteMethodRepository`, and product use of `localStorage` and
  `sessionStorage` each cause the scanner to fail (exit 1, all hits
  reported). After restoring sources and rebuilding, the scanner is green —
  the modified scanner still fails for every intended violation class while
  tolerating SvelteKit's own framework-internal `sessionStorage` use
  (source-level ban is scoped to product directories only). Boundary not
  weakened.
- **Client recovery (real browser, my probes + committed suite):** only
  validated server acknowledgement advances stored revision; uncertain saves
  retain the exact request ID and payload and lock further mutations until
  reconciliation (my probe confirmed `revise` is refused while an uncertain
  assign is unreconciled); failed saves keep authored text and retain a
  session recovery copy with download and explicit re-apply; conflict
  recovery reloads confirmed state and requires an explicit re-apply;
  `localStorage`/`sessionStorage` are never authoritative (bundle grep:
  zero occurrences in product code); dirty drafts survive SPA navigation
  with a truthful `Unsaved draft` status (probed); tab close/reload while
  dirty is guarded by `beforeunload`; failed Workspace Profile assignment
  does not alter the draft (finding AV-1 records a wording imprecision).
- **Server diagnostics concealment (task question):** the HTTP client maps
  every failure to fixed prose and drops server-side diagnostic arrays.
  In T2 this is covered because the identical `validateMethod` runs locally
  before any freeze and the server's only extra information (catalog
  disagreement) cannot occur within one build. Recorded as AV-7: a
  product-truthfulness gap only if server and client catalogs diverge in a
  later stage; carry forward as a note.

## 9. Real UI, keyboard, accessibility, responsive and screenshot evidence

Fresh independent screenshots were captured outside committed evidence
directories (`C:/tmp/t2-audit-probes/shots/`) from the real production build
served by the built Node adapter, in real Chrome, at 1440×900, 1024×768, and
390×844, and compared against all eight committed T2 screenshots. The
committed evidence is genuine: desktop frames are real 1440×900 captures of
the production UI (editor, composition, history, comparison, failure,
library) and mobile frames are real 390×844 captures; their content matches
my fresh captures' rendering, and their dimensions/totals match the report
exactly (eight PNGs, 1440×900 / 390×844, 574,971 bytes total).

Verified interactively (independent probes): empty library with honest
message; populated library; create dialog with visible labels; generic
metadata-driven editor (observations, capability composition, ordering
controls, validation diagnostics located on their fields); saved draft;
failed save (explicit failure, retained text, recovery banner); immutable
history with readable labels; revision; clone; semantic comparison with
understandable before/after (instance IDs resolve to labels like
"1. Range reference", ordering changes render as arrow chains, config keys
render with field labels); unsupported capability revision (inspectable,
freeze blocked); Workspace Profile assign/remove; command palette; shell
status `No active run`; `Definition available · Evaluation begins in T3`
truthful; fixture methods never presented as validated or profitable;
no strategy-specific vocabulary in navigation or shell; raw JSON only as a
supplementary read-only `<details>` view.

Keyboard and accessibility: modal Tab/Shift+Tab cycle correctly (probe:
wrap from last to first and back); Escape closes; focus returns to the
opener (probe-verified); focus outlines visible (committed test asserts
computed outline; probe focuses number field); reduced-motion exercised by
the committed suite; independent axe-core scans (WCAG 2.0/2.1 AA) returned
**zero violations at every severity** on the comparison view (desktop) and
the Methods screen at 390×844 — extending the committed scans, which assert
zero critical/serious across all covered views; form errors are associated
via `aria-invalid`/`aria-describedby`; history and comparison carry
accessible names and readable text alternatives; long IDs and fingerprints
wrap safely (committed evidence + fresh captures); desktop and mobile
navigation work; no horizontal page or shell overflow at any audited
viewport (probe + committed tests).

**Mandatory mobile clipping check (390×844).** The shell `Ctrl K` button
was measured geometrically: bounding rect `x=353.6, width=46.6` → right
edge **400.2px against a 390px viewport — approximately 10px of the
control's right side is clipped** (the "K" partially cut), exactly as the
committed `mobile-workspace.png` shows. The button remains keyboard-focusable,
its center point still hits the control (pointer target functional), and
`document.scrollWidth` reports no overflow because the strip clips rather
than scrolls — confirming that a scrollWidth-only check cannot see this.
Classification: **inherited T1 chrome defect** (`ContextStrip.svelte` is
unchanged by T2; T1's committed mobile evidence at 412px CSS width shows the
control fully visible; T2's 390px evidence is the first to expose the
clipping). Non-blocking for T2; recorded as AV-3 with a recommendation to
fix the strip's narrow-viewport layout at the next chrome-touching stage and
to add a geometric (bounding-rect) guard to the mobile suite.

## 10. Commands, exits, counts, skips and warnings

Authoritative checkout (this audit, after `npm ci --legacy-peer-deps
--registry https://registry.npmjs.org`, exit 0):

| Command                                    | Exit | Result                                                              |
| ------------------------------------------ | ---- | ------------------------------------------------------------------- |
| `npm run verify:registry`                  | 0    | 6 packages exact 0.1.1; release set `v1_e31e8dd6…` re-verified live |
| `npm run format:check`                     | 0    | all files Prettier-clean                                            |
| `npm run lint`                             | 0    | clean                                                               |
| `npm run typecheck`                        | 0    | tsc clean; `svelte-check found 0 errors and 0 warnings`             |
| `npm run build`                            | 0    | only the documented `node:sqlite` ExperimentalWarning               |
| `npm test`                                 | 0    | **16 files, 159 passed, 0 failed, 0 skipped**                       |
| `npm run verify:client-boundary`           | 0    | client bundle free of Node-only code (see §8 negative controls)     |
| `npm audit`                                | 0    | 0 vulnerabilities (full tree)                                       |
| `npm audit --omit=dev`                     | 0    | 0 vulnerabilities                                                   |
| `git diff --check`                         | 0    | clean                                                               |
| `npx playwright test`                      | 0    | **40 passed / 38 skipped**, real Chrome, no retries                 |
| `npm run test:domain`                      | 0    | 29 passed in 3 files                                                |
| `npm run test:capabilities`                | 0    | 9 passed in 1 file                                                  |
| `npm run test:data`                        | 0    | 27 passed in 2 files                                                |
| `npm run test:surfaces`                    | 0    | 28 passed in 4 files                                                |
| `npm run test:persistence`                 | 0    | 53 passed in 5 files                                                |
| shuffled-order runs (`--sequence.shuffle`) | 0    | trading-data 27/27; app 53/53                                       |

**Skip arithmetic verified:** 26 browser specs = 19 unchanged T1
(9 desktop + 5 persistence-truth + 1 laptop + 4 mobile, project-guarded) +
7 new T2 (`methods.spec.ts` 6 + `method-restart.spec.ts` 1). 26 × 3 projects
= 78 discovered; runnable = 19 T1 + 21 T2 (7 × 3) = 40; skips = 38 — all
intentional, pre-existing project guards. No T2 test is skipped; `retries: 0`
and `workers: 1` confirmed in the committed Playwright config; no test-timeout
overrides exist; browser runs use per-run isolated SQLite paths
(`trading-os-e2e-<pid>-<timestamp>`) and the restart spec spawns/stops the
real built production process on a reserved port with a temp directory.

**Clean-clone ladder** (external clone of the remote at `1d372d7…`, empty
npm cache, fresh database, real Chrome, no copied artifacts): plain `npm ci`
exit 1 (documented F-12, reproduced); then `npm ci --legacy-peer-deps
--registry …` (0) → `verify:registry` (0) → `format:check` (0) → `lint` (0)
→ `typecheck` (0) → `build` (0) → `npm test` (0; 159/159) →
`verify:client-boundary` (0) → `npm audit` (0) → `npm audit --omit=dev` (0)
→ `git diff --check` (0) → `npx playwright test` (0; 40 passed / 38
skipped); tracked tree clean afterward. **Every non-zero result in this
audit is recorded above with its diagnosis; no failure was silently rerun.**

## 11. Findings

| ID   | Severity                             | Governing requirement                                           | Summary / evidence                                                                                                                                                                                                                                                                                                                                                                                                                            | Impact                                                                                                                                                                                                                                                                                                                                        | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AV-1 | Minor (truthfulness)                 | Truthful failure states (Constitution §3.1, §3.8)               | A failed Workspace Profile assignment surfaces the generic `CONFLICT` prose "…Reload and reconcile your draft", naming the draft although only the profile assignment failed (probe: `assign` 409 → status text mentions "draft"; draft state untouched)                                                                                                                                                                                      | A trader could briefly believe the Method draft conflicted                                                                                                                                                                                                                                                                                    | **Non-blocking; T2-introduced.** Remedy at the next touch of the surface: profile-scoped diagnostics wording. No data risk: the draft is provably unchanged and mutations stay locked until reconciliation                                                                                                                                                                                                                                                                                       |
| AV-2 | Minor (hardening)                    | Durable application-domain state integrity (Surface Arch §9)    | Indexed-column/JSON disagreement (row id, method_id, version number, profile columns) is not cross-checked on read; reachable only by direct out-of-product SQLite tampering (probes in §6); canonical tampering does fail closed; immutable rows are trigger-protected                                                                                                                                                                       | None in-product; a corrupted row could be served under its row key                                                                                                                                                                                                                                                                            | **Non-blocking; T2-introduced defense-in-depth gap.** T3 should cross-check indexed columns against parsed values on read                                                                                                                                                                                                                                                                                                                                                                        |
| AV-3 | Minor (visual/a11y)                  | UI first-class; every control usable (Constitution §3.11)       | Shell `Ctrl K` button clipped ~10px at 390×844 (geometry in §9); inherited T1 chrome, first exposed at 390px by T2's own evidence; keyboard and pointer still functional; overflow checks blind to it                                                                                                                                                                                                                                         | Slightly degraded mobile chrome control                                                                                                                                                                                                                                                                                                       | **Non-blocking; inherited from T1** (ContextStrip unchanged in T2). Fix at the next chrome-touching stage; add a bounding-rect guard to the mobile suite                                                                                                                                                                                                                                                                                                                                         |
| AV-4 | Accepted limitation (expressiveness) | Structured machine-evaluable rule composition (Constitution §5) | Global `all`/`any` policy cannot express `HTF AND (A OR B)` directly (probe §7); a compatible composite capability definition expresses it without schema change (probe §7)                                                                                                                                                                                                                                                                   | Disjunctive methods need a new capability definition rather than authoring-time grouping                                                                                                                                                                                                                                                      | **Non-blocking; T2-introduced by design.** T3 watch-item: first disjunctive method adds a composite definition (or rule grouping) with recorded evidence; `MethodContent@1` remains stable                                                                                                                                                                                                                                                                                                       |
| AV-5 | Decision required at closure         | Workspace Profile definition (Constitution §5; Surface Arch §4) | The implemented `WorkspaceProfile` is an independently versioned, append-only, CAS-protected **reference** binding a workspace to one Method Version (verified §6) — not yet the governing _presentation recommendation_: it declares no panels, instruments, timeframes, or capability-backed outputs, its "compatibility" reduces to version existence (truthfully enforced), and the UI shows the raw version UUID (minor readability gap) | Profile cannot yet recommend on-screen information nor drive workspace opening (flexibility-proof item 3 not exercisable at T2)                                                                                                                                                                                                               | **Non-blocking for T2 under the roadmap's bounded T2 scope** ("independently versioned Workspace Profiles referencing compatible Method Versions" — satisfied; profile changes never create Method Versions — proven). Formal closure must record the decision required by the task: extend the profile to the full governing presentation recommendation before any stage consumes profiles to open workspaces, or explicitly re-scope that substance with a recorded product decision. See §14 |
| AV-6 | Minor (UX)                           | Understandable references                                       | Workspace Profile panel displays the raw Method-Version UUID (`mw-mono`); version history resolves the same identity to "Version N" elsewhere                                                                                                                                                                                                                                                                                                 | Traders must cross-reference history to decode the profile                                                                                                                                                                                                                                                                                    | **Non-blocking.** Display version number + name alongside the UUID at the next surface touch                                                                                                                                                                                                                                                                                                                                                                                                     |
| AV-7 | Observation                          | Truthful diagnostics                                            | The HTTP client maps all failures to fixed prose and drops server diagnostic arrays; T2 is fully covered because the identical validation runs locally before freeze and client/server catalogs cannot diverge within one build                                                                                                                                                                                                               | Potential concealment only if catalogs diverge in later stages                                                                                                                                                                                                                                                                                | **Non-blocking.** Carry forward: if server-side-only diagnostics become possible, surface them                                                                                                                                                                                                                                                                                                                                                                                                   |
| AV-8 | Audit-process note                   | —                                                               | My canonical `npx playwright test` run reset gitignored `test-results/` (Playwright's normal output-dir cleaning), removing the implementing agent's disclosed `test-results/t2-curated/` copies and earlier run outputs from this machine                                                                                                                                                                                                    | None: committed `docs/evidence/t2/` is tracked and byte-identical to HEAD (verified before and after); `.data/` residue (27 SQLite files + sidecars, 13 verification logs) and the disclosed verification clone at `C:\Users\RZ1\AppData\Local\Temp\trading-os-t2-verify-42b0c74d4e36499b894731a1a95f9874` (existence verified) are untouched | **Disclosed; no repository effect.** The curated copies remain preserved in git                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 12. Known limitations (assessed, accepted)

One mutable Working Draft per lineage; explicit-save authoring (no autosave
of Method drafts); recovery copies are session-only unless saved or
downloaded; whole-record library/history loads without pagination; unbounded
receipt and profile-history retention; reads under `BEGIN IMMEDIATE`;
single-owner local deployment with a fixed grant list; free-text
instrument/timeframe declarations (typed catalogs deferred); trusted
build-time catalog (no runtime plugin loading); Node 22 experimental SQLite
warning and the accepted T1 obligations (F-3 declaration shim and F-7
selector coupling as upgrade re-verification gates, F-12
`--legacy-peer-deps`, F-13 Desk sparsity) remain. Every limitation above is
documented by the implementation, classified here against actual T2 impact,
and none is a T2 blocker.

## 13. Exclusion boundary (T3+ absent)

Source-audited and grep-verified across all production packages and the app:
no historical market-data ingestion, real provider, indicator calculation,
candle/session evaluation, runtime rule interpreter, Method execution,
setup/opportunity detection, SS Breakout implementation, signal or
recommendation engine, future-data fencing, backtest, replay, simulated
fills, performance/evidence calculation, live monitoring, broker
integration or credentials, order ticket/submission, autonomous execution,
live risk enforcement, AI, deployment, dynamic navigation-group mutation, or
VICT upgrade/modification. T1's fixture chart data remains labeled
"Fixture data — not live". All `Backtest`/`Replay`/etc. remain the T0/T1
planned-route placeholders. The eight catalog definitions compute nothing.

## 14. Verdict

Decisions required by the task:

1. **Method model vs the flexibility/structured-composition gate:** satisfied.
   The two contrasting fixtures compose definition-only with zero shell
   changes; composition is structured and typed; the disjunction limitation
   (AV-4) is real but resolvable within the capability-definition mechanism
   without a Method schema redesign.
2. **Workspace Profile vs its governing product definition:** **not yet the
   full governing concept** — it is a genuinely independently versioned,
   append-only, conflict-safe selected-Method reference, not a presentation
   recommendation (AV-5). It satisfies the roadmap's bounded T2 wording and
   never mutates Method identity; the presentation-recommendation substance
   must either be delivered before any stage consumes profiles to open
   workspaces or be explicitly re-scoped by a recorded product decision at
   formal closure. This is a documentation-record obligation, not a
   remediation-the-code obligation, because T2's acceptance boundary
   (roadmap) does not include profile-driven workspace opening and no T2
   document claims it.
3. **Persistence and immutable identity:** trustworthy. Immutable versions,
   receipts, and profiles are trigger- and CAS-protected; identity is
   deterministic, verifiable, and tamper-evident; concurrency, retry,
   rollback, migration, and restart behavior were independently proven over
   real SQLite, real HTTP, and real processes.
4. **Real authoring UI:** professional, dense, understandable, accessible
   (independent axe scans clean at every severity on audited views; keyboard
   behavior verified), with one inherited minor chrome clipping defect
   (AV-3) and two minor wording/readability items (AV-1, AV-6).
5. **Can T3 safely build on this Method schema without redesigning T2:**
   **yes.** Canonical content, fingerprints, pinned capability revisions,
   provenance, and the transactional repository port are sufficient inputs
   for a deterministic evaluator; disjunctive composition fits the existing
   capability-definition mechanism; no identified finding requires schema
   changes.

```text
VERIFIED WITH NON-BLOCKING ISSUES — FORMAL T2 CLOSURE PERMITTED
```

**Conditions attached to formal closure** (for a later documentation-only
closure task; T2 is **not** closed here):

1. Record the Workspace Profile decision (AV-5): either commit the
   presentation-recommendation substance to a named later stage, or re-scope
   the governing definition explicitly, before any profile-driven workspace
   opening is claimed by the flexibility proof.
2. Carry AV-1, AV-2, AV-3, AV-4, AV-6, AV-7 as recorded obligations with the
   dispositions stated above.
3. Preserve this report byte-exactly (add it to `.prettierignore`'s evidence
   policy at closure if desired — deliberately not done in this audit, which
   formats this file to keep the gate green without touching configuration).

T3 remains unstarted and blocked until T2 is formally closed.
