# Trading OS — T0 Independent-Review Reconciliation

> **Status:** Reconciliation record for the independent review of the T0
> direction. Every finding was reproduced against the actual public VICT
> `0.1.0` source before any document was corrected; nothing in this record is
> accepted on assertion. Established 2026-09-09 at Stage T0.

## 0. Starting state

| Item                      | Value                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Working repository        | `C:\Users\RZ1\Desktop\RZ\260909-VCT-Trading` (remote `https://github.com/radz2291/VICT-Trading`) |
| Starting SHA              | `8e304ddc819e24262017d986c17b68affe3437a0`                                                       |
| Starting state            | `HEAD == origin/main == 8e304ddc…`, clean working tree (verified after fetch)                    |
| VICT reference repository | `C:\Users\RZ1\Desktop\RZ\260831-VCT-02` — read-only; never modified                              |

## 1. Review scope

- All five active Trading OS documents (README, Product Constitution, Surface
  Architecture, VICT Trading Consumer-Fit Audit, Roadmap) read completely
  before correction.
- VICT `0.1.0` public source read completely where findings depended on it:
  `packages/sdk/src/application.ts` (Application Definition, routes, nav,
  surfaces, component props), `packages/renderer-svelte/src/VitApp.svelte`
  (host chrome ownership, navigation sorting), `packages/renderer-svelte/src/
Surface.svelte` (component rendering, nested surfaces),
  `packages/renderer-svelte/src/logic.ts` (route resolution — independent of
  `nav`), `packages/renderer-svelte/src/index.ts` (public exports),
  `packages/renderer-svelte/src/ChartSurface.svelte` (chart scale model),
  `packages/application/src/renderer.ts` (renderer contract, component
  registry), `packages/application/src/compile.ts` (closed `NAV_FIELDS`),
  `packages/sdk/src/capability.ts` (capability invocation context),
  `packages/runtime/src` (durable orchestration), and the scaffolder host
  templates (`packages/scaffolder/src/index.ts`).

## 2. Public VICT release inspected

| Item                           | Value                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Published release set          | `vict-release-set@1/0.1.0`, namespace `@victframework/*`, all 13 packages at `0.1.0` |
| VICT repository HEAD inspected | `e70b1a876bf7f4bad83a611f5333d86541a0b664`                                           |
| Canonical renderer identity    | `renderer.svelte-kit@5.0.0` (`packages/renderer-svelte/src/index.ts`)                |

## 3. Findings, evidence, and disposition

### F-1 — Persistent shell assumption

**Original claim (superseded).** The context strip, command palette, and
data-health indicator are versioned custom surfaces in the persistent VICT
shell.

**Reproduced evidence.**

- `ApplicationDefinition` (`packages/sdk/src/application.ts`) contains
  routes, screens, views, forms, actions, resources, components, theme —
  and no application-wide shell regions or global surface slots.
- `VitApp.svelte` renders `<header>`, `<nav>`, and `<main>` itself and
  exposes no slot or snippet for injecting into the persistent frame.
- Custom component surfaces exist only inside screen layout regions (or
  nested tabs/dialog/drawer content) and receive only their declared bounded
  primitive props (`Surface` role `component`;
  `props?: Readonly<Record<string, string | number | boolean>>`;
  `Surface.svelte`).

**Disposition.** Claim corrected. The honest T1 architecture is a clean,
fully supported product-shell composition:

- a **product-owned `TradingShell` composition root** in `apps/trading-os`,
  rendered from the author-owned scaffolder page, wrapping the canonical
  public `VitApp` (a public export of `@victframework/renderer-svelte`);
- VICT-generated navigation and screen content render inside that host,
  exactly as the Application Definition declares;
- product-owned global state and services reach the shell chrome and the
  custom trading surfaces through public composition surfaces (Svelte
  context from the shell; registration-time service closure in the
  author-owned component registry);
- no copied or forked renderer internals; no DOM manipulation, CSS hiding,
  duplicated per-screen shell component, or other brittle workaround.

Persistent shell chrome is therefore product-owned composition around the
public renderer — not VICT component surfaces. This is clean and supported;
it is not a blocker. (Surface Architecture §2; audit §5 item 10, §7.)

### F-2 — Navigation-group ordering

**Original claim (superseded).** Navigation group ordering is directly
supported; the central loop Research → Practice → Operate → Review → System
is "kept legible in navigation order".

**Reproduced evidence.**

- `ApplicationRoute.nav.order` is documented and implemented as an order
  hint **within its group** (`packages/sdk/src/application.ts`).
- `VitApp.svelte` (`navGroups` derivation) sorts navigation groups
  **alphabetically by group name**, then routes within a group by `order`,
  then by path. Under VICT `0.1.0` the intended order renders as Operate,
  Practice, Research, Review, System.
- The compiler's closed `NAV_FIELDS = ['label', 'group', 'order']`
  (`packages/application/src/compile.ts`) leaves no way to declare a group
  order.

**Dispositions considered.** (1) A product-rendered navigation inside
`TradingShell` would either duplicate VICT's navigation or require coupling
to renderer-internal CSS structure (the renderer's `.vict-shell` grid
reserves the navigation column unconditionally) — not clean, rejected. (2)
Accepting alphabetical group order — possible, but it silently abandons a
declared first-class product commitment (Constitution §3.11) on the product's
most visible surface. (3) Recorded upstream gap.

**Disposition (chosen). 3 — a recorded upstream VICT defect/gap that blocks
the intended T1 shell.** GAP-CANDIDATE-2 (audit §6): declared
navigation-group ordering is genuinely framework-neutral and missing. T1 is
blocked until a separately released and verified VICT version supplies it; a
fallback (explicit acceptance of alphabetical order) may only be taken as a
recorded product decision that withdraws the central-loop-order claim. No
numeric prefixes, invisible characters, label encoding, post-render DOM
rearrangement, or product-rendered navigation duplicates are permitted. All
"legible in navigation order" claims are removed. (Surface Architecture §3;
Roadmap T1 entry gate; audit §5 item 11, §6, §8 item 8.)

### F-3 — Operating mode ownership

**Original claim (superseded).** The operating mode is part of the global
shell context and persistent shell state.

**Reproduced evidence.** Product-document conflict: Live Watch is defined as
a background activity (Constitution §4; audit §2, §3 row 6) that must keep
running while the trader opens Journal or Evidence and must not be redefined
or stopped by navigation. A single global shell-owned mode contradicts that.

**Disposition.** Model corrected in all three documents: an operating mode
belongs to an **activity** (backtest run, replay session, Live Watch run,
assisted-live session) — never to the shell or the Trading Program as a
whole. The shell displays the mode of the workspace/activity currently in
context plus the status of all independently active background operations;
navigation never starts, redefines, or stops a durable run; there is no
single global mutable mode. (Constitution §4; Surface Architecture §2;
Roadmap T1 scope.)

### F-4 — Method identity versus Workspace Profile

**Original claim (superseded).** The Workspace Profile is a versioned
component of the immutable Method Version; a changed profile is a new Method
Version.

**Reproduced evidence.** Product-document conflict with the required
principle: a Method Version changes when trading semantics change; a
workspace recommendation may evolve without changing the method's trading
identity. The old claim would fragment otherwise identical trading evidence
over a layout change.

**Disposition.** Boundary separated into three terms, used consistently:

- **Method Observation Requirements** — semantic information genuinely
  required by the method, pinned within the Method Version when they affect
  behavior (instruments, data types, timeframes an evaluation must observe);
- **Workspace Profile** — an independently versioned presentation
  recommendation that references a compatible Method Version (or its
  observation requirements); evolves without creating a Method Version;
- **Workspace Instance** — the trader-owned arrangement and runtime
  bindings.

A visual arrangement, panel size, or improved default layout never creates a
new unit of trading proof. The method-flexibility test now asserts that a
Workspace-Profile-only change never creates a new Method Version.
(Constitution §5, §8; Surface Architecture §4, §11; Roadmap T2, §2.)

### F-5 — Package dependency architecture

**Original claim (superseded).** One long dependency chain
(`apps/trading-os → trading-surfaces/trading-data → trading-capabilities →
trading-domain → @victframework/*`) with `trading-domain` permitted to depend
on `@victframework/sdk`.

**Disposition.** Replaced with a real dependency graph and an explicit
composition root (audit §4): `trading-domain` is pure framework-neutral
TypeScript depending on nothing (no Svelte, no SQLite, no VICT runtime,
renderer, or SDK imports — patterns mirrored, never imported); it owns
domain types and ports (including the market-data port); `trading-data`
implements the domain's ports; `trading-capabilities` depends on the domain
plus the VICT capability-authoring/runtime boundary; `trading-surfaces`
depends on presentation-safe domain/service interfaces, never the concrete
market-data store; `apps/trading-os` is the single composition root binding
VICT, storage, capabilities, services, and surfaces; VICT never depends on
Trading OS. An explicit adjacency list states every edge so the graph cannot
be misread as a chain.

### F-6 — Capability execution granularity

**Original claim (superseded).** Recommendation readable as requiring every
indicator, rule, and per-candle calculation to execute as an individually
governed VICT runtime capability.

**Reproduced evidence.** A VICT capability invocation is a governed
durable-orchestration node: pinned activation, run transitions and events,
idempotency keys, effect policy (`CapabilityContext`;
`packages/runtime/src/orchestration-*.ts`). Per-bar capability invocation
would turn one evaluation pass into thousands to millions of durable
framework invocations.

**Disposition.** Two-level model adopted everywhere (audit §6.1;
Constitution §5 Capability; Surface Architecture §8; Roadmap T2/T3):

1. **Pure trading computation layer** — indicators, rule evaluation,
   bar-by-bar method execution: deterministic, fast, in-process,
   independently unit-testable, no VICT persistence or authorization
   overhead per candle. Reusable calculations are product-local, registered
   in revision-identified calculation registries, pinned by Method Versions —
   reuse and identity without per-call framework governance.
2. **Coarse governed VICT capability boundary** — starting a backtest,
   running an evaluation job, ingesting a bounded dataset, persisting an
   evidence result, consequential or externally effectful operations. VICT
   governs the job and its effects, not every mathematical call inside it.

No performance number is claimed; measurement belongs to a later stage with
evidence.

### F-7 — Opportunity, decision, and outcome semantics

**Original claim (superseded).** Every Opportunity is classified as taken,
rejected, modified, or missed — in every mode.

**Reproduced evidence.** Product-document conflict: Backtest has no human
decision; Live Watch intentionally does not know what the trader would have
done; a method-qualified occurrence is not itself a trader decision;
execution and eventual outcome are different facts again.

**Disposition.** Event model refined to the smallest coherent vocabulary
(Constitution §5, §3.1, §8; Roadmap T4):

- **Opportunity** — a method-qualified occurrence; requires no human
  classification; exists in every mode;
- **Decision** — a trader resolution (taken / rejected / modified, including
  doing nothing), only in interactive modes (Replay, Assisted Live);
- **Execution** — the simulated or real fill, distinct from the decision;
- **Outcome** — the market result of an execution, or the counterfactual
  market result for an unexecuted opportunity;
- **Observation** — a recorded method observation not (yet) qualified as an
  opportunity (Live Watch's ambient record);
- **Unacted** — an opportunity with no decision recorded: a recording fact,
  never an invented decision; unacted opportunities with computed
  counterfactual outcomes are the missed-opportunity evidence.

No human-decision classification is required where no human decision exists.
The model still supports comparing method baseline, trader selection, trader
modification, execution discipline, rejected-trade counterfactuals, and
missed opportunities.

### F-8 — Risk authority and overrides

**Original claim (superseded).** The Risk Constitution is an independent
veto authority, yet the trader may override a risk cap through an explicit,
recorded override.

**Disposition.** Governing semantics separated (Constitution §5 Risk
Constitution, §7; Roadmap T7):

- **Hard limits** — the application will not execute through them; no
  per-trade acknowledgment neutralizes them; changing one is a deliberate,
  versioned Risk Constitution change;
- **Soft limits** — warnings the trader may acknowledge per trade, with the
  acknowledgment recorded;
- **Risk Constitution changes** — deliberate and versioned;
- **Off-application activity** — may be recorded as a violation; recording
  never makes it valid retroactively.

A per-trade acknowledgment cannot silently neutralize a hard constitutional
limit. No risk implementation is implied in T0/T1; this is truthful governing
semantics only.

### F-9 — Capability-matrix accuracy

**Reproduced evidence and disposition.** Four matrix rows reassessed against
source (audit §3):

- **#16 Custom indicators and detectors** — reclassified SUPPORTED DIRECTLY
  BY VICT → **PRODUCT-LOCAL CAPABILITY (packaged through VICT)**: the
  computations are product-local; VICT supplies the `defineCapability`
  mechanism, effect/mode declarations, doubles, and pack delivery — not the
  indicators.
- **#14 Method cloning, versioning, and comparison** — reclassified
  SUPPORTED THROUGH VICT COMPOSITION → **PRODUCT-LOCAL CAPABILITY**:
  method-lineage semantics are product domain behavior; VICT offers patterns
  (deterministic hashing, revision pinning) and infrastructure, not method
  semantics.
- **#15 Capability discovery and configuration** — reclassified SUPPORTED
  DIRECTLY BY VICT → **SUPPORTED THROUGH VICT COMPOSITION**: VICT supplies
  pack-manifest infrastructure and atomic installation; the discovery UI is
  a product composition over pack metadata, not a complete built-in product
  screen.
- **#20 Equity, drawdown, and distribution charts** — corrected with the
  verified chart limitation: the generic chart's scale model is
  zero-to-positive (`maxValue = Math.max(1, …)` in `ChartSurface.svelte`);
  negative values render degenerately (bar heights clamp to 1 px slivers;
  line points plot outside the viewBox). Drawdown is suitable **only** when
  deliberately transformed to a positive magnitude or replaced by a custom
  analytical surface.

All correct VICT capability conclusions (tables, forms, safe states, storage,
orchestration, responsiveness, recovery, and the custom-surface verdicts for
the market workbench) are retained unchanged.

### F-10 — Product and document hygiene

- First user described as a **single owner-operator trader** (README; Constitution
  §2), with the explicit note that the product is professional-grade but does
  not assume the user is already a professional trader.
- The product-facing claim that Trading OS is "the second external consumer
  after Quellight" is removed from the README. The Quellight precedent
  remains in the audit only as the technical precedent directly supporting
  the data-port boundary.
- All Markdown files end with an LF newline: the five T0 documents had been
  committed without a trailing newline; corrected in this reconciliation and
  verified.
- All relative links verified.
- "Live Watch" remains the primary term throughout.
- SS Breakout and the example indicators/timeframes remain probes only.
- No visual mockup added.

## 4. Documents updated

1. `README.md`
2. `docs/TRADING-OS-PRODUCT-CONSTITUTION.md`
3. `docs/architecture/TRADING-OS-SURFACE-ARCHITECTURE.md`
4. `docs/audit/VICT-TRADING-CONSUMER-FIT.md`
5. `docs/TRADING-OS-ROADMAP.md`
6. `docs/audit/TRADING-OS-T0-INDEPENDENT-REVIEW-RECONCILIATION.md` (this
   record, new)

## 5. T0/T1 verdict

```text
T0 RECONCILED WITH EXTERNAL VICT DEPENDENCY — T1 BLOCKED
```

F-1 has a clean, explicitly supported implementation path (product-owned
`TradingShell` composition root around the public `VitApp`; no renderer
forking; no UI hacks). F-2 does not: VICT `0.1.0` cannot express navigation
group ordering through its public contracts, and the honest workarounds were
rejected as presentation hacks or renderer-internal couplings. T1 is
therefore blocked on GAP-CANDIDATE-2 until a separately released and
verified VICT version supplies declared navigation-group ordering, or until
the product records an explicit fallback decision (accepting alphabetical
group order and withdrawing the central-loop-order claim).

## 6. Unresolved dependencies

| Dependency                                                          | Status                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAP-CANDIDATE-2 — declared navigation-group ordering** (audit §6) | **Blocking T1.** Missing neutral capability, affected public contract (`ApplicationRoute.nav` in `vict.application@2`; `NAV_FIELDS` in the compiler; group sorting in `VitApp.svelte`, renderer `renderer.svelte-kit@5.0.0`), and minimum required behavior are specified in audit §6. To be proposed upstream; not implemented in either repository. |
| GAP-CANDIDATE-1 — subscription data binding for views (audit §6)    | Unchanged: deferred to T6 with evidence; not blocking T1.                                                                                                                                                                                                                                                                                             |

## 7. No-implementation confirmation

No application implementation began in this reconciliation. No code,
dependencies, lockfiles, credentials, or temporary artifacts were added; no
application scaffolding was run; the VICT repository remains untouched
(read-only reference). Changes are confined to Markdown documentation in the
Trading OS repository.
