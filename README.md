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

**T0 — Product and Surface Foundation** (documentation only). Application
implementation has not begun. This stage establishes the authoritative product
architecture, surface architecture, VICT capability-fit evidence, and the
staged roadmap.

## Relationship to VICT

Trading OS is a **separate consumer product repository** — the second external
consumer of the released VICT framework (after Quellight). It consumes the
exact published public release set:

```text
@victframework/*@0.1.0
vict-release-set@1/0.1.0
```

The VICT framework repository (`C:\Users\RZ1\Desktop\RZ\260831-VCT-02`, HEAD
`e70b1a8…`) is a **read-only reference**. Trading OS never modifies VICT.
Framework changes are proposed, never self-applied. Dependency direction is
one-way: VICT never depends on any Trading OS package.

## Product identity

| Aspect | Decision |
| --- | --- |
| Product | Trading OS — a personal, evidence-governed trading operating system |
| Fundamental unit of proof | A **Method Version** (immutable, versioned method definition) |
| Governing object | The **Trading Program** (accounts, capital, risk, methods, sessions, evidence) |
| Human authority | Retained. Autonomous broker execution is out of scope |
| First user | A single professional trader (personal-first, clean domain boundaries) |
| First real method | SS Breakout (an eventual method — never the platform's architecture) |

## Current non-goals

- No application scaffolding, dependencies, or production code (T0 is documentation).
- No broker selection or connection; no real trading; no autonomous execution.
- No live-market data provider selection or market data ingestion.
- No SS Breakout implementation.
- No universal strategy DSL speculating about every possible method.
- No modification of the VICT framework or registry.
- No visual mockups or pixel-level design.

## Authoritative documents

| Document | Content |
| --- | --- |
| [`docs/TRADING-OS-PRODUCT-CONSTITUTION.md`](docs/TRADING-OS-PRODUCT-CONSTITUTION.md) | Purpose, governing principles, operating modes, canonical domain objects, human authority, terminology, non-goals |
| [`docs/architecture/TRADING-OS-SURFACE-ARCHITECTURE.md`](docs/architecture/TRADING-OS-SURFACE-ARCHITECTURE.md) | Platform shell, information architecture, workspace model, capability/surface separation, data and action flow, persistence, extension and versioning model |
| [`docs/audit/VICT-TRADING-CONSUMER-FIT.md`](docs/audit/VICT-TRADING-CONSUMER-FIT.md) | Repository-grounded VICT capability-fit audit with exact evidence, confirmed limitations, and recommendations |
| [`docs/TRADING-OS-ROADMAP.md`](docs/TRADING-OS-ROADMAP.md) | Staged roadmap T0–T8 with stage boundaries, dependencies, and the method-flexibility proof |