/**
 * Author-owned component registration for Trading OS versioned custom
 * surfaces. Registration validates the services bundle up front (fail fast
 * on a broken composition) and registers each island by its exact stable
 * id and explicit revision. Islands themselves receive ONLY bounded
 * primitive props through the plan; rich data flows through product
 * services (Svelte context from the TradingShell).
 */
import type { ComponentRegistry } from '@victframework/application/renderer';
import type { TradingServices } from './services.ts';
import { assertTradingServices } from './services.ts';
import DeskOverview from './desk/DeskOverview.svelte';
import WorkspaceControls from './workspace-controls/WorkspaceControls.svelte';
import MarketChart from './market-chart/MarketChart.svelte';
import Watchlist from './watchlist/Watchlist.svelte';

/** The exact surface identities of this registration set (id @ revision). */
export const TRADING_SURFACE_IDS = {
	deskOverview: { componentId: 'trading.desk-overview', revision: '1' },
	workspaceControls: { componentId: 'trading.workspace-controls', revision: '1' },
	marketChart: { componentId: 'trading.market-chart', revision: '1' },
	watchlist: { componentId: 'trading.watchlist', revision: '1' }
} as const;

/**
 * Register the T1 trading surfaces. `services` is validated (shape-checked)
 * at registration time; islands obtain it through the TradingShell context.
 */
export function registerTradingSurfaces(
	registry: ComponentRegistry,
	services: TradingServices
): void {
	assertTradingServices(services);
	registry.register({ ...TRADING_SURFACE_IDS.deskOverview, implementation: DeskOverview });
	registry.register({
		...TRADING_SURFACE_IDS.workspaceControls,
		implementation: WorkspaceControls
	});
	registry.register({ ...TRADING_SURFACE_IDS.marketChart, implementation: MarketChart });
	registry.register({ ...TRADING_SURFACE_IDS.watchlist, implementation: Watchlist });
}
