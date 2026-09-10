/**
 * Trading OS market-data layer. Implements the trading-domain market-data
 * port with deterministic fixtures (T1). No live providers exist.
 */
export {
	FIXTURE_ANCHOR_MS,
	FIXTURE_BARS_PER_SERIES,
	FIXTURE_INSTRUMENTS,
	FIXTURE_TIMEFRAMES,
	createFixtureMarketData,
	generateFixtureBars
} from './fixture-market-data.ts';
export { mulberry32, hashString, type SeededRandom } from './seeded-random.ts';
