# Trading OS — Product Constitution

> **Status:** Authoritative product definition for Trading OS. Established at
> Stage T0. Product decisions in this document are Trading OS decisions and
> are deliberately kept separate from framework facts, which live in
> [`docs/audit/VICT-TRADING-CONSUMER-FIT.md`](audit/VICT-TRADING-CONSUMER-FIT.md).
> Terminology here governs all Trading OS documents and stages.

## 1. Purpose

Trading OS exists to make **trading success and credible evidence** the
product's purpose. A trader who uses Trading OS should be able to answer, with
recorded evidence rather than memory:

- What exactly is my method, in the version I traded?
- What does history say about it — and what does my practice say?
- What did I see, decide, and do — including what I did *not* do?
- Is my evidence for this method improving or decaying?

The product is a **personal, evidence-governed Trading OS** where the trader
defines and versions many different methods, tests them historically, practices
them through blind replay, observes them against the current market, operates
them during real trading with human authority, and learns from every
opportunity and decision.

## 2. User and product boundary

**User.** A single professional trader (personal-first). The trader is the
authority over every account, method, and decision. Multi-user operation is
not a goal; however, domain boundaries are kept clean so that a small team or
a supervised fund could adopt the same objects later without re-architecture.

**What the product is.** A professional trading program/platform: research,
practice, observation, assisted execution, and review organized around versioned
methods and recorded evidence.

**What the product is not.**

- Not an SS Breakout application. SS Breakout is one future method.
- Not a generic dashboard. Every surface serves the trading workflow.
- Not an autonomous trading bot. No broker order is ever sent without an
  explicit human action, and no autonomous broker execution exists at all.
- Not a signal-selling or social product. It has no other users' trades to show.

## 3. Governing principles

These principles govern every stage. Conflicts resolve in the order listed.

1. **Evidence is the purpose.** Every qualified opportunity must be recordable
   — taken, rejected, modified, or missed. A trading session without records
   has no evidentiary value, however profitable it was.
2. **Human authority is retained.** The trader approves every real-world
   action. The system proposes, organizes, computes, and records; it never
   executes broker orders autonomously.
3. **The Trading Program governs.** Accounts, capital, risk, methods, sessions,
   and evidence standards live under one governing Trading Program object —
   not scattered across screens.
4. **A Method Version is the fundamental unit of proof** — not the root of the
   application. Methods are easy to create, clone, modify, compare, and
   version; none of them is privileged by the platform.
5. **The trader, method, workspace, and application shell are separate
   concepts.** A method recommends a workspace; it does not own one. The shell
   never hardcodes a method's vocabulary.
6. **Machine-evaluable rules and trader judgment remain distinguishable.** A
   method version separates its structured, machine-evaluable rules from its
   judgment questions answered by the trader. The product never blurs them.
7. **Risk authority is independent of method detection.** The Risk
   Constitution can block or cap a trade regardless of what any method
   detected. Methods propose; the risk layer disposes.
8. **One canonical behavior.** Backtest, Replay, Live Watch, and Assisted Live
   use the same canonical method behavior wherever their operating conditions
   overlap. Mode-specific differences are declared, not implicit.
9. **No silent behavior change.** Method behavior never changes without a new
   Method Version. Capability revisions are pinned by Method Versions.
10. **AI is deferred and governed.** AI may later investigate evidence and
    propose hypotheses. It must not invent signals or override rules, and it
    never does so in T0–T7.
11. **UI and UX are first-class.** A dense, legible, keyboard-oriented desktop
    experience is a first-class requirement, not an afterthought to the backend.

## 4. Operating modes

Four operating modes cover the method lifecycle. They are product concepts,
not framework concepts. The primary term for mode 3 is **Live Watch** (never
"live shadow").

| Mode | Definition | Data | Orders | Records |
| --- | --- | --- | --- | --- |
| **Backtest** | Accelerated evaluation of a Method Version over historical data | Historical | Simulated fills only | Run summary, per-opportunity records, performance evidence |
| **Replay** | Interactive historical practice with future information hidden (blind replay) | Historical, clock-gated | Simulated fills only | Session records, per-decision records, performance evidence |
| **Live Watch** | The method monitors the current market in the background, records observations and potential opportunities, but sends no broker orders | Current market | None — ever | Observation records, potential-opportunity records |
| **Assisted Live** | Real-market operation in which the trader retains final authority over every order | Current market | Broker order only on explicit human confirmation | Full opportunity/decision/evidence records |

Operating conditions differ (e.g. a replay cannot know future data; Live Watch
cannot know what the trader would have done). Where conditions overlap, behavior
must be identical; where they do not, the difference must be declared in the
Method Version and visible in the evidence.

## 5. Canonical domain objects

These are the canonical Trading OS domain objects. Every document and stage
uses these exact terms.

### Trading Program
The governing object of a personal trading operation. Owns: accounts, capital
allocation, the Risk Constitution, the method library, session definitions, and
the evidence standards that qualify records. One trader may run one or more
programs; one is active at a time in the shell.

### Account
A trading account (real or simulated) with its broker, currency, balances, and
permissions. Accounts belong to the Trading Program. T0–T6 operate on
simulated accounts only.

### Method and Method Version
A **Method** is a named lineage. A **Method Version** is an immutable member of
that lineage and the fundamental unit of proof. A Method Version contains:

- **Inputs** — required instruments, data types, and compatibility
  requirements (e.g. which capabilities and data it needs; never a hardcoded
  timeframe hierarchy);
- **Analysis layers** — user-defined observations and calculations the method
  performs (zero, one, or many; ordered or graphed as the method needs);
- **Rules** — machine-evaluable, structured rule composition over capability
  outputs;
- **Judgment questions** — explicit questions the trader answers during
  evaluation and operation (kept distinguishable from rules);
- **Risk requirements** — what the method requests from the Risk
  Constitution (never authority over it);
- **Execution assumptions** — how fills are modeled and what must hold for
  the method to operate;
- **Workspace Profile** — a versioned recommendation of the information the
  method needs on screen (see Surface Architecture);
- **Lineage** — parent version, provenance, and identity. Method behavior
  never changes silently: any semantic change is a new Method Version.

Method Versions must be easy to create, clone, modify, and compare. Cloning
preserves lineage; comparison shows structural and identity differences.

### Capability
Reusable domain behavior invoked by Method Versions: indicators, market-
structure calculations, setup detectors, session calculations, replay,
simulated fills, position sizing, data ingestion, performance calculations.
Capabilities are versioned; a Method Version pins the exact capability
revisions it depends on. Creating a method from existing capabilities requires
no application code; a genuinely new calculation becomes one new reusable
capability available to any compatible method.

### Opportunity and Decision
An **Opportunity** is a recorded, qualified trading opportunity produced by a
Method Version in some mode, classified as taken, rejected, modified, or
missed, and carrying its market context. A **Decision** is the trader's
resolution of an opportunity (including doing nothing), recorded with its
reasoning and outcome. Every qualified opportunity must be recordable in every
mode.

### Evidence
The recorded, comparable results that make a Method Version's claims checkable:
backtest runs, replay sessions, Live Watch observations, and performance
calculations. Evidence always names the exact Method Version, capability
revisions, data range, and operating conditions that produced it.

### Risk Constitution
The independent risk authority of the Trading Program: capital limits, per-
trade and portfolio risk, allowed sessions, prohibited conditions. It
evaluates and can veto any proposed action. It is never derived from method
detection and never trusts a method's self-assessment.

### Session
A defined operating window (time-bounded or condition-bounded) declared by the
Trading Program or by methods. Sessions are data, not platform structure.

### Workspace
The trader-owned arrangement of charts, panels, tools, and saved layouts used
in a mode. Workspaces are user-owned and method-independent. See Surface
Architecture.

## 6. Evidence orientation

Every mode produces evidence into one reviewable spine:

- Research produces **Method Versions** and their assumptions.
- Backtest produces **run evidence**.
- Replay produces **practice evidence**.
- Live Watch produces **observation evidence** and potential opportunities.
- Assisted Live produces **decision evidence**.
- The Journal and Evidence surfaces review all of it per Method Version.

Evidence records are first-class domain objects with immutable identity —
never side effects of a session. Gaps in evidence (a missed opportunity, an
unrecorded session) are themselves recorded where possible.

## 7. Human authority

- Every real-world order requires explicit human confirmation in Assisted Live.
- Simulated orders in Backtest/Replay require no confirmation but are always
  labeled as simulated.
- The Risk Constitution operates below the human, as a veto/cap authority —
  not above it. The trader may override a risk cap only through an explicit,
  recorded override.
- No component of the system — method, capability, or future AI — may place a
  broker order. The assisted-live path composes an order; the trader commits it.

## 8. Terminology

| Term | Meaning |
| --- | --- |
| Backtest | Accelerated evaluation over historical data |
| Replay | Interactive historical practice with future information hidden |
| Live Watch | Background monitoring of the current market with no broker orders |
| Assisted Live | Real-market operation with trader final authority |
| Method / Method Version | Lineage / immutable unit of proof |
| Capability | Reusable domain behavior |
| Opportunity / Decision | Qualified opportunity record / trader resolution |
| Evidence | Recorded, attributable results |
| Risk Constitution | Independent risk authority |
| Trading Program | Governing object for accounts, capital, risk, methods, sessions, evidence |
| Workspace / Workspace Profile | Trader-owned arrangement / method-owned recommendation |
| Surface | A presentation-and-interaction unit (see Surface Architecture) |

Disallowed terms in product surfaces: "live shadow" (use Live Watch),
"signal" as an autonomous instruction (the product produces *opportunities*
that a human decides on), and framework vocabulary in primary navigation.

## 9. Explicit non-goals

- **Autonomous broker execution.** Out of scope for all stages, including T8.
- **Strategy-shaped architecture.** No hardcoded stage pipeline, timeframe
  hierarchy, indicator, instrument, or session in the shell or core types.
- **A universal strategy DSL.** Methods compose structured rules over
  versioned capabilities; speculative expressiveness is not pursued.
- **Multi-tenant or advisory operation.** Personal-first; no managed accounts.
- **AI signals.** AI never invents signals or overrides rules (T8 and beyond;
  investigation and hypotheses only).
- **Modifying the VICT framework** from this repository; framework changes are
  proposed upstream, not applied locally.
- **Backtest optimism as a product stance.** The product reports evidence,
  including unfavorable evidence; it does not decorate results.