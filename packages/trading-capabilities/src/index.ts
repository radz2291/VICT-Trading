import {
	immutableCopy,
	identifier,
	fieldIssue,
	type CapabilityCatalog,
	type CapabilityDefinition,
	type CapabilityField
} from '@trading-os/trading-domain';

/** Atomic catalog construction. Exact revisions coexist; duplicates never replace one. */
export function createCapabilityCatalog(
	definitions: readonly CapabilityDefinition[]
): CapabilityCatalog {
	const entries = new Map<string, CapabilityDefinition>();
	for (const definition of definitions) {
		identifier(definition.id);
		identifier(definition.revision);
		const key = `${definition.id}@${definition.revision}`;
		if (
			entries.has(key) ||
			definition.availability !== 'definition-only' ||
			!definition.label ||
			!definition.description ||
			!['analysis', 'rule', 'judgment', 'risk', 'execution'].includes(definition.category)
		)
			throw new TypeError('Invalid or duplicate capability definition.');
		const keys = new Set<string>();
		for (const field of definition.fields) {
			identifier(field.key);
			if (
				keys.has(field.key) ||
				!field.label ||
				!field.description ||
				['__proto__', 'constructor', 'prototype'].includes(field.key)
			)
				throw new TypeError('Invalid capability field.');
			if (!['text', 'number', 'enum', 'boolean', 'context', 'instance'].includes(field.type))
				throw new TypeError('Unsupported field type.');
			if (
				field.type === 'number' &&
				(!Number.isFinite(field.min) || !Number.isFinite(field.max) || field.min > field.max)
			)
				throw new TypeError('Invalid numeric field.');
			if (
				field.type === 'enum' &&
				(!field.options.length || new Set(field.options).size !== field.options.length)
			)
				throw new TypeError('Invalid enum field.');
			if (field.type !== 'context' && field.type !== 'instance' && fieldIssue(field, field.default))
				throw new TypeError('Invalid capability default.');
			keys.add(field.key);
		}
		entries.set(key, immutableCopy(definition));
	}
	return Object.freeze({
		definitions: Object.freeze([...entries.values()]),
		resolve: (id: string, revision: string) => entries.get(`${id}@${revision}`)
	});
}
const context: CapabilityField = {
	key: 'context',
	label: 'Observation context',
	description: 'The declared instrument and timeframe this definition uses.',
	type: 'context',
	required: true,
	default: ''
};
const lookback: CapabilityField = {
	key: 'lookback',
	label: 'Lookback bars',
	description: 'Required observation length; nothing is calculated in T2.',
	type: 'number',
	required: true,
	min: 2,
	max: 10000,
	integer: true,
	default: 20
};
const source = (output: string): CapabilityField => ({
	key: 'source',
	label: 'Analysis source',
	description: 'A compatible analysis instance earlier in the composition.',
	type: 'instance',
	required: true,
	output,
	default: ''
});
const choice = (
	key: string,
	label: string,
	description: string,
	options: readonly string[]
): CapabilityField => ({
	key,
	label,
	description,
	type: 'enum',
	required: true,
	options,
	default: options[0]!
});
export const AUTHORING_DEFINITIONS: readonly CapabilityDefinition[] = immutableCopy([
	{
		id: 'analysis.range',
		revision: '1',
		label: 'Range reference',
		description: 'Describe a high/low range over a declared observation context.',
		category: 'analysis',
		output: 'range',
		availability: 'definition-only',
		fields: [context, lookback]
	},
	{
		id: 'analysis.mean',
		revision: '1',
		label: 'Mean reference',
		description: 'Describe an arithmetic mean reference over a declared observation context.',
		category: 'analysis',
		output: 'mean',
		availability: 'definition-only',
		fields: [
			context,
			lookback,
			choice('price', 'Price field', 'The authored input field.', ['close', 'open', 'high', 'low'])
		]
	},
	{
		id: 'rule.range-relation',
		revision: '1',
		label: 'Range relation',
		description: 'Describe a price relationship to a pinned range analysis. No detection occurs.',
		category: 'rule',
		output: null,
		availability: 'definition-only',
		fields: [
			context,
			source('range'),
			choice('relation', 'Required relation', 'The intended structural relationship.', [
				'above-high',
				'below-low',
				'inside-range'
			])
		]
	},
	{
		id: 'rule.mean-distance',
		revision: '1',
		label: 'Mean distance',
		description: 'Describe a percentage distance from a pinned mean reference.',
		category: 'rule',
		output: null,
		availability: 'definition-only',
		fields: [
			context,
			source('mean'),
			choice('side', 'Side of mean', 'The intended side of the reference.', ['below', 'above']),
			{
				key: 'distancePercent',
				label: 'Distance (%)',
				description: 'Authored distance threshold in percentage points.',
				type: 'number',
				required: true,
				min: 0.01,
				max: 100,
				integer: false,
				default: 2
			}
		]
	},
	{
		id: 'rule.session-window',
		revision: '1',
		label: 'Session window',
		description: 'Describe a same-day UTC applicability window. No clock or session evaluation.',
		category: 'rule',
		output: null,
		availability: 'definition-only',
		fields: [
			context,
			choice(
				'session',
				'UTC window',
				'Fixed authoring vocabulary; a new definition revision can add windows.',
				['00:00–08:00', '08:00–16:00', '16:00–24:00']
			)
		]
	},
	{
		id: 'judgment.question',
		revision: '1',
		label: 'Judgment question',
		description: 'Record a question for the trader, explicitly separate from structured rules.',
		category: 'judgment',
		output: null,
		availability: 'definition-only',
		fields: [
			{
				key: 'question',
				label: 'Question for the trader',
				description: 'A human judgment prompt; never a computed condition.',
				type: 'text',
				required: true,
				maxLength: 1000,
				default: 'What context could invalidate this idea?'
			},
			{
				key: 'required',
				label: 'Answer required',
				description: 'A declared requirement for a future interactive workflow.',
				type: 'boolean',
				required: true,
				default: true
			}
		]
	},
	{
		id: 'risk.request',
		revision: '1',
		label: 'Risk request',
		description:
			'Record the Method’s requested risk ceiling. The Risk Constitution retains authority.',
		category: 'risk',
		output: null,
		availability: 'definition-only',
		fields: [
			{
				key: 'maxRiskPercent',
				label: 'Requested risk ceiling (%)',
				description: 'A request only; no sizing, approval or enforcement occurs.',
				type: 'number',
				required: true,
				min: 0.01,
				max: 100,
				integer: false,
				default: 1
			}
		]
	},
	{
		id: 'execution.assumption',
		revision: '1',
		label: 'Execution assumption',
		description: 'Document an assumption for future evaluation. No fills are simulated.',
		category: 'execution',
		output: null,
		availability: 'definition-only',
		fields: [
			{
				key: 'assumption',
				label: 'Assumption',
				description: 'State what a later evaluation must account for.',
				type: 'text',
				required: true,
				maxLength: 2000,
				default: 'Costs and fill behavior must be specified before evaluation.'
			}
		]
	}
]);
export function createAuthoringCatalog(): CapabilityCatalog {
	return createCapabilityCatalog(AUTHORING_DEFINITIONS);
}
