# @trading-os/trading-capabilities

T2 provides an immutable, exact-revision capability **authoring catalog** using domain-owned
metadata and bounded field contracts. It contains eight definition-only capabilities for
analysis requirements, rules, judgment questions, risk requests and execution assumptions.

`createCapabilityCatalog` validates and installs a complete catalog atomically;
`createAuthoringCatalog` provides the T2 set. Compatible definitions require no Methods UI
change. Tests prove multi-context range and daily mean-distance compositions without
production seed records or strategy claims.

No indicator, session, candle or rule evaluation exists. Pure calculations and governed VICT
job boundaries belong to T3; jobs wrap work, not individual calculations. This package owns
neither Method lineage nor persistence and depends only on `@trading-os/trading-domain`.

See [T2 architecture](../../docs/architecture/TRADING-OS-T2-METHOD-SYSTEM.md).
