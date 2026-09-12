# @trading-os/trading-capabilities

T2 provides an immutable, exact-revision capability **authoring catalog** using domain-owned
metadata and bounded field contracts. It contains eight definition-only capabilities for
analysis requirements, rules, judgment questions, risk requests and execution assumptions.

`createCapabilityCatalog` validates and installs a complete catalog atomically;
`createAuthoringCatalog` provides the T2 set. Compatible definitions require no Methods UI
change. Tests prove multi-context range and daily mean-distance compositions without
production seed records or strategy claims.

T3 adds the separate `./calculations` entry: one immutable registry and pure evaluator for
range, mean, range relation, mean distance and UTC session windows. Definitions stay at
revision 1; calculations pin `closed-bars-v1`. Only app server composition imports this entry.
Public VICT operations wrap coarse work in the app, never each bar. This package owns
neither Method lineage nor persistence and depends only on `@trading-os/trading-domain`.

See [T2 architecture](../../docs/architecture/TRADING-OS-T2-METHOD-SYSTEM.md).

See [T3 architecture](../../docs/architecture/TRADING-OS-T3-DETERMINISTIC-EVALUATION.md).
