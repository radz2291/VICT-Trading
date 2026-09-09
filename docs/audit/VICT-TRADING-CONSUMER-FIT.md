# VICT Trading Consumer-Fit Audit

> **Status:** Authoritative T0 evidence record. This document audits the VICT
> framework's actual, independently verified capabilities against Trading OS's
> requirements. Framework facts here are cited with exact repository evidence;
> product judgments are marked as such. Established 2026-09-09.

## 1. What was inspected

| Item | Value |
| --- | --- |
| VICT repository | `C:\Users\RZ1\Desktop\RZ\260831-VCT-02` (read-only) |
| VICT repository HEAD | `e70b1a876bf7f4bad83a611f5333d86541a0b664` (`docs(stage-07b): define Quellight consumer bootstrap`) |
| Published release set | `vict-release-set@1/0.1.0`, content ID `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d` |
| Release source commit | `7e5908e578c6371ef20a93d03c48f8af422ca487` (`feat(stage-07): Apache-2.0 licensing and the immutable public release set`) |
| Registry | `https://registry.npmjs.org/`, namespace `@victframework/*`, all 13 packages at `0.1.0`, exact internal pins (verified live via `npm view`; e.g. `@victframework/application@0.1.0`, integrity `sha512-xVOR5G5HxL5w7eVSdp3pslmjbFoVPapqtZ7I+L92S8toVxZLIOZQbN7mlzRU5MlOk3ylj1vOaIdMfYOjAWjQ6A==`) |
| Canonical renderer identity | `renderer.svelte-kit@5.0.0` (`packages/renderer-svelte/src/index.ts`) |

### 1.1 Audit method

1. Read the VICT system reference (`docs/VICT-SYSTEM-REFERENCE.md` v0.4.3, §0,
   §17 Application Definition and Delivery Layer, §18 capability ecosystem,
   §19 deployment) and release-compatibility record completely.
2. Read Stage 04 (`docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md`)
   and Stage 05 (`docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`)
   architecture documents completely, including audit dispositions (Stage 04:
   `VERIFIED WITH NON-BLOCKING ISSUES — STAGE 05 PERMITTED`; Stage 05: Verified
   with non-blocking issues, formal closure 2026-09-04, audit commit `2f8233c`).
3. Inspected package manifests and public exports: `packages/sdk/src`
   (authoring ABI), `packages/application/src` (compiler, identity, renderer
   contract, data port, conformance suites), `packages/renderer-svelte/src`
   (host and role components), `packages/appdata-sqlite/src` (adapter and
   migrations), `packages/scaffolder/src`, `packages/runtime/src`
   (capabilities, packs, orchestration), `packages/server/src`, and the
   Stage 05 reference application (`examples/reference-app`).
4. Cross-checked the live npm registry for the published `@victframework/*@0.1.0`
   set (read-only; no dependencies installed into Trading OS).
5. Read the Quellight consumer-boundary precedent
   (`docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md` §2–§6)
   as the first external-consumer pattern.

### 1.2 Classification vocabulary

Every requirement row is classified as exactly one of:

```text
SUPPORTED DIRECTLY BY VICT        — verified framework behavior used as-is
SUPPORTED THROUGH VICT COMPOSITION — verified VICT pieces composed with product definitions
PRODUCT-LOCAL CAPABILITY          — product-owned domain behavior below VICT surfaces
VERSIONED CUSTOM TRADING SURFACE  — product-owned custom surface via VICT's component registry
GENUINE VICT FRAMEWORK GAP        — missing behavior that is genuinely framework-neutral
DEFERRED                          — intentionally postponed; not a present dependency
```

Schema support, renderer support, real interaction behavior, and production
suitability are distinguished in the notes. "Verified" below means
independently verified in VICT's Stage 04/05/06 audit chain at the cited
commit range.

## 2. What VICT actually provides (verified evidence summary)

| VICT capability | Evidence |
| --- | --- |
| Framework-neutral Application Definitions (`vict.application@1`/`@2`) compiled to immutable plans with deterministic `applicationVersion` | `@victframework/application` `compileApplication` / `computeApplicationVersion` (`packages/application/src/compile.ts`, 3,539 lines); schemas `APPLICATION_DEFINITION_SCHEMA_V2 = 'vict.application@2'` (`packages/sdk/src/application.ts`); identity properties tested (Stage 04 §6, Stage 05 §16.3) |
| Routes, navigation groups/order, screens with named ordered layout regions, breadcrumbs, redirects | `ApplicationRoute`, `ScreenDefinition`, `ScreenRegion`, `BreadcrumbItem` (`packages/sdk/src/application.ts`); responsive navigation + mobile-nav policy (Stage 05 §4) |
| 15 built-in surface roles: `text, view, form, action, component, states, list, table, detail, chart, status, tabs, dialog, drawer, conversation` | `SurfaceRole` and `Surface` union (`packages/sdk/src/application.ts`); `BUILT_IN_ROLES` (`packages/renderer-svelte/src/logic.ts`); renderer-owned components `RecordsTable.svelte`, `FormSurface.svelte`, `ChartSurface.svelte`, `OverlaySurface.svelte`, `ConversationSurface.svelte`, `Surface.svelte`, `VitApp.svelte` |
| Safe state vocabulary: `loading, empty, validation, denied, failure` + `stale, partial` (@2) | `ScreenStates` (`packages/sdk/src/application.ts`); live-region announcements (Stage 05 §4); §17.10 proof (APP-006) |
| Generic single-catch-all host (`VitApp`), plan-driven rendering, structured diagnostics (`RENDERER_UNSUPPORTED_ROLE`, `RENDERER_UNKNOWN_COMPONENT`, …) | `packages/renderer-svelte/src/VitApp.svelte`; `validatePlanForRenderer` (`logic.ts`); `RendererDiagnostic` (`packages/application/src/renderer.ts`); `examples/reference-app` has exactly one `+page.svelte` |
| Tables with bounded search, exact-match filters, sortable columns, pagination | `table` role + `RecordsTable.svelte`; closed `search: { text, fields }` capability (Stage 05 §9; ≤200 chars, ≤16 fields, LIKE-escaped) |
| Charts: renderer-owned accessible SVG **bar/line only** | `ChartSurface.svelte` (sum-per-x bucketing; `kind: 'bar' | 'line'`); OPEN-013 decision — no external chart library (Stage 05 §13); explicit limitation "bar/line charts only" (Stage 05 §14) |
| Forms with centralized type-aware value model | `FormSurface.svelte`, `form-values.ts` (HIGH-05-A remediation; untouched numeric prefills stay numbers; invalid numeric input never dispatches) |
| Tabs (roving tabindex), dialogs/drawers (focus trap, Escape, focus restore), status tones, conversation | `OverlaySurface.svelte`, `Surface.svelte`; Stage 05 §4 |
| Versioned custom-component registry (exact id/revision, structural keys, bounded primitive props, frozen copies, identity snapshot) | `createComponentRegistry` (`packages/application/src/renderer.ts`); props domain enforced at compile (Stage 05 §2.4, §5) |
| Renderer contract + shared conformance suites (`runRendererConformanceSuite`, `runApplicationDataAdapterSuite`) incl. hostile-action canaries | `packages/application/src/renderer.ts`, `src/renderer-conformance.ts`, `src/data-conformance.ts`; both adapters tested (Stage 05 §15) |
| Storage-neutral `ApplicationDataAdapter` port + production SQLite adapter (parameterized `json_extract`, strict unknown-field policy, `BEGIN IMMEDIATE`, transactional idempotency, WAL/`synchronous=FULL` pragmas) | `createSqliteApplicationData` (`packages/appdata-sqlite/src/adapter.ts`); `ApplicationDataAdapter`, `createInMemoryApplicationData` (`packages/application/src/data.ts`) |
| Versioned, transactional application-domain migrations, `appdata_*` namespaces disjoint from operational tables, restart/SIGKILL recovery evidence | `packages/appdata-sqlite/src/migrations.ts`; Stage 05 §10; SIGKILL/restart suites (Stage 05 §16.3) |
| Resource definitions: identity, field catalogue, queries (list/detail: filters, sort, pagination, projection), declared mutations, presentation hints | `ResourceDefinition` (`packages/sdk/src/application.ts`); primitive-equality filters only; closed query schema rejecting unknown fields (Stage 04 §8) |
| Actions with kinds `local / navigation / query / mutation / capability`; below-UI authorization; `UNSUPPORTED_ACTION` honesty | `ActionDefinition` (`packages/sdk/src/application.ts`); dispatch table (Stage 05 §7); visible-but-denied admin proof (APP-012) |
| Capabilities: `defineCapability`, effect classes `pure/read/write/irreversible`, modes `normal/simulate/test`, declared test doubles eligible only in declared modes, least-authority permissions/config/secrets, atomic registration & pack installation, co-installation conflict rules | `packages/sdk/src/capability.ts`; `packages/runtime/src/registry.ts`, `pack-install.ts`; Stage 04 §2–§3 (all Verified) |
| Capability packs (`vict.capability-pack@1`), manifest/bindings cross-validation, conformance suite | Stage 04 §3; `packs/notes-pack`, `packs/ledger-pack`; `runCapabilityPackConformanceSuite` (`packages/runtime/src/testing.ts`) |
| Durable orchestration: graph compilation, waits, retries with idempotency keys, fork/join, signals, restart recovery | `packages/kernel`, `packages/runtime/src/orchestration-*.ts`; Stage 03 verified and closed (reference §0.10) |
| One-time deterministic SvelteKit host scaffolder (byte-identical, non-destructive, path-safe, idempotent) | `scaffoldVictApp`, `GENERATED_FILES` (`packages/scaffolder/src/index.ts`); packed verification (Stage 05 §6) |
| Theme tokens (closed `THEME_TOKEN_NAMES` vocabulary), responsive shell, AA contrast, reduced motion | `packages/sdk/src/application.ts`; `packages/renderer-svelte/src/theme.css`; Stage 05 §4 |
| Control plane, governed agent execution, resumable SSE (`vict.agent-stream@1`), CLI | `packages/control`, `packages/server`, `packages/cli`; Stage 06 verified and formally closed (reference §0.10) |
| Optional product-agent (Mastra) adapter | `packages/mastra`; pinned `@mastra/*` versions; nothing Mastra-related used before Trading OS T8 |

## 3. Capability matrix

| # | Trading OS requirement | Classification | Evidence and notes |
| --- | --- | --- | --- |
| 1 | Professional candlestick/market charts | **VERSIONED CUSTOM TRADING SURFACE** | VICT's chart role is a renderer-owned SVG bar/line aggregate only (`ChartSurface.svelte`; Stage 05 §13–14). No candlestick/OHLC support anywhere in the neutral model or renderer — confirmed by reading the full surface vocabulary. This is not a framework gap: VICT explicitly scopes the first envelope to "serious local-first workflow" surfaces and routes pixel-specific experiences through custom application code (reference §17; Stage 05 §13). A `trading.market-chart` island is the sanctioned path. Production-ready only after T1 evidence. |
| 2 | Chart overlays and lower indicator panels | **VERSIONED CUSTOM TRADING SURFACE** | Same basis as #1. Panels/overlays are internal composition of the market-chart island; the island stays a single registry entry so the plan sees one surface. |
| 3 | One or many synchronised timeframes | **VERSIONED CUSTOM TRADING SURFACE** | The neutral model has no multi-panel chart synchronization concept (`Surface` union, `packages/sdk/src/application.ts`). Synchronisation lives inside the workbench island. The neutral model imposes no timeframe count — Trading OS must not either. |
| 4 | Shared cursor/time navigation | **VERSIONED CUSTOM TRADING SURFACE** | No crosshair/shared-axis concept exists in VICT (verified across renderer sources). Product-local; never a shell concern. |
| 5 | High-volume time-series rendering | **VERSIONED CUSTOM TRADING SURFACE** | The SVG chart renders aggregated series per request; no canvas path, no virtualization, no decimation. A canvas-based island with product-local data services is required. Honest assessment: VICT generic charts are suitable for equity curves and ordinary analytics, **not** for the main market workbench. |
| 6 | Live data updates | **PRODUCT-LOCAL CAPABILITY** (with a framework-neutral gap candidate — see §6) | VICT's data flow is request/response (SSR + declared `query` actions through the data port, `packages/application/src/data.ts`); the only streaming surface is `vict.agent-stream@1` SSE for agent events (`packages/runtime/src/stream-hub.ts`), not view-data push. For T1–T5 this is irrelevant (fixtures/historical). For Live Watch (T6), product-local update loops inside islands plus query-action refresh can work; whether a framework-neutral subscription-data binding is justified is deferred to T6 evidence. |
| 7 | Replay clock and future-data fencing | **PRODUCT-LOCAL CAPABILITY** | Domain behavior (clock, data visibility window) belongs to the trading domain/capabilities; it is delivered through governed capability runs. VICT's durable runs, waits, and abort signals (`CapabilityContext.abortSignal`, deadlineAt — `packages/sdk/src/capability.ts`) support orchestration, but "future data must be invisible" is trading-domain semantics. |
| 8 | Resizable / dockable workspaces | **VERSIONED CUSTOM TRADING SURFACE** (+ product-local workspace controller) | VICT provides named layout regions within screens (`ScreenRegion`) — a static, definition-owned arrangement, not a user-resizable dock. A panel-host island with product-local layout state is required. Not a framework gap: user-arranged MDI is product-specific interaction. |
| 9 | Saved workspace layouts | **SUPPORTED THROUGH VICT COMPOSITION** | Persist as typed resources over `@victframework/appdata-sqlite` (versioned migrations, `appdata_*` namespace, restart recovery — Stage 05 §10, §16.3). Layout *content* is product data; VICT provides the storage, contracts, and query surface. |
| 10 | Drawings and annotations | **DEFERRED** (→ VERSIONED CUSTOM TRADING SURFACE in a later stage) | No drawing concept in VICT; belongs inside the market-chart island. Deferred past T1; recorded so it is not silently dropped. |
| 11 | Method authoring | **PRODUCT-LOCAL CAPABILITY** | No method vocabulary exists in VICT (nor should it). Trading OS defines the Method/Method Version model in `packages/trading-domain` (framework-neutral TS, VICT authoring-ABI patterns reused); authoring UI composes VICT forms/dialogs/tabs over method resources (T2). |
| 12 | Structured rule composition | **PRODUCT-LOCAL CAPABILITY** | Structured, machine-evaluable rules over capability outputs are domain logic. VICT contributes the pattern (declarations + contracts + deterministic identity) but no rule language. No universal DSL is attempted (Constitution §9). |
| 13 | Advanced-expression escape hatch | **PRODUCT-LOCAL CAPABILITY** | The escape hatch is capability code itself: `defineCapability` with pinned revisions inside trusted packs — VICT's existing, verified path for arbitrary behavior (Stage 04 §2–§3). No expression evaluator is required for T0–T2. |
| 14 | Method cloning, versioning, and comparison | **SUPPORTED THROUGH VICT COMPOSITION** | VICT contributes the verified identity machinery pattern (deterministic canonical hashing, revision pinning, insertion-order independence — `packages/application/src/compile.ts`) and the below-UI authority model; the method lineage schema itself is product-local. Comparison surfaces compose VICT tables/tabs. |
| 15 | Capability discovery and configuration | **SUPPORTED DIRECTLY BY VICT** | Pack manifests declare capabilities, contracts, permissions, configuration/secret names, doubles, compatibility (`vict.capability-pack@1`, Stage 04 §3); `installCapabilityPack` cross-validates and installs atomically (`packages/runtime/src/pack-install.ts`); scoped config readers at invocation (Stage 04 §3.1). Discovery UI is a composition (T2). |
| 16 | Custom indicators and detectors | **SUPPORTED DIRECTLY BY VICT** | Capabilities are exactly this: `defineCapability` with effect classes and modes including `simulate`/`test` doubles for Backtest/Replay determinism (Stage 04 §2–§3, Verified). |
| 17 | Opportunity and decision surfaces | **SUPPORTED THROUGH VICT COMPOSITION** | Opportunity/decision records as typed resources; tables (`table` role + `RecordsTable.svelte`), details, forms, dialogs compose the surfaces; mode-specific ticket composition later via islands if evidence requires. |
| 18 | Simulated order and risk tickets | **SUPPORTED THROUGH VICT COMPOSITION** | Forms (contract-validated input, `FormSurface.svelte` + `form-values.ts`), dialog/drawer roles, `mutation`/`capability` actions crossing below-UI authorization (Stage 05 §7). Risk-constitution veto is product capability logic behind the same boundary. |
| 19 | Trade, opportunity, and evidence tables | **SUPPORTED DIRECTLY BY VICT** | `table` role: search (bounded substring), exact-match filters, `aria-sort` columns, pagination (`RecordsTable.svelte`; Stage 05 §2.2, §4). Production-proven in the reference proof and conformance suites. Equality-only filters are a known, acceptable limit for T1–T5 (see §5). |
| 20 | Equity, drawdown, and distribution charts | **SUPPORTED THROUGH VICT COMPOSITION** | Equity curves fit the `line` chart kind and drawdown/distribution fit `bar` (bucketed rows via capability aggregation) — `ChartSurface.svelte` handles summed series per x value. Limitations: no multi-series overlay, no interactive crosshair, y aggregates by sum per x bucket. Sufficient for review surfaces; upgrade to a custom performance island later only if evidence requires. |
| 21 | Loading, empty, stale, partial, offline, error states | **SUPPORTED DIRECTLY BY VICT** | `ScreenStates` covers loading/empty/validation/denied/failure/stale/partial (`packages/sdk/src/application.ts`); renderer-generated fallbacks (Stage 05 §4). Offline detection is product-local (feed health), rendered through the same declared states. |
| 22 | Keyboard-oriented desktop operation | **SUPPORTED THROUGH VICT COMPOSITION** | Verified keyboard behavior: tabs roving-tabindex, dialog focus trap/Escape/restore, visible focus ring tokens, reduced motion (Stage 05 §4; `theme.css`). Not provided: a global command palette / app-wide shortcut model — product-local shell surface (T1), consistent with the command/action model in §2 of the Surface Architecture. |
| 23 | Responsive review and monitoring surfaces | **SUPPORTED DIRECTLY BY VICT** | Responsive navigation and breakpoint shell with explicit mobile-nav policy (close-on-navigate, Escape) — Stage 05 §4; browser-tested with axe scans clean. |
| 24 | Restart recovery and application-data persistence | **SUPPORTED DIRECTLY BY VICT** | Versioned transactional migrations (`packages/appdata-sqlite/src/migrations.ts`), `appdata_*` namespaces disjoint from operational tables, `APPDATA_FUTURE_SCHEMA` fail-closed, real SIGKILL/restart suites (Stage 05 §10, §16.3). Operational durability (durable runs across close/reopen) is Stage 02/03 Verified. |

Additional assessed items beyond the required list:

| Requirement | Classification | Notes |
| --- | --- | --- |
| Data ingestion (market data) | **PRODUCT-LOCAL CAPABILITY** | VICT has no market-data concept (correctly). Ingestion adapters, bar storage, and normalisation live in `packages/trading-data` with its own SQLite schema — mirroring VICT's own reasoning for Quellight's Shared World store: "the generic data port is flat single-resource CRUD … and is not stretched into lineage, atomic multi-record semantics" (reference §0.11; `ApplicationDataAdapter` primitive-equality filters, closed query schema — Stage 04 §8). |
| Simulated fills | **PRODUCT-LOCAL CAPABILITY** | Domain behavior delivered as a VICT capability (mode-gated doubles make this natural: `simulate`/`test` modes and declared doubles, Stage 04 §3). |
| Position sizing | **PRODUCT-LOCAL CAPABILITY** | Domain behavior; risk-constitution interaction is product logic. |
| Performance calculations | **PRODUCT-LOCAL CAPABILITY** | Domain behavior; results presented via VICT tables/charts (#20). |
| Governed execution of backtest/replay/live-watch runs | **SUPPORTED DIRECTLY BY VICT** | Durable orchestration: graphs, waits, retries with idempotency keys, fork/join, restart recovery — Stage 03 verified and closed; `packages/runtime/src/orchestration-*.ts`. |
| AI (investigation, hypotheses) | **DEFERRED** | VICT's neutral `ProductAgent` boundary + governed tool bridge + `vict.agent-stream@1` SSE + Mastra adapter (Stage 06 Verified) are the eventual substrate. Trading OS defers all AI to T8 per the Constitution. |

## 4. Package boundaries and dependency direction

Evaluated boundaries (accepted as the working plan, revisitable at T1 with
evidence):

```text
apps/trading-os               SvelteKit consumer host (scaffolded; owns definitions, bindings, islands)
packages/trading-domain       Methods, Method Versions, opportunities, decisions, evidence, Risk Constitution
                              (framework-neutral; may depend on @victframework/sdk authoring ABI)
packages/trading-capabilities Trading capabilities as VICT capability packs (indicators, sessions,
                              detectors, replay clock, fills, sizing, performance)
packages/trading-surfaces     Versioned custom Svelte trading surfaces (market workbench, replay
                              clock, ticket view) registered via the VICT component registry
packages/trading-data         Market data store, ingestion adapters, bar schemas (product-local;
                              separate SQLite schema and migrations)
```

Rules:

- Dependency direction: `apps/trading-os → trading-surfaces/trading-data →
  trading-capabilities → trading-domain → @victframework/*`. No cycles.
- **VICT never depends on any Trading OS package.** Trading OS never modifies
  VICT; framework gaps are proposed upstream with evidence, never self-applied.
- `packages/trading-domain` stays free of Svelte/renderer types (mirrors VICT's
  own `vict.application` neutrality rule).
- The market data store is separate from the application-data store; the flat
  VICT data port is not stretched into time-series storage (see §5).

## 5. Confirmed VICT limitations (as they affect Trading OS)

Verified limitations from VICT's own records, with product impact:

1. **Charts are bar/line aggregates only** (Stage 05 §13–14; `ChartSurface.svelte`).
   Impact: the entire professional market workbench is a custom-surface
   responsibility. Assessed honestly: generic VICT charts are suitable for
   review analytics, not for the main workbench.
2. **No derived/aggregate views** — computed summaries must be produced by a
   declared capability into real application-domain rows (Stage 05 §14).
   Impact: performance metrics and evidence summaries are capability-produced
   records, not on-the-fly view aggregations.
3. **The data port is flat single-resource CRUD** with primitive-equality
   filters, bounded search (≤200 chars, ≤16 fields), no query language, and
   no time-series storage (Stage 04 §8; Stage 05 §9; reference §0.11 for the
   Quellight precedent). Impact: records (opportunities, decisions, evidence,
   layouts) fit well; market bars do not — hence `packages/trading-data`.
4. **No subscription/push data binding for views.** Data flows are
   request/response; the only stream is the agent event stream
   (`packages/runtime/src/stream-hub.ts`). Impact: Live Watch needs a
   product-local update mechanism (polling/query loops inside islands) unless
   T6 evidence justifies a framework proposal.
5. **Custom components receive only bounded primitive props** (compile-enforced;
   Stage 05 §2.4, §5). Impact: rich data must reach islands through typed
   product services closed over at registration — an accepted, documented
   pattern for trusted code islands (Surface Architecture §7).
6. **No user-resizable dock layout manager.** VICT layouts are
   definition-owned named regions. Impact: workspace arrangement is
   product-local (by design, per Surface Architecture §4 — this is a feature
   of the separation, not a defect).
7. **No multi-document/MDI model; one screen at a time** with regions. Impact:
   the "one coherent program" feel comes from the persistent shell + saved
   multi-instance workspaces, not from true multi-window tiling. Accepted for
   T0–T7; revisit only with real-use evidence.
8. **Scaffolder is one-time** — hosts are never regenerated or upgraded
   automatically (Stage 05 §14). Impact: host upgrades are manual; recorded as
   maintenance reality.
9. **React and other renderers deferred; bar/line only; equality-only filters;
   manual screen-reader certification** (Stage 05 §14). Impact: none blocking
   for T0–T5; noted for honesty.

## 6. Genuine framework gaps

One candidate, recorded honestly and **not** acted on in T0:

- **GAP-CANDIDATE-1: subscription data binding for application views.** VICT
  verifies streaming for agent events (`vict.agent-stream@1`) but has no
  neutral way for a *view* to receive pushed updates. Whether this is a
  genuine framework-neutral need (any consumer with live data would want it)
  or a product-local concern cannot be decided without Live Watch use evidence.
  **Decision:** defer to T6. If T6 shows the polling composition is
  inadequate, propose the capability upstream with evidence — per the
  extension policy (option 5), never self-applied.

No other genuine gaps were found for T0–T5 scope: every trading-specific
missing capability is correctly a product capability or a versioned custom
trading surface, not a framework concern.

## 7. Product-local extensions required

| Extension | Where | Stage |
| --- | --- | --- |
| Method/Method Version model, lineage, comparison | `packages/trading-domain` | T2 |
| Structured rule composition + judgment questions | `packages/trading-domain` | T2 |
| Capability packs: indicators, sessions, detectors, replay clock, fills, sizing, performance | `packages/trading-capabilities` | T2–T3 |
| Market data store, ingestion adapters, bar schema | `packages/trading-data` | T3 |
| Evaluation core shared by all four modes | `packages/trading-capabilities` | T3 |
| Market workbench (candlestick charts, overlays, panels, shared cursor, drawings later) | `packages/trading-surfaces` | T1 (first revision), T3+ |
| Workspace controller (panel host, resize/dock, saved layouts) | `packages/trading-surfaces` + `apps/trading-os` | T1 |
| Replay clock surface + future-data fencing | `packages/trading-surfaces` + capabilities | T4 |
| Opportunity ticket and decision flow | composition first; island only if needed | T4–T5 |
| Command palette, context strip, data-health indicator (shell islands) | `apps/trading-os` islands | T1 |

## 8. Risks and open questions

1. **Props-bounded islands and data flow.** The closed-over-services pattern
   for islands is sound but must be exercised early (T1) to confirm the
   registration-time closure composes cleanly with Svelte 5 SSR and the
   scaffolder host. *Risk: medium; mitigated by T1 acceptance criteria.*
2. **Live Watch update path.** Polling may be adequate; if not, GAP-CANDIDATE-1
   becomes a real framework proposal. *Decision deferred to T6 with evidence.*
3. **Canvas rendering vs. renderer conformance.** A canvas-based island must
   still satisfy accessibility and safe-failure expectations; T1 must define
   the island's own safe states. *Open design detail.*
4. **Workspace layout schema.** What exactly persists (panel identity, sizes,
   positions, bindings) needs a small, versioned design at T1. *Open, blocks
   nothing — T1 defines it.*
5. **Method identity hashing.** Reuse of VICT's deterministic canonical-hash
   pattern for Method Version identity is proposed; the exact schema marker
   (`trading.method-version@1`) is defined at T2. *Open, non-blocking.*
6. **Node/browser boundary.** `@victframework/application` is browser-safe;
   the SQLite adapter and runtime are Node-side (Stage 05 §5.1 boundary).
   The Trading OS host is a SvelteKit server app — consistent, but islands
   must not import Node-only modules into client bundles. *Standing rule.*
7. **Pre-1.0 VICT.** `0.x` semver permits breaking minor bumps; exact pins
   (`@0.1.0`, release-set identity) protect Trading OS. Upgrades are explicit,
   versioned events with re-verification. *Accepted posture.*

## 9. Recommendations

1. **Adopt the five-package boundary** (§4) and the one-way dependency rule.
2. **Treat the market workbench as one versioned custom surface family**
   (`trading.market-chart@1`, `trading.workspace-host@1`, …) registered in the
   VICT registry — never as hardcoded application pages per method.
3. **Keep records and evidence in the VICT application-data store; keep market
   bars in a product-local store.** Do not stretch the flat data port.
4. **Use VICT capability packs for all reusable trading behavior**, with
   mode-gated doubles for simulation, so Backtest/Replay/Live Watch/Assisted
   Live compose the same pinned capabilities.
5. **Defer AI entirely to T8**, using VICT's ProductAgent boundary when it
   arrives; never before.
6. **Do not claim production readiness for any custom surface before its stage
   acceptance evidence exists** — including the T1 market surface.
7. **Record GAP-CANDIDATE-1 as a monitored question**, decided at T6.