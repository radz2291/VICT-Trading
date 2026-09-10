/**
 * Timeframe identity. The platform has no timeframe hierarchy; a timeframe
 * is plain identity data used by the market-data port and workspaces.
 */
export interface Timeframe {
	/** Stable timeframe identifier (e.g. `'1h'`). */
	readonly id: string;
	/** Display label (e.g. `'1H'`). */
	readonly label: string;
	/** Bar duration in seconds. */
	readonly seconds: number;
}
