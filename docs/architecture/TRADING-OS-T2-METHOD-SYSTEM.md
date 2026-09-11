# Trading OS T2 — Method system and authoring workspace

Status: implemented; independent verification required. This document refines the forward
T2 boundary without changing historical T0/T1 evidence or authorizing T3.

## Vocabulary and lifecycle

A **Method** is a stable UUID lineage with human metadata, origin, monotonic draft revision
counter and sequential immutable version count. Metadata reflects the current draft or last
frozen draft. It is never a mutable alias that silently resolves to a newer version.

A **Working Draft** belongs to one lineage; at most one exists per Method. Schema and
optimistic revision are explicit. Saving accepts structurally valid incomplete content,
including unsupported capability revisions for recovery. Validation never executes anything.
Freezing requires a saved, valid draft. UI edits set `dirty`, requests set `saving`, and only
a validated server acknowledgement sets `saved`. An uncertain mutation retains its exact
request ID/payload for retry. Editing and other actions are locked until reconciliation.
Conflict recovery retains a session copy, offers download, reloads confirmed state and
explicitly reapplies recovery. The shell warns on unloading dirty/saving/conflicting work.
Unsaved recovery is not durable: save or download before closing the browser.

A **Method Version** is an immutable snapshot with UUID, lineage ID, sequential number,
server timestamp, canonical content, SHA-256 fingerprint and provenance. Freezing inserts
the version, consumes the draft, updates the counter and inserts a retry receipt atomically.
No domain update/delete version operation exists; SQLite triggers also refuse ordinary
UPDATE/DELETE on versions.

**Revision** creates a new draft in the same lineage from a selected version and refuses
to replace an existing draft. The draft counter never resets, preventing ABA stale writes.
**Clone** creates a new lineage/draft with an explicit new name. Both pin source version,
source lineage and source fingerprint. Neither changes its source. Archiving/deletion
are absent.

## Capability model

`MethodContent@1` contains name, description, observation requirements, ordered capability
instances and an `all`/`any` rule policy. Observations declare label, instrument, timeframe
and required data type (`bars`). These are authored requirements, not available data or chart
layout. Instances have stable IDs, exact capability ID/revision and bounded scalar config.

The immutable catalog validates and registers complete definition sets atomically, rejecting
duplicate ID/revision pairs and invalid metadata. Fields support bounded text, number, enum,
boolean, observation reference and compatible earlier-instance reference. Labels, descriptions,
categories and diagnostics drive the generic editor. A compatible new catalog definition
requires no screen change. This is a trusted build-time catalog, not runtime plugin loading.

| Definition (all revision 1) | Category  | Authored contract                                 |
| --------------------------- | --------- | ------------------------------------------------- |
| `analysis.range`            | analysis  | Context/lookback; range output declaration        |
| `analysis.mean`             | analysis  | Context/lookback/price; mean output declaration   |
| `rule.range-relation`       | rule      | Context, earlier range reference, relation        |
| `rule.mean-distance`        | rule      | Context, earlier mean reference, side, percentage |
| `rule.session-window`       | rule      | Context and one of three explicit UTC windows     |
| `judgment.question`         | judgment  | Trader question and required flag                 |
| `risk.request`              | risk      | Requested maximum percentage; no enforcement      |
| `execution.assumption`      | execution | Textual assumption; no execution                  |

All definitions declare `definition-only`. No indicators, sessions, candles or rules are
calculated. Freezing requires at least one observation and rule; references must resolve
to compatible earlier outputs. Stable diagnostics include code, field path and prose.
Unknown revisions remain inspectable/savable but cannot freeze; snapshots are never silently
upgraded. The deterministic fixtures prove weekly/15-minute range/session/judgment and daily
mean-distance compositions. They are test data, not production seeds or verified strategies.
This implements the roadmap's definition-only gate; calculations/jobs begin in T3.

## Canonical identity and comparison

Strict parsers reject unknown fields, future schemas, invalid types, non-finite numbers and
excessive sizes. Text normalizes Unicode NFC, line endings and surrounding whitespace. JSON
keys sort; observation declarations sort by stable ID because their declaration order is
nonsemantic. Capability dependency order remains semantic. Instance IDs and definition
revisions remain part of the content. Invalid drafts yield diagnostics and no fingerprint.

Canonical JSON contains only `MethodContent@1`. Identity is `sha256:` plus the SHA-256 hex
digest of UTF-8 canonical bytes, using browser-safe Web Crypto. Storage IDs, timestamps,
counters, provenance and profiles are excluded. Authored name/description are deliberately
included. Different instance IDs imply different content; this is not graph-isomorphism
normalization. Unchanged revisions share content fingerprints but retain distinct version
identities. The server adapter validates stored digests on version read/insert.

Comparison groups metadata, scope, rule policy, capability additions/removals, config and
shared-instance ordering. The UI shows before/after fields, readable reference labels and
provenance, with supplementary read-only canonical inspection. No performance comparison
or raw patch editor exists.

## Persistence and concurrency

Public `@victframework/appdata-sqlite@0.1.1` opens SQLite and owns migration bookkeeping.
The composition root supplies unchanged v1 workspace migration plus product v2/v3 to both
adapters. Existing Workspace Instance rows remain intact.

| Migration                          | Tables and constraints                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1                                 | Existing VICT workspace resources and migration bookkeeping                                                                                                                            |
| v2 `trading-method-system-v2`      | `appdata_methods`, `appdata_method_drafts`, `appdata_method_versions`, `appdata_method_requests`; foreign keys, JSON checks, unique lineage/number, immutable version/receipt triggers |
| v3 `trading-workspace-profiles-v3` | `appdata_workspace_profiles`; append-only revisions, version foreign key, immutable profile triggers                                                                                   |

Transactions use `BEGIN IMMEDIATE`, the public connection's WAL/FULL settings and 5-second
busy timeout. Callbacks are synchronous; promises are refused. Conditional draft writes
check expected revision. The lock serializes independent connections. Freeze hashes outside
the lock then rechecks revision inside its final transaction. Receipts store canonical command
and acknowledged reply atomically with mutations. Exact retries return the original reply
even after draft consumption; reused IDs with different input fail. Receipts are historical
acknowledgements, not a claim that later clients have not changed state. Subsequent writes
still face CAS.

Rollback removes partial versions, draft consumption, counter updates and receipts together.
Migration failures roll back statements/bookkeeping. Future physical or record schemas fail
closed without overwrite. Stable errors exclude raw database exceptions/paths. Runtime DBs
are ignored and never committed; localStorage/sessionStorage are not authoritative.

## Workspace Profile

`WorkspaceProfile@1` is independently append-only and keyed by workspace ID. Its nullable
reference pins one immutable version. Assign/remove uses profile CAS and verifies the
version without changing Method content. The UI exposes the existing default workspace;
storage/service tests prove multiple-workspace isolation. Instrument/timeframe/layout remain
in T1 Workspace Instance. Selection leaves **No active run** intact. Authentication and
multiple-trader/workspace management UI are outside the single-owner local deployment.

## Architecture and UI composition

```text
trading-domain                  browser-safe models, parsers, ports, use cases
    ↑           ↑          ↑
trading-data  trading-capabilities  trading-surfaces
    ↑           ↑          ↑
apps/trading-os                  sole composition root
```

Data imports Node/SQLite only through server-only `trading-data/method-store`; its browser
barrel retains T1 fixtures. Capabilities depends on domain only. Surfaces consumes safe
contracts and isolates UI details. The app binds repository/catalog/use cases/dispatch and
the per-shell controller. The process-level server object holds connections, never domain
truth. Permanent tests enforce dependencies, registry resolution and client boundaries.

VICT Application Definition remains the only navigation authority: 11 routes and unchanged
group order. Revision 2 adds `method_system`, command/reply contracts and seven real actions:
read/create/save/freeze/revise/clone/assign. `/api/act` validates HTTP, command shape, action/op
matching and same-origin local access; the server checks declared read/write grants.
`trading.methods-workspace@1` uses the accepted custom-surface registry. Internal views are
draft/history/comparison, plus native create/freeze/clone dialogs and profile panel. The
command palette is unchanged.

The public renderer composes navigation/status/safe states. Product controls implement
reference-aware authoring and transactional lifecycle. Native labeled controls, explicit
modal focus loops, Escape and focus return support keyboards. Token-based dark compact CSS
stacks mobile panels and wraps long IDs/content. No VICT internals are copied or hidden.
T1's declaration shim and renderer-selector coupling remain upgrade re-verification gates.

## Rejected alternatives, tradeoffs and T3 handoff

Rejected: arbitrary JSON as the primary editor, a universal rule language, bespoke strategy
screens, mutable version aliases, in-place edits, generic resource upserts for multi-record
freeze, optimistic success UI, silent catalog upgrades and premature evaluation. Product
tables are needed for CAS, provenance and atomic receipts; public generic data remains suitable
for T1 layout. No new external dependency or VICT upgrade was introduced.

Explicit save and one draft per lineage simplify recovery. Library/history load whole
records; receipts retain full replies. Pagination, compaction, backup tooling, richer typed
instrument/timeframe catalogs and multi-user authorization need later measured work. Reads
also use immediate transactions for coherent snapshots, favoring local correctness over
high-volume concurrency.

T3 may consume canonical version content, fingerprint, requirements and exact revisions.
It must implement its own deterministic evaluator/data/job/evidence boundary. T2 supplies
no evaluator, dataset, output, future-data fence, opportunity, signal, recommendation, run,
trade or order. Independent verification and acceptance remain required before T3 begins.
