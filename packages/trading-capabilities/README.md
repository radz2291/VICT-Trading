# @trading-os/trading-capabilities

**Intentionally minimal at T1.**

This package is reserved for governed VICT capability boundaries (evaluation
jobs, ingestion, evidence persistence) and the pure computation they
orchestrate. Per the T0 architecture (Consumer-Fit Audit §6.1), governed
capability boundaries wrap _jobs_, not calculations.

T1 contains no method engine, no evaluation, no indicators, no ingestion
jobs — so this package deliberately contains **no fake capabilities and no
placeholder code**. It exists as a declared boundary so the dependency
direction is already enforced by tests (nothing may import it yet; it may
depend on `@trading-os/trading-domain` and `@victframework/sdk`/
`@victframework/runtime` from T2 onward).

First real content: Stage T2 (capability packs: indicators, sessions,
detectors — pure product-local computation inside governed boundaries).
