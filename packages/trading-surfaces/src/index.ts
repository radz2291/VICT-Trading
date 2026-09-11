/**
 * Trading OS versioned custom trading surfaces (registered VICT component
 * surfaces). Depends only on presentation-safe domain types and the VICT
 * component-registry contract — never the concrete market-data store, never
 * Node-only modules, never the SvelteKit host.
 */
export {
	TRADING_SERVICES_CONTEXT_KEY,
	getTradingServices,
	assertTradingServices,
	TradingServicesMissingError,
	type TradingServices,
	type WorkspaceService,
	type WorkspaceSaveState,
	type BackgroundOperationsService,
	type BackgroundOperation
} from './services.ts';
export { TRADING_SURFACE_IDS, registerTradingSurfaces } from './registry.ts';
export {
	resolveChartPhase,
	formatOhlcv,
	clampCursorIndex,
	type ChartPhase,
	type OhlcvText
} from './market-chart/chart-logic.ts';
export {
	createMarketChart,
	type MarketChartHandle,
	type MarketChartColors,
	type MarketChartOptions
} from './market-chart/market-chart-adapter.ts';
export { resolveMarketChartColors } from './market-chart/chart-colors.ts';
export type { MethodWorkspaceService, AuthoringState } from './methods/method-workspace.ts';
export type { EvaluationWorkspaceService } from './evaluation/evaluation-workspace.ts';
