/**
 * The market-data port, owned by the trading domain. Data implementations
 * (`trading-data`) implement this port; surfaces consume it through
 * presentation-safe services; nothing depends upward on an adapter.
 */
import type { Instrument } from './instrument.ts';
import type { Timeframe } from './timeframe.ts';
import type { Bar } from './bar.ts';

/** Health state of a market-data view. */
export type MarketDataHealthState = 'ok' | 'stale' | 'error';

/** Truthful source identity of a market-data view. */
export interface MarketDataSource {
	/** Source kind. T1 ships only deterministic fixtures. */
	readonly kind: 'fixture';
	/** Human-readable source label (must never imply live or broker data). */
	readonly label: string;
}

/** Health metadata accompanying a snapshot. */
export interface MarketDataHealth {
	readonly state: MarketDataHealthState;
	/** Anchor timestamp (UTC ms) the data is current as of. */
	readonly asOf: number;
	/** Optional human-readable detail (e.g. a structured failure message). */
	readonly message?: string;
}

/** An ordered, bounded bar snapshot with truthful source/health metadata. */
export interface MarketDataSnapshot {
	readonly instrumentId: string;
	readonly timeFrameId: string;
	readonly bars: readonly Bar[];
	readonly source: MarketDataSource;
	readonly health: MarketDataHealth;
}

/**
 * The market-data port. Implementations must be deterministic for T1:
 * the same arguments return the same snapshot in the same process state.
 */
export interface MarketDataPort {
	/** The instruments the source serves. */
	readonly instruments: readonly Instrument[];
	/** The timeframes the source serves. */
	readonly timeframes: readonly Timeframe[];
	/**
	 * A bounded, ordered bar snapshot. Implementations must return at most
	 * `limit` bars, ordered oldest → newest.
	 */
	snapshot(instrumentId: string, timeframeId: string, limit: number): MarketDataSnapshot;
}
