/**
 * Presentation-safe product services for versioned custom trading surfaces.
 *
 * These interfaces are the ONLY way islands reach product state: rich data
 * flows below the surface through these typed services — never through VICT
 * props, which stay bounded and primitive. Implementations live in the
 * composition root (`apps/trading-os`); surfaces consume them through
 * Svelte context provided by the `TradingShell` and validated at
 * registration time.
 */
import type {
	Instrument,
	MarketDataPort,
	Timeframe,
	WorkspaceLayoutPreset,
	WorkspaceInstanceState
} from '@trading-os/trading-domain';

/** Re-exported presentation-safe domain vocabulary for surface authors. */
export type { Instrument, Timeframe, WorkspaceLayoutPreset, WorkspaceInstanceState };

/** A background operation reported by the shell (truthful; may be empty). */
export interface BackgroundOperation {
	readonly id: string;
	readonly label: string;
	readonly state: 'running' | 'completed' | 'failed';
}

/**
 * Truthful state of the workspace persistence channel.
 *
 * - `idle`   — nothing to persist (or nothing changed since the last save).
 * - `saving` — a save is pending or in flight (debounce window, request on
 *              the wire, or a scheduled retry). The workspace may not be
 *              persisted yet.
 * - `saved`  — the newest save completed successfully.
 * - `failed` — the newest save failed and its retry budget is exhausted;
 *              the in-memory state was NOT persisted.
 *
 * A failed save is never silently suppressed: the shell renders this state.
 */
export type WorkspaceSaveState = 'idle' | 'saving' | 'saved' | 'failed';

/** The workspace controller surface used by trading islands. */
export interface WorkspaceService {
	/** Reactive snapshot of the persisted workspace state. */
	readonly state: WorkspaceInstanceState;
	/** Selectable instruments (from the bound market-data source). */
	readonly instruments: readonly Instrument[];
	/** Selectable timeframes (from the bound market-data source). */
	readonly timeframes: readonly Timeframe[];
	/** Reactive, truthful persistence-channel state (see `WorkspaceSaveState`). */
	readonly saveState: WorkspaceSaveState;
	setInstrument(instrumentId: string): void;
	setTimeframe(timeframeId: string): void;
	setLayoutPreset(preset: WorkspaceLayoutPreset): void;
	setWatchlistVisible(visible: boolean): void;
	/**
	 * Persist immediately, bypassing the debounce window (used on page hide
	 * and available to surfaces). No-op when nothing is un-persisted.
	 */
	flush(): void;
}

/** Truthful background-operation reporting (no fake jobs, ever). */
export interface BackgroundOperationsService {
	readonly operations: readonly BackgroundOperation[];
}

/** The full product-services bundle surfaces may consume. */
export interface TradingServices {
	readonly marketData: MarketDataPort;
	readonly workspace: WorkspaceService;
	readonly backgroundOperations: BackgroundOperationsService;
}

/** Svelte context key (module identity is stable within one application build). */
export const TRADING_SERVICES_CONTEXT_KEY = Symbol.for('trading-os.services@1');

import { getContext } from 'svelte';

/**
 * Obtain the product services inside a trading island. Must be called
 * during component initialisation inside the TradingShell composition —
 * a missing bundle is a structured composition failure, never undefined
 * silently flowing into a surface.
 */
export function getTradingServices(): TradingServices {
	const services = getContext<TradingServices | null>(TRADING_SERVICES_CONTEXT_KEY);
	if (services === null || services === undefined) {
		throw new TradingServicesMissingError();
	}
	return services;
}

/**
 * Structured error thrown when a surface cannot find product services —
 * a composition failure, never silently tolerated.
 */
export class TradingServicesMissingError extends Error {
	readonly code = 'TRADING_SERVICES_MISSING';
	constructor() {
		super(
			'Trading services were not provided. Islands must render inside the TradingShell composition root.'
		);
		this.name = 'TradingServicesMissingError';
	}
}

/** Validate the services shape at registration time (fail fast, structured). */
export function assertTradingServices(services: unknown): asserts services is TradingServices {
	const problems: string[] = [];
	if (typeof services !== 'object' || services === null) {
		throw new TypeError('Trading services must be an object.');
	}
	const s = services as Record<string, unknown>;
	if (typeof s['marketData'] !== 'object' || s['marketData'] === null) problems.push('marketData');
	if (typeof s['workspace'] !== 'object' || s['workspace'] === null) problems.push('workspace');
	if (typeof s['backgroundOperations'] !== 'object' || s['backgroundOperations'] === null) {
		problems.push('backgroundOperations');
	}
	if (problems.length > 0) {
		throw new TypeError(`Trading services are incomplete; missing: ${problems.join(', ')}.`);
	}
}
