import { METHOD_CONTENT_SCHEMA, type MethodContent } from '@trading-os/trading-domain';
/** Structural probes only. No market data, calculations, or strategy claims. */
export const breakoutFixture: MethodContent = {
	schema: METHOD_CONTENT_SCHEMA,
	name: 'Multi-context range study',
	description: 'Structural expressiveness fixture — not evaluated.',
	rulePolicy: 'all',
	observations: [
		{
			id: 'macro',
			label: 'Directional context',
			instrument: 'EXAMPLE-A',
			timeframe: '1W',
			dataType: 'bars'
		},
		{
			id: 'entry',
			label: 'Entry context',
			instrument: 'EXAMPLE-A',
			timeframe: '15m',
			dataType: 'bars'
		}
	],
	capabilities: [
		{
			id: 'range',
			capabilityId: 'analysis.range',
			revision: '1',
			config: { context: 'macro', lookback: 26 }
		},
		{
			id: 'break',
			capabilityId: 'rule.range-relation',
			revision: '1',
			config: { context: 'entry', source: 'range', relation: 'above-high' }
		},
		{
			id: 'session',
			capabilityId: 'rule.session-window',
			revision: '1',
			config: { context: 'entry', session: '08:00–16:00' }
		},
		{
			id: 'judgment',
			capabilityId: 'judgment.question',
			revision: '1',
			config: { question: 'Is the broader context coherent?', required: true }
		}
	]
};
export const reversionFixture: MethodContent = {
	schema: METHOD_CONTENT_SCHEMA,
	name: 'Single-context mean study',
	description: 'Structural expressiveness fixture — not evaluated.',
	rulePolicy: 'all',
	observations: [
		{
			id: 'daily',
			label: 'Daily context',
			instrument: 'EXAMPLE-B',
			timeframe: '1D',
			dataType: 'bars'
		}
	],
	capabilities: [
		{
			id: 'mean',
			capabilityId: 'analysis.mean',
			revision: '1',
			config: { context: 'daily', lookback: 30, price: 'close' }
		},
		{
			id: 'distance',
			capabilityId: 'rule.mean-distance',
			revision: '1',
			config: { context: 'daily', source: 'mean', side: 'below', distancePercent: 2 }
		}
	]
};
