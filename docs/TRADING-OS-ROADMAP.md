# Trading OS Roadmap

> **Status:** Authoritative staged roadmap for Trading OS, established at T0.
> Stage boundaries are bounded and dependency-ordered; refinements require
> evidence and must preserve the dependency logic. Terminology follows
> [`TRADING-OS-PRODUCT-CONSTITUTION.md`](TRADING-OS-PRODUCT-CONSTITUTION.md).

## 0. Roadmap shape

Each stage is bounded: it has defined inputs, a small number of product
decisions, acceptance evidence, and explicit exclusions. Later stages never
silently redefine earlier ones. The dependency spine:

```text
T0 foundation ──▶ T1 shell + surface proof ──▶ T2 method/capability model
   ──▶ T3 deterministic data + evaluation ──▶ T4 backtest + replay
   ──▶ T5 evidence + review ──▶ T6 Live Watch ──▶ T7 Assisted Live
   ──▶ T8 AI-assisted investigation
```

Modes arrive in evidence order: first with synthetic data (T1–T2), then
deterministic historical data (T3–T4), then recorded evidence (T5), then the
current market without orders (T6), then the current market with human-
authorized orders (T7). AI arrives last, governed, after the evidence spine it
is supposed to investigate actually exists.

Standing rules for every stage:

- The Method-flexibility proof (§2) applies from T2 onward.
- No stage claims an untested surface capability as production-ready.
- VICT is consumed at the pinned release-set identity; upgrades are explicit
  re-verification events.
- Every stage ends with updated documents and a clean, reviewed commit.
- The T1 gate carries an external VICT dependency (GAP-CANDIDATE-2, audit
  §6): T1 does not begin until a released VICT version supplies declared
  navigation-group ordering, or the product explicitly re-scopes with a
  recorded decision.

## Stage map

| Stage | Name                                     | Core question answered                                                                                                |
| ----- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| T0    | Product and Surface Foundation           | What is the product, what does VICT actually give us, and how is the platform shaped?                                 |
| T1    | Platform Shell and Trading-Surface Proof | Does a real consumer app on public VICT packages give us a professional shell and one credible custom market surface? |
| T2    | Method and Capability Foundation         | Can methods be defined, versioned, cloned, and compared with capabilities composed — no application code?             |
| T3    | Deterministic Market Data and Evaluation | Is there one canonical, deterministic evaluation core over stored historical data?                                    |
| T4    | Backtest and Blind Replay                | Do Backtest and Replay produce identical-behavior, future-fenced evidence?                                            |
| T5    | Evidence and Trader Review               | Does the Journal/Evidence spine make every opportunity and decision reviewable?                                       |
| T6    | Live Watch                               | Can the method observe the current market and record opportunities without orders?                                    |
| T7    | Assisted Live                            | Can the trader operate for real with retained authority and full records?                                             |
| T8    | AI-Assisted Investigation                | Can AI investigate evidence and propose hypotheses without inventing signals?                                         |

---

## T0 — Product and Surface Foundation (this stage)

**Delivered:** README, Product Constitution, Surface Architecture, VICT
Consumer-Fit Audit, the T0 independent-review reconciliation record, this
roadmap. No code, no dependencies, no mockups.

**Exit:** documents committed and reviewed; framework facts cited with
repository evidence; product decisions separated from framework facts.

---

## T1 — Platform Shell and Trading-Surface Proof

**Status: implemented, independently verified, and formally closed.**
Implemented on public VICT
`@victframework/*@0.1.1` (release set `vict-release-set@1/0.1.1`,
content ID `v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf`
verified by recomputation). GAP-CANDIDATE-2 was closed by the verified public
VICT 0.1.1 release: the renderer emits navigation groups in first-occurrence
route order, and the compiled plan renders the exact declared group sequence
(Research → Practice → Operate → Review → System) — see
`docs/report/TRADING-OS-T1-PLATFORM-SHELL-IMPLEMENTATION.md` and
`docs/evidence/t1/` for the full record.

The independent audit
(`docs/report/TRADING-OS-T1-INDEPENDENT-VERIFICATION.md`, preserved
byte-exactly) verified every T1 acceptance criterion in a real browser and
returned **VERIFIED WITH NON-BLOCKING ISSUES — FORMAL T1 CLOSURE PERMITTED**.
The closure remediation (see
`docs/report/TRADING-OS-T1-CLOSURE.md`) then resolved the audit's findings:
most notably the persistence channel now truthfully exposes `saving` /
`saved` / `failed` states with bounded retries, request timeouts,
stale-response guards, page-hide flush, and server-side stale-write refusal,
covered by adversarial tests; `format:check` passes with evidentiary records
byte-frozen by policy; the F-10 load-induced unit-test timeout was fixed at
its cause (worker oversubscription — no timeout was raised); and dev-tree
audit advisories were eliminated (0 vulnerabilities).

**The remediation changed production behavior — especially the persistence
path — after the independent audit.** It was therefore independently
re-verified in a focused audit
(`docs/report/TRADING-OS-T1-CLOSURE-REVERIFICATION.md`, committed at
`dda040a7bf92e9bcb718d6fa255e70706078d5fc`), which returned **VERIFIED WITH
NON-BLOCKING ISSUES — FORMAL T1 CLOSURE PERMITTED** and confirmed T2 had not
begun. T1 is formally closed (see the closure record for the full lineage:
implementation `94da4db` → initial independent audit `279fb29` → closure
remediation `5a726d8` → focused re-verification `dda040a` → formal closure).
The accepted and deferred obligations carried forward are: F-3 (upstream VICT
`renderer-svelte` declaration defect; the type shim is an upgrade
re-verification gate), F-7 (renderer-selector coupling, same upgrade gate),
F-12 (documented npm 10.9.2 `--legacy-peer-deps` install workaround), and
F-13 (accepted Desk sparsity); the re-verification notes RV-2/RV-3 are
audit-environment/verification records, not product blockers, and RV-1 was
corrected in the closure record.

**Purpose.** Prove the consumer pattern and the platform shell with a narrow,
honest vertical — before any method engine exists.

**Scope.**

1. A **separate consumer application** installed from exact public VICT
   packages (`@victframework/*@0.1.1`, release set `vict-release-set@1/0.1.1`),
   scaffolded with `@victframework/scaffolder`, lockfile-integrity verified.
2. A **professional platform shell**: a product-owned `TradingShell`
   composition root in `apps/trading-os` — context strip (active
   program/account/workspace context and its mode), command palette,
   data-health indicator, and background-operations indicator — composed
   around the canonical public VICT renderer (`VitApp`), which renders the
   neutral Application Definition (`vict.application@2`): top-level Desk
   and Markets entries plus the Research, Practice, Operate, Review and
   System navigation groups, screens, regions, and safe states, entirely
   from the definition. Shell chrome components are product components
   bound to product-owned state and services; VICT renders all navigation
   and screen content. **Entry gate:** T1 does not begin until a released
   VICT version supplies declared navigation-group ordering
   (GAP-CANDIDATE-2) — within-group order alone cannot render the group
   sequence — unless a recorded decision explicitly accepts VICT's
   alphabetical group order and withdraws the central-loop-order claim.
3. **Structured VICT routes/layouts/state**: navigation groups, screens,
   regions, declared safe states, theme tokens.
4. **One registered custom market surface** (`trading.market-chart@1`):
   candlestick + volume rendered from **synthetic/fixture market data**,
   with shared cursor within the surface and explicit stale/empty states.
5. **Persistent workspace configuration**: workspace panel layouts saved as
   typed application-domain resources and restored across restart.

**Explicit exclusions.** No broker connection, no real trading, no real
market data provider, no method engine, no strategy-specific shell (a fixture
method may exercise the surface only as data — it appears nowhere in
navigation or shell vocabulary).

**Acceptance criteria.** _(all verified in the T1 implementation report;
screenshot evidence in `docs/evidence/t1/`)_

- Fresh clone → install (exact versions from public registry) → build → run,
  with lockfile integrity recorded; no monorepo leakage.
- Shell renders from one Application Definition; adding a route/screen
  requires definition change only.
- `trading.market-chart@1` renders fixture candles; unknown/unregistered
  component revisions fail with structured diagnostics.
- Saved workspace layout survives a real restart; safe states demonstrable
  (loading, empty, stale, failure).
- Renderer and data-adapter conformance suites pass in-repo.
- No strategy vocabulary in the shell; `git diff --check` clean.

---

## T2 — Method and Capability Foundation

**Status: implemented, independently verified, and formally closed.**
The Methods workspace authors, validates, freezes, revises, clones and compares definitions,
with independent Workspace Profile references. See
`docs/architecture/TRADING-OS-T2-METHOD-SYSTEM.md` and
`docs/report/TRADING-OS-T2-METHOD-SYSTEM-IMPLEMENTATION.md`.

Implementation lineage, strictly linear from the T1 formal closure
`ad860465bf404b7bd1f4359c712f7f6bdf52a6d1`:
`04ebbbf851057e89e272122a9a6f9a1cf63970a7` (domain, catalog, transactional persistence) →
`0b98203b095e777f622cad1b21e46be43dbac2ba` (authoring/version workspace) →
`784498d82441d726fc05d8b512746f17d22b74f0` (lifecycle/restart/browser/architecture evidence —
final executable tree) → `bb8230e8c5e29520b386288362018bb2ef309639` (architecture,
implementation report, curated evidence) → `1d372d7f5f76b63918bc1e2fa35d2a21b0367ca2`
(cleanup-exception record) → `d18aa2101cc6de4d748f4208fb095b8758b37de5` (independent
verification committed). The independent audit
(`docs/report/TRADING-OS-T2-INDEPENDENT-VERIFICATION.md`, preserved byte-exactly, committed
at `d18aa21`) returned, verbatim:

```text
VERIFIED WITH NON-BLOCKING ISSUES — FORMAL T2 CLOSURE PERMITTED
TRADING OS T2 INDEPENDENTLY VERIFIED — FORMAL CLOSURE PERMITTED
TRADING OS T3 HAS NOT BEGUN
```

T2 is formally closed by the closure record
(`docs/report/TRADING-OS-T2-CLOSURE.md`), which records the exact lineage, the AV-1…AV-8
dispositions, the closure decisions, and the verification and preservation results.
Carried obligations (concise): AV-1 profile-failure wording at the next surface touch;
AV-2 read-side column/JSON cross-check hardening before any external import, repair,
multi-user, or deployment boundary; AV-3 the inherited T1 mobile `Ctrl K` clipping (~10 px
at 390×844 — required correction no later than the next stage's formal closure, preferably
when shell/mobile UI is next touched); AV-4 disjunction via reusable revision-pinned
composite capability definitions proven by T3's evaluator; AV-6 UUID readability at the
next surface touch; AV-7 server-diagnostic surfacing if client/server catalogs can diverge;
plus the T1 obligations F-3/F-7 (renderer upgrade re-verification gates), F-12
(`--legacy-peer-deps`), and F-13.

**Workspace Profile boundary (AV-5 decision):** the accepted `trading.workspace-profile@1`
is an independently revisioned, append-only association between a Workspace and one pinned
Method Version — **not** the complete governing presentation recommendation of the
Constitution and Surface Architecture (no panels, instruments, timeframes, arrangements, or
capability-backed information requirements; no profile-driven workspace opening is claimed
or implemented). A fuller representation requires an explicit new schema/revision and
migration with compatibility and presentation-recommendation semantics specified first, and
is a mandatory gate before T4 implementation begins — or earlier if T3 introduces any
profile-driven workspace behavior. **`MethodContent@1` is accepted, as independently
verified, as the T3 foundation without redesign.** T3 has not begun.

**Purpose.** Make methods first-class, versioned, and composable.

**Scope.** Method/Method Version model in `packages/trading-domain` (inputs,
analysis layers, rules, judgment questions, risk requirements, execution
assumptions, observation requirements, lineage, deterministic identity);
independently versioned Workspace Profiles referencing compatible Method
Versions; capability authoring catalog in `packages/trading-capabilities` (reusable
analysis, rule, session, judgment, risk and execution **definitions only**,
registered atomically and revision-pinned; calculation/evaluation implementations
and governed job boundaries remain T3, per the definition-only gate below);
authoring through the registered VICT custom-surface boundary with native controls; clone/compare/version flows; capability
discovery and configuration surface (product composition over pack
metadata).

**Flexibility proof introduced here:** the two contrasting method fixtures
(§2) must compose **definition-only** — the first gate of the flexibility
proof.

**Exclusions.** No real or synthetic time-series evaluation yet; no mode
orchestration.

**Acceptance.** Two contrasting fixture methods defined with zero shell
changes; version lineage and comparison demonstrable; capability packs install
atomically with pinned revisions.

---

## T3 — Deterministic Market Data and Evaluation

**Status: permitted — not started.** T2 is formally closed (see
`docs/report/TRADING-OS-T2-CLOSURE.md`); `MethodContent@1` is the accepted foundation. No T3
market data, evaluation, jobs, indicators, opportunities, or performance calculations exist.

**Purpose.** One canonical evaluation core over deterministic stored data.

**Scope.** `packages/trading-data`: bar store, ingestion adapters (fixtures
first), bar schema and migrations, data health model (implements the
market-data port owned by `trading-domain`; bound at the composition root).
`packages/trading-capabilities`: the canonical evaluation core invoked by
all four modes — a pure, deterministic, in-process computation layer
(indicators, rules, bar-by-bar execution; independently unit-testable; no
per-candle framework persistence or authorization overhead) wrapped by
coarse governed VICT capability job boundaries (start evaluation, ingest a
bounded dataset, persist evidence), identity-pinned (method version +
calculation revisions + governed capability revisions in the run identity).
Performance calculation capabilities. No performance claims without
measurement.

**Exclusions.** No live provider, no broker, no interactive sessions yet.

**Acceptance.** Same method version + same data range + same capability
revisions ⇒ byte-identical evaluation outputs across repeated runs; bars
store survives restart; data health states truthful.

---

## T4 — Backtest and Blind Replay

**Purpose.** The first two operating modes end-to-end.

**Scope.** Backtest runs as governed durable runs (accelerated, simulated
fills); blind Replay with product-local replay clock and future-data fencing;
replay surface (clock controls, hidden future); opportunity records from
both modes — decisions recorded only where a human decided (Backtest records
none); risk-constitution evaluation in the loop.

**Exclusions.** No current-market data, no Live Watch, no AI.

**Acceptance.** Replay never exposes post-clock data (fencing evidence);
backtest and replay produce the same opportunity record schema (decisions
recorded only where a human decided); simulated fills are labeled simulated;
risk vetoes recorded.

---

## T5 — Evidence and Trader Review

**Purpose.** The review spine: every opportunity and decision reviewable.

**Scope.** Journal and Evidence surfaces over recorded opportunities,
decisions, runs, and sessions; per-Method-Version performance, equity/
drawdown/distribution views; evidence lineage (mode, method version,
capability revisions, data range); export of evidence records.

**Acceptance.** A method version's full evidence chain is reconstructable from
records alone; comparison surfaces show structural and performance deltas
between versions.

---

## T6 — Live Watch

**Purpose.** The method observes the current market; nothing is ordered.

**Scope.** Live data ingestion for watch-mode instruments; background
observation loops as governed durable runs; Live Watch monitor surface;
opportunity records; data-freshness/stale behavior under live
conditions; **decision on GAP-CANDIDATE-1** (subscription data binding):
either the polling composition is confirmed adequate or a framework proposal
is written with evidence.

**Exclusions.** No broker orders of any kind; no Assisted Live surfaces.

**Acceptance.** Live Watch runs survive restart; observation evidence records
continuously; zero broker connectivity exists in the codebase path.

---

## T7 — Assisted Live

**Purpose.** Real-market operation with human authority.

**Scope.** Assisted-live desk surfaces; ticket composition (market context +
method output + risk evaluation) with explicit trader confirmation; broker
adapter behind a typed, human-gated boundary; full decision records; risk
constitution enforcement (hard limits cannot be executed through; soft-limit
acknowledgments recorded; constitution changes are deliberate and
versioned).

**Exclusions.** No autonomous execution — ever. No AI authority.

**Acceptance.** No code path can place a broker order without an explicit
human confirmation event; every order links to its opportunity, method
version, and risk evaluation; restart recovery preserves the live session
state truthfully.

---

## T8 — AI-Assisted Investigation

**Purpose.** AI investigates evidence and proposes hypotheses — never signals.

**Scope.** VICT ProductAgent boundary + governed tool bridge + `vict.agent-
stream@1` (Stage 06 Verified) composed via the Mastra adapter; investigation
agents read evidence stores through governed capability tools; hypotheses are
recorded as proposals requiring human acceptance; no rule override, no signal
invention, no autonomous execution.

**Acceptance.** Every AI output is attributable, recorded, and cannot reach
broker or rule paths; evidence produced by AI is labeled as such.

---

## 1. Stage boundary rules

- A stage may begin only when its dependencies are accepted (not merely
  implemented): e.g. T3 evaluation depends on T2's versioned methods; T4 modes
  depend on T3's canonical core; T7 depends on T6's live data path.
- A stage may refine an earlier boundary only with recorded evidence; the
  dependency logic and mode definitions (Constitution §4) may not be relaxed.
- Stages do not claim later-stage behavior. Live Watch (T6) makes no order
  claims; Assisted Live (T7) makes no AI claims.

## 2. The method-flexibility proof

Governing condition:

> A second method with a substantially different structure can be added
> without modifying the application shell, the VICT renderer, or existing
> general surfaces.

### Fixtures (architecture probes, not strategy endorsements)

- **M1 — multi-timeframe method.** A method with monthly/weekly directional
  analysis plus lower-timeframe setup/entry analysis, several indicators, and
  session timing — the maximal-composition probe.
- **M2 — structurally different method.** A single-timeframe, single-instrument
  method with different observation counts and layer composition (e.g. an
  event/day-boundary method with no indicator layers) — the minimal-composition
  probe.

### Permitted change classes when adding a method

| Change class                                                                              | Status when adding a fixture method                                                                                     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Definition only** (new Method Version + existing capabilities)                          | **Expected common case** — must succeed for M1 and M2                                                                   |
| **Workspace Profile revision** (presentation-only change to an existing method's profile) | Expected to succeed **without** a new Method Version — profiles are independently versioned (Constitution §5)           |
| **New reusable capability**                                                               | Allowed when the method needs a genuinely new calculation; the new capability becomes reusable by any compatible method |
| **New versioned custom surface**                                                          | Allowed only when the method needs a genuinely new _interaction_; recorded with justification                           |
| **Core framework change**                                                                 | Prohibited without an evidence-backed, recorded gap decision; VICT changes are proposed upstream, never self-applied    |

### How it is tested

At T2 (definition-only gate), and re-run whenever the method model evolves:
add M1 and M2 in the consumer app and demonstrate (1) zero diff to the shell
definition, renderer, or existing general surfaces; (2) method identity
changes only where trading semantics changed — a Workspace-Profile-only
change never creates a new Method Version; (3) workspaces from Workspace
Profiles open for both methods without special-case code. The probe's result
is recorded in each affected stage's acceptance evidence.

## 3. Risk register (roadmap-level)

| Risk                                                                            | Mitigation                                                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Island/props data-flow pattern proves awkward under SSR                         | T1 acceptance criteria exercise it first                                                  |
| Live Watch needs push data binding                                              | Deferred decision at T6 with evidence; framework proposal path defined                    |
| Scope creep toward a universal DSL                                              | Constitution §9 prohibits it; T2 rule-composition scope is bounded                        |
| Evidence schema churn across stages                                             | Opportunity/decision/evidence schemas versioned from T4 with migrations                   |
| Upstream VICT dependency blocks T1 (GAP-CANDIDATE-2, navigation-group ordering) | T1 entry gate enforced; explicit recorded fallback decision required to proceed otherwise |
| Premature production claims                                                     | Standing rule: no untested surface is called production-ready                             |
