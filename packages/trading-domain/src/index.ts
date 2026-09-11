/**
 * Trading OS framework-neutral domain.
 *
 * This package depends on NOTHING: no Svelte, no SQLite, no VICT packages,
 * no Node builtins. Ports live here; adapters live outward.
 */
export type { Instrument } from './instrument.ts';
export * from './method.ts';
export * from './method-validation.ts';
export * from './method-records.ts';
export * from './method-service.ts';
export type { Timeframe } from './timeframe.ts';
export type { Bar } from './bar.ts';
export { validateBar, validateBarSeries, type BarIssueCode } from './bar.ts';
export type {
	MarketDataPort,
	MarketDataSnapshot,
	MarketDataSource,
	MarketDataHealth,
	MarketDataHealthState
} from './market-data.ts';
export {
	WORKSPACE_INSTANCE_SCHEMA,
	WORKSPACE_LAYOUT_PRESETS,
	defaultWorkspaceInstance,
	parseWorkspaceInstance,
	serializeWorkspaceInstance,
	type WorkspaceInstance,
	type WorkspaceInstanceState,
	type WorkspaceLayoutPreset,
	type WorkspaceParseResult
} from './workspace-instance.ts';
export * from './evaluation.ts';
