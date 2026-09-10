# Trading OS

A personal, evidence-governed **Trading OS** built as a consumer product on the
[VICT framework](https://github.com/radz2291/VICT). The trader defines and
versions many different methods, tests them historically, practises them
through blind replay, observes them against the current market, operates them
during real trading with human authority, and learns from every opportunity
and decision.

It is a professional trading program — not an SS Breakout application, not a
generic dashboard, and not an autonomous trading bot.

## Current stage

**T1 — Platform Shell and Trading-Surface Proof (implemented; independent
verification required)**. The product now has a real, locally runnable VICT
consumer application: a product-owned TradingShell, the canonical Application
Definition (Desk/Markets plus Research → Practice → Operate → Review → System
navigation), a Markets workspace with a registered `trading.market-chart@1`
candlestick-and-volume surface over deterministic fixture data, a plan-derived
command palette (Ctrl+K), and SQLite Workspace Instance persistence. No method
engine, no real market data, no broker, and no live trading exist — see the
[implementation report](docs/report/TRADING-OS-T1-PLATFORM-SHELL-IMPLEMENTATION.md).

T0 remains the authoritative documentation stage; its records below are
unchanged.

## Running the application

Requires Node 22+ (uses the built-in `node:sqlite`) and npm 10.x. From the
repository root:

```bash
npm install --legacy-peer-deps   # npm 10.9.2 edgesOut crash workaround
npm run build                    # builds the trading-os-app SvelteKit host
npm run preview -w trading-os-app -- --port 4173   # serve the production build
```

The full verification ladder: `npm run verify:registry && npm run format:check
&& npm run lint && npm run typecheck && npm run build && npm test && npm run
verify:client-boundary && npm audit --omit=dev && git diff --check`, plus
`npx playwright test` for browser/visual/accessibility evidence (screenshots
land in `docs/evidence/t1/`). Workspace Instance state persists in a SQLite
database whose path is set with `TRADING_OS_DB_PATH` (never committed).

## Relationship to VICT

Trading OS is a **separate consumer product repository**. It consumes the
exact published public release set:

```text
@victframework/*@0.1.1
vict-release-set@1/0.1.1
```

resolved only from `https://registry.npmjs.org` (verified by
`npm run verify:registry`, which also recomputes the release-set content ID
`v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf`).

The VICT framework repository is a **read-only reference**. Trading OS never
modifies VICT and never resolves VICT through a local checkout.
Framework changes are proposed, never self-applied. Dependency direction is
one-way: VICT never depends on any Trading OS package.

## Product identity

| Aspect                    | Decision                                                                       |
| ------------------------- | ------------------------------------------------------------------------------ |
| Product                   | Trading OS — a personal, evidence-governed trading operating system            |
| Fundamental unit of proof | A **Method Version** (immutable, versioned method definition)                  |
| Governing object          | The **Trading Program** (accounts, capital, risk, methods, sessions, evidence) |
| Human authority           | Retained. Autonomous broker execution is out of scope                          |
| First user                | A single owner-operator trader (personal-first, clean domain boundaries)       |
| First real method         | SS Breakout (an eventual method — never the platform's architecture)           |

## Current non-goals

- No method engine, Method Versions, or method authoring (later stages).
- No broker selection or connection; no real trading; no autonomous execution.
- No live-market data provider or market data ingestion (fixture data only,
  explicitly labelled `Fixture data — not live`).
- No SS Breakout implementation; no indicators or strategy logic.
- No backtest, replay, Live Watch, or trading activity (routes exist and show
  honest, intentional safe states).
- No modification of the VICT framework or registry.
- No deployment or hosting.

## Authoritative documents

| Document                                                                                                                         | Content                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/TRADING-OS-PRODUCT-CONSTITUTION.md`](docs/TRADING-OS-PRODUCT-CONSTITUTION.md)                                             | Purpose, governing principles, operating modes, canonical domain objects, human authority, terminology, non-goals                                           |
| [`docs/architecture/TRADING-OS-SURFACE-ARCHITECTURE.md`](docs/architecture/TRADING-OS-SURFACE-ARCHITECTURE.md)                   | Platform shell, information architecture, workspace model, capability/surface separation, data and action flow, persistence, extension and versioning model |
| [`docs/audit/VICT-TRADING-CONSUMER-FIT.md`](docs/audit/VICT-TRADING-CONSUMER-FIT.md)                                             | Repository-grounded VICT capability-fit audit with exact evidence, confirmed limitations, and recommendations                                               |
| [`docs/TRADING-OS-ROADMAP.md`](docs/TRADING-OS-ROADMAP.md)                                                                       | Staged roadmap T0–T8 with stage boundaries, dependencies, and the method-flexibility proof                                                                  |
| [`docs/audit/TRADING-OS-T0-INDEPENDENT-REVIEW-RECONCILIATION.md`](docs/audit/TRADING-OS-T0-INDEPENDENT-REVIEW-RECONCILIATION.md) | Independent T0 review reconciliation: findings F-1–F-10, evidence, dispositions, and the T0/T1 verdict                                                      |
| [`docs/report/TRADING-OS-T1-PLATFORM-SHELL-IMPLEMENTATION.md`](docs/report/TRADING-OS-T1-PLATFORM-SHELL-IMPLEMENTATION.md)       | T1 implementation report: acceptance matrix, release identity, architecture, chart-library decision, persistence/SSR/a11y evidence, limitations, exclusions |
