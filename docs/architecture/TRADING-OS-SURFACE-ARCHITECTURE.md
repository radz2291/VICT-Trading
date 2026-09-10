# Trading OS — Surface Architecture

> **Status:** Authoritative interaction and system architecture for Trading
> OS, established at Stage T0. This document defines the platform shell,
> information architecture, workspace model, and the separation between
> methods, capabilities, and surfaces. It deliberately contains **no visual
> mockups and no pixel-level design**. Product decisions here are kept
> separate from framework facts, which live in
> [`../audit/VICT-TRADING-CONSUMER-FIT.md`](../audit/VICT-TRADING-CONSUMER-FIT.md).

## 1. Layered model

Trading OS separates five concerns. Each has a defined owner, and no layer
reaches past another:

| Layer                 | Owns                                                                                                                                                          | Never owns                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Platform shell**    | Global navigation frame, program/account context, data health, workspace context, background operations, commands, alerts, persistent application state       | Any method's vocabulary, chart internals, workspace contents |
| **Workspace**         | The trader's arrangement of panels, charts, tools, and saved layouts                                                                                          | Method logic, capability behavior, shell state               |
| **Method definition** | Rules, inputs, observations, judgment questions, risk requirements, execution assumptions, compatibility, observation requirements, immutable version lineage | Svelte/renderer implementation, exact UI arrangement         |
| **Capability**        | Reusable domain behavior: indicators, structure, detectors, sessions, replay, fills, sizing, ingestion, performance                                           | Presentation, navigation, persistence policy                 |
| **Surface**           | Presentation and interaction for a region of screen                                                                                                           | Domain rules, method logic, authorization                    |

Dependency direction is one-way downward for logic (shell → workspace →
capability/domain) and sideways-only for presentation: surfaces consume
domain data through typed services and declare themselves to the shell; the
shell never imports a method; a method never imports a surface.

## 2. Platform shell

The shell is the persistent frame around every screen. It owns:

- **Program and account context** — which Trading Program and account are
  active, with simulated/real account marking.
- **Workspace and activity context** — the shell shows the operating mode
  (Backtest / Replay / Live Watch / Assisted Live) of the workspace/activity
  the trader currently has in context. The mode belongs to the activity or
  run, not to the shell (Constitution §4); the shell displays it, it does
  not own it.
- **Background operations** — durable runs (a Live Watch run, a backtest
  job, a replay session) continue independently of navigation. The shell
  shows all active operations and their status, so opening Journal or
  Evidence never stops or redefines a running watch, and every screen can
  truthfully state which operating conditions it is showing.
- **Data health** — freshness, source, and completeness of every market data
  feed in view, surfaced globally and per panel.
- **Commands and actions** — one consistent command/action model (command
  palette + explicit action surfaces) across all screens.
- **Alerts** — program-level and data-level alerts (stale feed, risk limit
  approached, session boundary).
- **Persistent application state** — active program, open workspace context,
  and layout survive restart; active background operations are durable runs
  that survive restart on their own.

Implementation (corrected against verified VICT `0.1.0` facts): the shell is
a **product-owned composition root** — a `TradingShell` component in
`apps/trading-os` that renders the global chrome (context strip, command
palette, data-health indicator, background-operations indicator) around the
canonical public VICT renderer (`VitApp` from
`@victframework/renderer-svelte`), which keeps generating navigation,
screens, regions, and safe states from the neutral Application Definition.
This composition is forced by verified framework facts: the
`ApplicationDefinition` carries routes and screens but **no application-wide
shell regions or global surface slots**; the canonical renderer itself owns
the header, navigation, and main-content structure; custom component
surfaces exist only inside screen layouts (or nested screen surfaces) and
receive only their declared bounded primitive props (audit §2, §5). There is
no VICT mechanism to register a component into the persistent frame, so
persistent shell chrome is product-owned composition, not VICT component
surfaces. Product global state and services reach the chrome and the custom
trading surfaces through product-owned composition surfaces (Svelte context
from the shell, registration-time service closure in the author-owned
registry) — public composition only: no copied or forked renderer internals,
no DOM manipulation, no CSS hiding, no duplicated per-screen shell
components. The shell contains no strategy vocabulary, no instrument
symbols, no timeframe hierarchy, and no indicator names.

## 3. Information architecture

User-facing navigation (VICT navigation groups), hiding framework terminology:

| Group         | Entry          | Responsibility                                                                    |
| ------------- | -------------- | --------------------------------------------------------------------------------- |
| _(top level)_ | **Desk**       | Today: active session, open opportunities, market status, next actions            |
| _(top level)_ | **Markets**    | Instruments and market data health (sources, staleness, coverage)                 |
| **Research**  | **Methods**    | Method library: create, clone, edit, version, compare; Workspace Profiles         |
| **Practice**  | **Backtest**   | Configure and run historical evaluations; run evidence                            |
| **Practice**  | **Replay**     | Blind-replay practice sessions over historical data                               |
| **Operate**   | **Live Watch** | Background method observation of the current market                               |
| **Operate**   | **Trading**    | Assisted-live desk; every order requires explicit trader confirmation             |
| **Review**    | **Journal**    | Opportunities, decisions (taken / rejected / modified), and unacted opportunities |
| **Review**    | **Evidence**   | Per-Method-Version performance, equity/drawdown/distribution, evidence lineage    |
| **System**    | **Risk**       | The Risk Constitution: capital, limits, sessions, overrides                       |
| **System**    | **Settings**   | Data sources, integrations, recovery, program administration                      |

Movement path: **Research → Practice (Backtest, Replay) → Operate (Live
Watch, Trading) → Review (Journal, Evidence)** — the product's central loop.
Honest VICT `0.1.0` fact: `ApplicationRoute.nav.order` orders routes only
_within_ a navigation group, and the canonical renderer sorts navigation
groups alphabetically by group name (audit §2, §5) — so this loop order
cannot currently be expressed in the rendered navigation. Declared
navigation-group ordering is a genuine upstream VICT dependency
(GAP-CANDIDATE-2, audit §6), and T1 remains blocked until a separately
released and verified VICT version supplies it. Until then no document may
claim the loop is "legible in navigation order", and no ordering workaround
is permitted — no numeric prefixes, no label encoding, no post-render DOM
rearrangement, and no product-rendered duplicate of VICT's navigation
coupled to renderer-internal CSS structure.

Naming rules: primary navigation exposes product concepts only ("Methods",
"Journal", "Evidence"), never framework terms ("Application Plan",
"Capability Registry") and never a specific method's terminology (no "SS
Breakout" anywhere in the shell).

## 4. Workspace model

A **Workspace Instance** is the trader-owned arrangement of panels for a
working context: market charts, lower indicator panels, opportunity lists,
tickets, evidence tables, notes. Workspace Instances are:

- **User-owned.** Created, renamed, duplicated, and deleted by the trader.
- **Saved and restored.** Layout identity and panel configuration persist in
  application-domain storage and survive restart.
- **Multi-instance.** The trader keeps several workspaces (e.g. a replay
  practice desk, a Live Watch monitor) and switches between them; the shell
  remembers the open workspace per context.
- **Method-agnostic at runtime.** A workspace never depends on a method.

### Workspace Profile

A **Workspace Profile** is an independently versioned presentation
recommendation that references a compatible Method Version (or its
observation requirements): which information the method needs on screen
(e.g. "a primary chart of instrument X at timeframe Y with indicator Z
below"). The profile is:

- a **recommendation**, not a command: the trader accepts, modifies, or
  rejects it when opening a workspace for a method;
- **independently versioned** — it evolves (better default layouts, panel
  sizes, arrangements) without creating a new Method Version, because it
  changes no trading semantics; it declares which Method Versions or
  observation requirements it is compatible with;
- **declared, not arranged** — the profile names panels, instruments,
  timeframes, and capability-backed indicators; the workspace instance owns
  the actual arrangement, sizes, and screen positions.

The identity boundary (Constitution §5): **method observation requirements**
— the information genuinely required by the method's behavior — are pinned
within the Method Version; the **Workspace Profile** is presentation and may
evolve freely; the **Workspace Instance** is the trader's property. A visual
arrangement, panel size, or improved default layout never creates a new unit
of trading proof. A Workspace Profile is data; rendering it is a normal
workspace-open flow, not a special application page.

## 5. Method / workspace separation

- A Method Version **declares** what it needs to see (compatibility
  requirements + observation requirements; its Workspace Profile
  recommends it). It cannot open screens, arrange panels, or alter shell
  navigation.
- A Workspace **renders** what the trader arranged. It can display any
  method's outputs because panels bind to capability-backed data, not to
  method internals.
- Removing or modifying a method never breaks a workspace; panels that lose
  their data source show explicit empty/stale states, never crashes.

## 6. Capability / surface separation

- **Capabilities** produce data and behavior (e.g. RSI, Bollinger Bands,
  session windows, structure levels). They know nothing about screens.
- **Surfaces** present and interact. A chart panel binds to a data source
  (capability output or raw series) and knows nothing about method rules.
- Creating a method from existing capabilities requires **no application
  code**: definitions compose capabilities; existing surfaces render the
  outputs.
- A genuinely new calculation adds **one reusable capability**; a genuinely
  new interaction adds **one versioned custom surface**. Neither is
  per-method application code, and neither requires shell changes.

## 7. Structured VICT surfaces versus custom code islands

Trading OS adopts VICT's hybrid delivery model:

1. **Structured VICT surfaces** (definition-driven, renderer-owned) are used
   wherever the interaction is conventional: navigation, tables, record
   details, forms, tabs, dialogs, drawers, status, lists, ordinary charts
   (equity curves, distribution buckets), text, safe states.
2. **Versioned custom trading surfaces** (registered through VICT's versioned
   component registry, trusted local code) are used where market interaction
   is professional and specific: the market workbench (candlestick charts,
   overlays, lower panels, shared cursor/time navigation, drawings), the
   replay clock, and the assisted-live ticket composition view.

Division of authority inside a custom island:

- The **plan** (arrangement, visibility, action wiring) stays in the VICT
  Application Definition; the island is resolved by exact id/revision.
- The island receives only **bounded primitive props** through the registry —
  identity, labels, mode flags.
- **Rich data flows below the surface**: the island is registered at runtime
  with typed product-local services (market data, replay clock, workspace
  controller) closed over at registration. Structured data never travels
  through VICT props; the props channel stays bounded and the plan stays the
  source of truth for arrangement and actions.
- Islands re-authorize nothing below the UI; VICT's below-UI authorization
  boundary (action dispatcher, data adapter, capability runtime) remains the
  only authority path.

## 8. Data, state, and action flow

Three state domains are kept distinct (mirroring VICT's model):

1. **Transient view state** — open tabs, cursor position, dialog state.
   Renderer-local; never persisted as domain data.
2. **Durable application-domain state** — methods, versions, opportunities,
   decisions, evidence, workspace layouts, Risk Constitution. Typed resources
   with contracts, migrations, and below-UI authorization.
3. **Governed runtime state** — capability runs, mode orchestrations
   (backtest runs, replay sessions, Live Watch loops). Durable, resumable,
   identity-pinned.

Flow for every effectful interaction:

```text
trader intent → declared action (query | mutation | capability)
  → below-UI authorization → contract validation → effect policy
  → durable commit → structured result → declared safe state
```

Local presentation interactions (cursor moves, tab switches, panel resize)
never cross this boundary. Market data reaches panels through typed
product-local services owned by the data layer; records and evidence always
cross the typed VICT data/capability boundaries.

Method evaluation is uniform across modes: Backtest, Replay, Live Watch, and
Assisted Live invoke the same canonical evaluation core; each mode wraps it
with its own clock, data window, and authority rules, declared per Method
Version. The evaluation has two deliberate levels (Constitution §5;
audit §6.1): bar-by-bar computation — indicators, rules, method execution —
runs as pure, deterministic, in-process product code with no per-candle
framework persistence or authorization overhead; the surrounding job —
starting a backtest, running an evaluation, ingesting a bounded dataset,
persisting an evidence result — is the governed VICT capability boundary.
VICT governs jobs and consequential effects, not every mathematical call
inside a job.

## 9. Persistence

- **Application-domain storage** uses VICT's SQLite application-data adapter
  and its versioned migration API, in namespaces disjoint from VICT
  operational tables. Records: programs, accounts, methods, versions,
  opportunities, decisions, evidence, risk rules, workspace layouts.
- **Market data** (bars, ticks) lives in a product-local market data store
  with its own schema and migrations — separate from application-domain
  records, because time-series volumes and access patterns differ from record
  CRUD (the same boundary reasoning VICT itself recorded for Quellight's
  Shared World store).
- **Restart recovery** is a first-class requirement: saved workspaces, active
  context, and durable run state survive restart; evidence of recovery is part
  of stage acceptance criteria.

## 10. Desktop-first and responsive boundaries

- **Desktop-first.** The primary workbench is a dense, keyboard-oriented,
  multi-panel desktop surface: command palette, explicit keyboard focus,
  consistent shortcuts. Panels support resize/dock arrangements.
- **Responsive boundary.** VICT's responsive navigation and safe states cover
  review and monitoring surfaces (Journal, Evidence, Live Watch status,
  Risk/Settings) on small screens. The market workbench degrades to a
  monitoring/read view below the desktop breakpoint; complex chart
  interaction remains a desktop capability and says so explicitly.

## 11. Extension and versioning model

Extension preference order (per stage):

1. Use an existing VICT surface.
2. Compose existing VICT surfaces.
3. Add a product-local trading capability.
4. Add a versioned custom trading surface through the VICT registry.
5. Propose a VICT core change — only when the missing behavior is genuinely
   framework-neutral, with a recorded proposal; never self-applied.

Versioning rules:

- Custom surfaces are registered by stable id and explicit revision
  (`trading.market-chart@1`); changes to interaction semantics bump the
  revision; a surface's revision participates in release identity, never in
  application identity.
- Method Versions pin capability revisions; capability revisions never change
  silently under a Method Version.
- Workspace Profiles are independently versioned and declare Method Version
  compatibility; a profile change never creates a new Method Version.
- Unsupported surface roles or unresolved components fail with structured
  diagnostics — never silent omission.

## 12. Failure and unsupported-surface behavior

- Every screen declares safe states (loading, empty, stale, partial,
  validation, denied, failure); renderer-generated fallbacks are the floor,
  not the ceiling.
- Data health is explicit: panels show freshness/source state, and stale or
  partial feeds are labeled in place.
- An unsupported or unregistered surface renders a structured failure panel
  with the diagnostic — the trader is never shown silent blankness.
- A surface capability is never claimed production-ready before it has
  survived its stage's acceptance evidence.
