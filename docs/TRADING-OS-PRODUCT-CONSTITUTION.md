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
- What did I see, decide, and do — including what I did _not_ do?
- Is my evidence for this method improving or decaying?

The product is a **personal, evidence-governed Trading OS** where the trader
defines and versions many different methods, tests them historically, practices
them through blind replay, observes them against the current market, operates
them during real trading with human authority, and learns from every
opportunity and decision.

## 2. User and product boundary

**User.** A single owner-operator trader (personal-first). The product is
professional-grade, but it does not assume that its user is already a
professional trader. The trader is the authority over every account, method,
and decision. Multi-user operation is not a goal; however, domain boundaries
are kept clean so that a small team or a supervised fund could adopt the same
objects later without re-architecture.

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

1. **Evidence is the purpose.** Every method-qualified opportunity must be
   recordable in every mode, and every human decision — where a human
   decision exists — must be recorded with it. A trading session without
   records has no evidentiary value, however profitable it was.
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
   detected. Methods propose; the risk layer disposes, under the hard/soft
   limit semantics of §7.
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

An operating mode belongs to an **activity** — a backtest run, a replay
session, a Live Watch run, an assisted-live session — never to the
application shell and never to the Trading Program as a whole. Several
activities in different modes can be active at once: a Live Watch run keeps
running in the background while the trader opens Journal or Evidence, works
a Replay session, or studies research surfaces, and none of that navigation
starts, redefines, or stops the running watch. The shell displays the mode
of the workspace/activity the trader currently has in context, plus the
status of all independently active background operations. There is no single
global mutable mode controlling the entire Trading Program.

| Mode              | Definition                                                                                                                                                   | Data                    | Orders                                           | Records                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| **Backtest**      | Accelerated evaluation of a Method Version over historical data                                                                                              | Historical              | Simulated fills only                             | Run summary, per-opportunity records, performance evidence  |
| **Replay**        | Interactive historical practice with future information hidden (blind replay)                                                                                | Historical, clock-gated | Simulated fills only                             | Session records, per-decision records, performance evidence |
| **Live Watch**    | The method monitors the current market in the background, records observations, and records opportunities where its rules qualify; it sends no broker orders | Current market          | None — ever                                      | Observation records, opportunity records                    |
| **Assisted Live** | Real-market operation in which the trader retains final authority over every order                                                                           | Current market          | Broker order only on explicit human confirmation | Full opportunity/decision/evidence records                  |

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
- **Observation requirements** — the semantic information the method
  genuinely requires for evaluation and operation (which instruments, data
  types, and timeframes an evaluation must observe); pinned within the
  Method Version because they affect behavior (see Workspace Profile);
- **Lineage** — parent version, provenance, and identity. Method behavior
  never changes silently: any semantic change is a new Method Version. A
  Workspace Profile change is not a semantic change and never creates a new
  Method Version.

Method Versions must be easy to create, clone, modify, and compare. Cloning
preserves lineage; comparison shows structural and identity differences.

> **A Method Version changes when trading semantics change. A workspace
> recommendation may evolve without changing the method's trading identity.**

### Capability

Reusable domain behavior used by Method Versions: indicators, market-
structure calculations, setup detectors, session calculations, replay,
simulated fills, position sizing, data ingestion, performance calculations.
Reusable behavior exists at two deliberate levels:

- **Pure trading computation** — indicators, rule evaluation, and bar-by-bar
  method execution: deterministic, fast, in-process, independently
  unit-testable product code with no per-call framework persistence or
  authorization overhead. Reusable calculations are registered in
  product-local, revision-identified calculation registries; a Method
  Version pins their exact revisions.
- **Governed capability boundaries** — coarse, consequential operations that
  cross the VICT runtime: starting a backtest, running an evaluation job,
  ingesting a bounded dataset, persisting an evidence result, and any
  externally effectful operation. VICT governs the job and its effects, not
  every mathematical call inside the job.

Creating a method from existing capabilities requires no application code;
a genuinely new calculation becomes one new reusable calculation (or, where
it is consequential, one new governed capability) available to any
compatible method.

### Opportunity, Decision, Execution, Outcome

An **Opportunity** is a method-qualified occurrence: a Method Version's
rules fired under the operating conditions of some mode. It carries its
market context and requires no human classification to exist — Backtest and
Live Watch produce opportunities without any trader decision. A **Decision**
is a trader's resolution of an opportunity (taken, rejected, or modified,
including deciding to do nothing), recorded with its reasoning; decisions
exist only in interactive modes (Replay, Assisted Live). An **Execution** is
the simulated or real fill that may follow — a fact distinct from the
decision. An **Outcome** is the market result of an execution, or the
counterfactual market result computed for an opportunity that went
unexecuted. An **Observation** is a recorded method observation that has not
(yet) qualified as an opportunity; Live Watch records observations
continuously. An opportunity left without a recorded decision is **unacted**
— a recording fact, never an invented decision; unacted opportunities with
computed counterfactual outcomes are the product's missed-opportunity
evidence.

This vocabulary preserves every comparison the evidence spine needs: method
baseline (all opportunities and outcomes), trader selection (decisions
against opportunities), trader modification, execution discipline,
rejected-trade counterfactuals, and missed opportunities.

### Evidence

The recorded, comparable results that make a Method Version's claims checkable:
backtest runs, replay sessions, Live Watch observations, and performance
calculations. Evidence always names the exact Method Version, capability
revisions, data range, and operating conditions that produced it.

### Risk Constitution

The independent risk authority of the Trading Program: capital limits, per-
trade and portfolio risk, allowed sessions, prohibited conditions. It
evaluates and can veto any proposed action. It is never derived from method
detection and never trusts a method's self-assessment. Its limits are of two
kinds:

- **Hard limits** — the application will not execute through them. No
  per-trade acknowledgment neutralizes a hard limit; changing one is a
  deliberate, versioned Risk Constitution change.
- **Soft limits** — warnings the trader may acknowledge per trade and
  proceed; every acknowledgment is recorded.

Activity performed outside the application may be recorded as a violation;
recording it never makes it valid retroactively.

### Session

A defined operating window (time-bounded or condition-bounded) declared by the
Trading Program or by methods. Sessions are data, not platform structure.

### Workspace Instance

The trader-owned arrangement of charts, panels, tools, and runtime bindings
used in a working context. Workspace Instances are user-owned and
method-independent. See Surface Architecture.

### Workspace Profile

An independently versioned presentation recommendation that references a
compatible Method Version (or its observation requirements): the information
the method needs on screen. A Workspace Profile may evolve — better default
layouts, panel sizes, arrangements — without creating a new Method Version,
because it changes no trading semantics. See Surface Architecture.

## 6. Evidence orientation

Every mode produces evidence into one reviewable spine:

- Research produces **Method Versions** and their assumptions.
- Backtest produces **run evidence**.
- Replay produces **practice evidence**.
- Live Watch produces **observation evidence** and opportunities.
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
  not above it. Soft limits may be acknowledged per trade, with the
  acknowledgment recorded. Hard limits cannot be overridden per trade at
  all; they change only through a deliberate, versioned Risk Constitution
  change. No acknowledgment path silently neutralizes a hard constitutional
  limit.
- No component of the system — method, capability, or future AI — may place a
  broker order. The assisted-live path composes an order; the trader commits it.

## 8. Terminology

| Term                                   | Meaning                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Backtest                               | Accelerated evaluation over historical data                                                                              |
| Replay                                 | Interactive historical practice with future information hidden                                                           |
| Live Watch                             | Background monitoring of the current market with no broker orders                                                        |
| Assisted Live                          | Real-market operation with trader final authority                                                                        |
| Method / Method Version                | Lineage / immutable unit of proof                                                                                        |
| Capability                             | Reusable domain behavior                                                                                                 |
| Opportunity / Decision                 | Method-qualified occurrence record / trader resolution in an interactive mode (taken, rejected, modified)                |
| Execution / Outcome                    | Simulated or real fill / market result or counterfactual result                                                          |
| Observation                            | Recorded method observation not (yet) qualified as an opportunity                                                        |
| Operating mode                         | Activity classification (Backtest, Replay, Live Watch, Assisted Live); belongs to an activity or run, never to the shell |
| Evidence                               | Recorded, attributable results                                                                                           |
| Risk Constitution                      | Independent risk authority                                                                                               |
| Trading Program                        | Governing object for accounts, capital, risk, methods, sessions, evidence                                                |
| Method Observation Requirements        | Semantic information a method requires; pinned within the Method Version when behavior-affecting                         |
| Workspace Instance / Workspace Profile | Trader-owned arrangement / independently versioned presentation recommendation referencing a compatible Method Version   |
| Surface                                | A presentation-and-interaction unit (see Surface Architecture)                                                           |

Disallowed terms in product surfaces: "live shadow" (use Live Watch),
"signal" as an autonomous instruction (the product produces _opportunities_
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
