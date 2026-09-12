# Trading OS T3 — Deterministic data and evaluation

Status: implemented — independent verification required. This decision
record was established before implementation on baseline `6805b99abf38a1da0a989dc5b69c93beaedfbe86`.

## Decisions and acceptance matrix

| Gate         | Required implementation and proof                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data         | Immutable series revisions, provenance, coverage, gap health; strict bounded OHLCV validation; atomic fixture installation and exact retry                   |
| Identity     | Canonical input/result bytes; exact Method, data, calculation, engine and operation identities; operational metadata excluded                                |
| Time         | Explicit driver observation; UTC close instants; closed bars only; half-open range/session; poison-future tests                                              |
| Calculations | Immutable registry; hand-calculated range/mean/relation/distance/session; warm-up and gaps unavailable; complete all/any truth tables                        |
| Persistence  | Migration 4 following unchanged migrations 1–3; foreign keys, immutable triggers, CAS lifecycle, rollback, tamper checks, restart interruption               |
| Governance   | Real public VICT runtime invocation with input/output contracts, effect and permission declarations; no per-bar framework operations                         |
| Product      | Markets catalog/install, Methods frozen-version evaluation configuration and persisted timestamp inspector; source/health/revisions/diagnostics/declarations |
| Safety       | Bounds, sanitized errors, same-origin checks, no server code in browser, negative boundary probes                                                            |
| Verification | Unit/controller/store/process tests, production Chrome at three sizes, axe, geometry, screenshots, fresh registry-only clone                                 |
| Delivery     | Historical evidence byte-preserved; reviewed linear commits and normal push; T3 implemented — independent verification required only                         |

## Public framework boundary

Published `@victframework/sdk@0.1.1/dist/capability.d.ts` defines executable
capabilities with exact `revision`, `effect`, executable input/output contracts,
`permissions`, and keyed idempotency. Published `@victframework/runtime@0.1.1`
exports `createRuntime`, `registerCapability`, `activate`, and `run`; its runtime
enforces contracts, authorization and effect policy before invocation. `runNode`
is deliberately unsuitable: it forces test mode and does not persist runtime runs.

Use real `run` calls over single-node graphs for coarse product operations.
Runtime activation/execution traces are bounded, per-invocation in-memory records;
they are **not** represented as durable framework jobs. Product SQLite envelopes,
receipts and results provide persistence/restart truth, as explicitly allowed by the
public composition boundary. Each runtime is released after its call, preventing
unbounded trace retention. This adds the public runtime/kernel packages at the
existing exact 0.1.1 release set; it does not upgrade VICT. No private API or local
checkout is consumed. Result persistence happens inside the governed evaluation
write; result/catalog reads are governed read operations.

## Data identity and ingestion

Versioned series content pins instrument, timeframe ID/duration, UTC opening
timestamp convention, source kind/label, generator revision and sorted OHLCV bars.
SHA-256 of canonical content identifies a revision. Ingestion time and request ID
are operational and excluded. Coverage is `[first open, last close)`. Bars must be
strictly increasing, aligned to a declared interval anchor, finite and valid OHLCV;
duplicate/unordered/non-finite/negative-zero input is rejected. Gaps are permitted
only at whole intervals, recorded in health, and never filled synthetically.

Fixture revision 1 uses a fixed integer PRNG seed and Monday UTC anchor. Continuous
15-minute bars (including weekends: a synthetic calendar, not exchange history)
are aggregated into UTC daily and Monday-to-Monday weekly bars from that same base.
EXAMPLE-A supports the T2 weekly/15m range shape; EXAMPLE-B supports its daily mean
shape. Every surface labels this `Deterministic fixture data — not live or broker history`.
Installation is explicit and bounded, never an automatic Method seed.

## Time and exact calculation revision 1

Engine `trading.evaluator@1`; calculation implementation revision `closed-bars-v1`
is separate from each unchanged T2 definition revision `1`. The user explicitly
accepts this revision when starting a run; every run pins and displays it. This
resolves previously unspecified semantics without changing a frozen Method.

The request chooses a driver observation. Frames are expected driver close instants
in `[start, end)`, including missing expected closes so gaps remain visible. At frame
T, the latest eligible bar has `open + duration <= T`; never use an unfinished bar.
Require the most recent expected closed interval in every accessed context; stale
bars do not masquerade as available. A lookback excludes that current closed bar
and includes exactly N immediately preceding contiguous intervals. Thus a reference
needs N+1 closed bars. Future bars never influence a frame.

| Definition @1       | Calculation closed-bars-v1                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| analysis.range      | High=max(high), low=min(low) over N previous closed bars, excluding current; insufficient history → warm-up; holes → missing-data          |
| analysis.mean       | Arithmetic mean of authored OHLC field over the same N previous bars; deterministic chronological addition                                 |
| rule.range-relation | Current context close > high, < low, or inclusive low ≤ close ≤ high; source must be an earlier available range                            |
| rule.mean-distance  | Current close relative to source mean: above `(close-mean)/abs(mean)*100 ≥ threshold`, below inverse; equality true; zero mean unavailable |
| rule.session-window | Frame close instant UTC minute in `[00,08)`, `[08,16)`, or `[16,24)`; context must have current closed bar                                 |

All finite outputs normalize negative zero to zero. Non-finite arithmetic is
unavailable with diagnostics, never JSON null or false. Judgment questions remain
unanswered human questions; risk requests and execution assumptions remain declarations.

Strong Kleene composition: `all` is false if any false, otherwise unavailable if
any unavailable, otherwise true; `any` is true if any true, otherwise unavailable
if any unavailable, otherwise false. Individual unavailable diagnostics are retained
even if another rule determines the aggregate. No DSL/composite is needed for the
two accepted shapes; AV-4 remains a watch-item for a genuinely needed reusable composite.

## Evaluation and identity

Validate frozen Method and exact registry, resolve explicit compatible observation
bindings, read each unique series once with bounded warm-up, then evaluate declared
capability order over the explicit timeline. Canonical identity pins version ID and
fingerprint, sorted observation bindings with immutable series fingerprints, range,
driver, exact calculations, engine and governed write revision. No `latest` lookup.
Result bytes contain identity, frames, diagnostics, counts and separate declarations;
no request IDs, durations or wall clock. New request IDs permit intentional reruns;
reusing an ID with different semantics is a conflict.

## Persistence, UI and carried obligations

Migration 4 adds series, bars, ingestion receipts, evaluation envelopes and immutable
results. Transactional completion inserts results and CAS-updates the run atomically.
Queued/running envelopes from a lost process become interrupted on restart and require
a deliberate new request; completed content is never overwritten. All affected T2 and
new T3 stores cross-check indexed columns against decoded identities on reads (AV-2).

The existing navigation remains canonical. Markets receives a registered data catalog
surface; Methods receives evaluation configuration and inspection within its registered
workspace. Services are browser-safe closures, repositories/calculations/runtime are
bound only by the app. Selection never starts an operating mode. Shell background
status reflects real pending work; idle remains `No background operations`.

AV-1 profile-specific failures, AV-3 mobile Ctrl K geometry, AV-6 readable profile
context, and AV-7 safe server diagnostics are required gates. AV-5 remains the pinned
association only: no profile-driven behavior. T1 renderer shim/selector upgrade gates,
npm legacy-peer-deps workaround and accepted Desk sparsity carry unchanged.

## T4 handoff and exclusions

This inspector produces calculation/rule states only. T4 still requires independent
T3 verification/acceptance and the fuller Workspace Profile schema gate. No Backtest,
Replay, replay clock, hidden future UI, opportunity, signal, recommendation, trade,
fill, position, P&L, performance claim, Journal/Evidence spine, Live Watch, Assisted
Live, provider, broker, credentials, orders, AI, deployment or dynamic navigation
mutation is authorized or introduced.

## Exact output schemas and operational bounds

Every capability output pins instance ID, definition ID/revision, calculation revision and kind.
Available analysis outputs carry `state: available`; rules carry `true` or `false`. Their
numeric `values` are respectively `{high,low}`, `{mean}`, `{close,high,low}`,
`{close,mean,distancePercent}`, and `{utcHour}` in the table order above. Unavailable outputs
carry empty values and a bounded diagnostic array with static code, safe message and instance ID.
Frames carry UTC close time, all ordered machine outputs and the combined rule state. Judgment,
risk and execution instance declarations are retained separately; they never enter rule composition.

Limits: 65,536 bars per imported series, at most eight series / 300,000 bars per ingestion;
64 catalog records; 32 explicit observation bindings; 64 capability instances; 366 days;
512 expected driver frames; 12,000 input bars per unique series and 120,000 total. Canonical
results are limited to 4,000,000 UTF-8 bytes, with a bounded 12,000,000-byte streamed browser
reply (the transport contains both parsed content and canonical text). API request streams
stop at 300,000 bytes. Run listing is bounded to the newest 100 records; durable records are
retained, but no archival/pagination/deletion UI is introduced. At most two locally queued
jobs are accepted; pure computation is synchronous and not a worker-thread service.

The fixed seed is 73129, anchor 2025-01-06T00:00:00.000Z, coverage ends exclusively at
2025-10-13T00:00:00.000Z. A gap revision removes lower intervals 24,003, 24,004 and 24,104;
it does not change the complete higher-timeframe revision. Series identities include this distinction.

Authorization is a fixed single-owner server grant profile. `trading.data-read@1` declares
read/market.read; `trading.ingest-fixture@1` declares write/market.write;
`trading.evaluation-start@1` and `trading.evaluate@1` declare write/evaluation.write plus
market.read. Public runtime contract validation/authorization/effect checks execute on actual
single-node graphs. Product request receipts and CAS transitions provide cross-request
idempotency and persistence; per-call framework traces are not durable product job records.
An unconfirmed network acknowledgement is reconciled using the original request ID. Failed
and interrupted terminal requests require a new ID for intentional execution.

Server reads verify SQL/JSON identities and stored hashes; the browser additionally verifies
SHA-256 of canonical result and input identity before displaying evidence. This is corruption
and mismatch detection, not a cryptographic signature or protection from an attacker who can
rewrite the application and all hashes. Existing SQLite store ownership remains local.

All result inspection stays in the Methods workspace; immutable stored series can be inspected
in Markets. The chart is explicitly loaded, bounded and visually selects the inspected close
without playback or hidden future data. The T1 preview chart is still a separate fixture view.
