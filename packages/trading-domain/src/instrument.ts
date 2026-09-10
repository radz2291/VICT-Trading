/**
 * Instrument identity. Instruments are fixture/market data concerns of the
 * data layer; the domain owns only the identity and presentation metadata.
 * Nothing here is strategy- or method-specific.
 */
export interface Instrument {
	/** Stable instrument identifier (e.g. `'FXT-A'`). */
	readonly id: string;
	/** Display symbol. */
	readonly symbol: string;
	/** Human-readable instrument name. */
	readonly name: string;
	/** Decimal places used when presenting prices for this instrument. */
	readonly pricePrecision: number;
}
