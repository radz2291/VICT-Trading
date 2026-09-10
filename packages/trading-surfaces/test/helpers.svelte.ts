/**
 * Shared test fixtures for trading-surfaces tests. These are test doubles
 * built on the domain port — trading-surfaces tests must not (and do not)
 * depend on the concrete trading-data store.
 */
import { flushSync, mount, unmount } from 'svelte';
import type { Component } from 'svelte';
import type {
	Bar,
	Instrument,
	MarketDataPort,
	MarketDataSnapshot,
	MarketDataHealthState,
	Timeframe
} from '@trading-os/trading-domain';
import {
	TRADING_SERVICES_CONTEXT_KEY,
	type TradingServices,
	type WorkspaceService,
	type BackgroundOperationsService
} from '../src/services.ts';
import type { WorkspaceInstanceState } from '@trading-os/trading-domain';

export const TEST_INSTRUMENTS: readonly Instrument[] = [
	{ id: 'T-A', symbol: 'T-A', name: 'Test Alpha', pricePrecision: 2 },
	{ id: 'T-B', symbol: 'T-B', name: 'Test Bravo', pricePrecision: 3 }
];

export const TEST_TIMEFRAMES: readonly Timeframe[] = [
	{ id: '1h', label: '1H', seconds: 3600 },
	{ id: '1D', label: '1D', seconds: 86400 }
];

/** Deterministic synthetic bars for tests (valid by construction). */
export function testBars(count: number, startTime = Date.UTC(2026, 0, 1)): Bar[] {
	const bars: Bar[] = [];
	let price = 100;
	for (let i = 0; i < count; i++) {
		const open = price;
		const close = price + ((i % 5) - 2);
		bars.push({
			time: startTime + i * 3_600_000,
			open,
			high: Math.max(open, close) + 0.5,
			low: Math.min(open, close) - 0.5,
			close,
			volume: 1000 + i
		});
		price = close;
	}
	return bars;
}

export interface TestSourceConfig {
	readonly bars?: readonly Bar[];
	readonly healthState?: MarketDataHealthState;
	readonly healthMessage?: string;
}

/** A MarketDataPort double with configurable health. */
export function testMarketData(config: TestSourceConfig = {}): MarketDataPort {
	const bars = config.bars ?? testBars(50);
	const healthState = config.healthState ?? 'ok';
	function snapshot(instrumentId: string, timeframeId: string, limit: number): MarketDataSnapshot {
		if (healthState === 'error') {
			return {
				instrumentId,
				timeFrameId: timeframeId,
				bars: [],
				source: { kind: 'fixture', label: 'Fixture data — not live' },
				health: { state: 'error', asOf: 0, message: config.healthMessage ?? 'source error' }
			};
		}
		return {
			instrumentId,
			timeFrameId: timeframeId,
			bars: bars.slice(-Math.max(1, limit)),
			source: { kind: 'fixture', label: 'Fixture data — not live' },
			health:
				healthState === 'stale'
					? {
							state: 'stale',
							asOf: 0,
							message: config.healthMessage ?? 'source has not refreshed'
						}
					: { state: 'ok', asOf: 0 }
		};
	}
	return { instruments: TEST_INSTRUMENTS, timeframes: TEST_TIMEFRAMES, snapshot };
}

/** A minimal reactive workspace-service double (runes-based). */
export function testWorkspace(overrides: Partial<WorkspaceService> = {}): WorkspaceService {
	const instruments = TEST_INSTRUMENTS;
	const timeframes = TEST_TIMEFRAMES;
	let state = $state<WorkspaceInstanceState>({
		instrumentId: 'T-A',
		timeframeId: '1h',
		layoutPreset: 'balanced',
		watchlistVisible: true
	});
	let saveState = $state<WorkspaceService['saveState']>('idle');
	return {
		get state() {
			return state;
		},
		get saveState() {
			return saveState;
		},
		instruments,
		timeframes,
		setInstrument(id: string) {
			state = { ...state, instrumentId: id };
			saveState = 'saved';
		},
		setTimeframe(id: string) {
			state = { ...state, timeframeId: id };
			saveState = 'saved';
		},
		setLayoutPreset(preset: WorkspaceService['state']['layoutPreset']) {
			state = { ...state, layoutPreset: preset };
			saveState = 'saved';
		},
		setWatchlistVisible(visible: boolean) {
			state = { ...state, watchlistVisible: visible };
			saveState = 'saved';
		},
		flush() {
			// Test double: nothing is transmitted; the channel reports saved.
			saveState = 'saved';
		},
		...overrides
	} satisfies WorkspaceService;
}

export function testBackgroundOperations(
	operations: BackgroundOperationsService['operations'] = []
): BackgroundOperationsService {
	return { operations };
}

export function testServices(config: TestSourceConfig = {}): TradingServices {
	return {
		marketData: testMarketData(config),
		workspace: testWorkspace(),
		backgroundOperations: testBackgroundOperations()
	};
}

/**
 * Mount a component with product services provided through Svelte context
 * (the same mechanism the TradingShell uses in the application).
 */
export function mountWithServices(
	Component: Component<Record<string, unknown>>,
	services: TradingServices,
	props: Record<string, unknown> = {}
): { unmount: () => void; container: HTMLElement } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const mounted = mount(Component, {
		target,
		// A static context map is intentional here: the services closure is
		// fixed at registration time and must not be reactive test state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		context: new Map([[TRADING_SERVICES_CONTEXT_KEY, services]]),
		props
	});
	flushSync();
	return {
		unmount: () => {
			unmount(mounted);
			target.remove();
		},
		container: target
	};
}
