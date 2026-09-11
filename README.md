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

**T2 — Method System and Authoring Workspace: implemented, independently verified, and formally closed.**
The Methods route supports named lineages, persistent working drafts, reusable exact-revision
capabilities, validation, immutable versions, revision, clone, semantic comparison and
Workspace Profile association (an append-only Workspace↔Method-Version reference — not yet a
full presentation recommendation). The existing app provides Method definition/versioning
only; evaluation begins in T3. The [T2 architecture](docs/architecture/TRADING-OS-T2-METHOD-SYSTEM.md),
[T2 implementation report](docs/report/TRADING-OS-T2-METHOD-SYSTEM-IMPLEMENTATION.md),
[T2 independent verification](docs/report/TRADING-OS-T2-INDEPENDENT-VERIFICATION.md) (verdict:
**VERIFIED WITH NON-BLOCKING ISSUES — FORMAL T2 CLOSURE PERMITTED**) and
[T2 closure record](docs/report/TRADING-OS-T2-CLOSURE.md) are the authoritative references for
the delivered method system.

**T3 — Deterministic Market Data and Evaluation: permitted, not started.** No evaluation,
historical data engine, backtest, replay, live data, broker, order submission, signals,
performance evidence or AI has begun.

T1 remains independently verified and formally closed at
`ad860465bf404b7bd1f4359c712f7f6bdf52a6d1`: the product-owned shell, public VICT navigation,
fixture Markets chart, command palette and truthful Workspace Instance persistence remain.
The [T1 closure record](docs/report/TRADING-OS-T1-CLOSURE.md) and
[focused re-verification](docs/report/TRADING-OS-T1-CLOSURE-REVERIFICATION.md) are preserved.

T0 remains the authoritative documentation stage; its records below are
byte-identical to their audited revisions.

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
land in gitignored `test-results/evidence/`; curated evidence is copied once to `docs/evidence/`). Historical audit and verification records are
excluded from formatting (`.prettierignore`) and stay byte-identical to the
revisions the auditors verified. Workspace Instance state persists in a SQLite
database alongside Method and Workspace Profile records. Its path is set with `TRADING_OS_DB_PATH` (never committed).

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

- No Method evaluation engine; T2 authors and preserves definitions only.
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
| [`docs/report/TRADING-OS-T1-INDEPENDENT-VERIFICATION.md`](docs/report/TRADING-OS-T1-INDEPENDENT-VERIFICATION.md)                 | Independent T1 verification: acceptance-matrix verdicts, findings F-1–F-14, adversarial persistence probes, real-browser evidence (byte-preserved)          |
| [`docs/report/TRADING-OS-T1-CLOSURE.md`](docs/report/TRADING-OS-T1-CLOSURE.md)                                                   | T1 closure record: finding-by-finding disposition, remediation scope and evidence, verification ladder, formal closure status                               |
| [`docs/report/TRADING-OS-T1-CLOSURE-REVERIFICATION.md`](docs/report/TRADING-OS-T1-CLOSURE-REVERIFICATION.md)                     | Focused independent re-verification of the T1 closure remediation at `dda040a`: persistence-truth probes, evidence-integrity checks, full ladder, verdict   |
| [`docs/architecture/TRADING-OS-T2-METHOD-SYSTEM.md`](docs/architecture/TRADING-OS-T2-METHOD-SYSTEM.md)                           | T2 method system architecture: vocabulary, lifecycle, canonical identity, capability catalog, persistence, profiles, UI composition, T3 handoff             |
| [`docs/report/TRADING-OS-T2-METHOD-SYSTEM-IMPLEMENTATION.md`](docs/report/TRADING-OS-T2-METHOD-SYSTEM-IMPLEMENTATION.md)         | T2 implementation report: acceptance matrix, model boundaries, persistence/actions, verification record, evidence inventory, limitations and exclusions     |
| [`docs/report/TRADING-OS-T2-INDEPENDENT-VERIFICATION.md`](docs/report/TRADING-OS-T2-INDEPENDENT-VERIFICATION.md)                 | Independent T2 verification: acceptance-matrix verdicts, findings AV-1–AV-8, real-browser/SQLite/registry evidence, full ladder, verdict (byte-preserved)   |
| [`docs/report/TRADING-OS-T2-CLOSURE.md`](docs/report/TRADING-OS-T2-CLOSURE.md)                                                   | T2 closure record: exact lineage, verdict of record, AV-1–AV-8 dispositions, Workspace Profile and rule-composition decisions, carried obligations          |
