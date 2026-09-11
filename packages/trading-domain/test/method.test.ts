import { describe, expect, it } from 'vitest';
import {
	canonicalizeMethod,
	contentFingerprint,
	parseMethodContent,
	emptyMethodContent,
	immutableCopy,
	parseMethodCommand,
	parseDraft,
	parseMethod,
	parseVersion,
	parseProfile,
	originalProvenance,
	compareMethodVersions,
	type CapabilityCatalog,
	type MethodContent,
	type MethodVersion
} from '../src/index.ts';

const catalog: CapabilityCatalog = {
	definitions: [],
	resolve: (id, revision) =>
		id === 'test.rule' && revision === '1'
			? {
					id,
					revision,
					label: 'Test rule',
					description: 'Definition test',
					category: 'rule',
					availability: 'definition-only',
					output: null,
					fields: [
						{
							key: 'threshold',
							label: 'Threshold',
							description: 'Test value',
							required: true,
							type: 'number',
							min: 0,
							max: 100,
							integer: false,
							default: 1
						}
					]
				}
			: undefined
};
const content: MethodContent = {
	...emptyMethodContent('Range study'),
	observations: [
		{ id: 'daily', label: 'Daily', instrument: 'X', timeframe: '1D', dataType: 'bars' }
	],
	capabilities: [
		{ id: 'condition', capabilityId: 'test.rule', revision: '1', config: { threshold: 3 } }
	]
};
async function version(definition = content): Promise<MethodVersion> {
	const c = await canonicalizeMethod(definition, catalog);
	return {
		schema: 'trading.method-version@1',
		id: 'v1',
		methodId: 'm1',
		number: 1,
		createdAt: '2026-09-10T00:00:00.000Z',
		provenance: originalProvenance(),
		content: c.content,
		canonical: c.canonical!,
		fingerprint: c.fingerprint!
	};
}
describe('Method identity and invariants', () => {
	it('normalizes whitespace, Unicode and object keys deterministically', async () => {
		const a = await canonicalizeMethod(
			{ ...content, name: '  Cafe\u0301  ', description: 'Text\r\nline ' },
			catalog
		);
		const b = await canonicalizeMethod(
			{ ...content, description: 'Text\nline', name: 'Café' },
			catalog
		);
		expect(a.canonical).toBe(b.canonical);
		expect(a.fingerprint).toBe(b.fingerprint);
	});
	it('uses the platform SHA-256 algorithm with a known vector', async () => {
		expect(await contentFingerprint('abc')).toBe(
			'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});
	it('keeps capability ordering semantic but normalizes observation declaration order', async () => {
		const two = {
			...content,
			observations: [...content.observations, { ...content.observations[0]!, id: 'hour' }],
			capabilities: [...content.capabilities, { ...content.capabilities[0]!, id: 'second' }]
		};
		const a = await canonicalizeMethod(two, catalog);
		expect(
			(await canonicalizeMethod({ ...two, observations: [...two.observations].reverse() }, catalog))
				.fingerprint
		).toBe(a.fingerprint);
		expect(
			(await canonicalizeMethod({ ...two, capabilities: [...two.capabilities].reverse() }, catalog))
				.fingerprint
		).not.toBe(a.fingerprint);
	});
	it('changes identity for authored metadata, scope, rules, config, and revisions', async () => {
		const a = await canonicalizeMethod(content, catalog);
		for (const next of [
			{ ...content, name: 'Other' },
			{ ...content, description: 'Meaningful assumption' },
			{ ...content, rulePolicy: 'any' as const },
			{ ...content, observations: [{ ...content.observations[0]!, instrument: 'Y' }] },
			{ ...content, capabilities: [{ ...content.capabilities[0]!, config: { threshold: 4 } }] }
		])
			expect((await canonicalizeMethod(next, catalog)).fingerprint).not.toBe(a.fingerprint);
	});
	it('excludes storage identity, timestamps and provenance from semantic identity', async () => {
		const a = await version();
		const b = {
			...a,
			id: 'v2',
			number: 2,
			createdAt: '2026-09-11T00:00:00.000Z',
			provenance: {
				kind: 'revision' as const,
				sourceVersionId: a.id,
				sourceMethodId: a.methodId,
				sourceFingerprint: a.fingerprint
			}
		};
		expect(parseVersion(b).fingerprint).toBe(a.fingerprint);
		expect(compareMethodVersions(a, b)).toEqual([]);
	});
	it('rejects malformed and future schemas, extra fields, cycles and oversized inputs', () => {
		for (const value of [
			null,
			[],
			{ ...content, schema: 'trading.method-content@99' },
			{ ...content, evaluator: 'code' },
			{ ...content, name: 'x'.repeat(121) },
			{ ...content, observations: Array(33).fill(content.observations[0]) },
			{
				...content,
				capabilities: [{ ...content.capabilities[0], config: { x: { nested: true } } }]
			}
		])
			expect(() => parseMethodContent(value)).toThrow();
	});
	it('saves incomplete structure but refuses canonical validated output', async () => {
		const draft = parseMethodContent(emptyMethodContent());
		const result = await canonicalizeMethod(draft, catalog);
		expect(result.diagnostics.map((d) => d.path)).toEqual(['name', 'observations', 'capabilities']);
		expect(result.canonical).toBeNull();
		expect(result.fingerprint).toBeNull();
	});
	it('detects duplicate instance and context identities and locates diagnostics', async () => {
		const bad = {
			...content,
			observations: [...content.observations, ...content.observations],
			capabilities: [...content.capabilities, ...content.capabilities]
		};
		const result = await canonicalizeMethod(bad, catalog);
		expect(result.diagnostics.map((d) => d.path)).toContain('observations.1.id');
		expect(result.diagnostics.map((d) => d.path)).toContain('capabilities.1.id');
	});
	it('never shares mutable references with input, frozen versions, or copied drafts', async () => {
		const input = JSON.parse(JSON.stringify(content));
		const parsed = parseMethodContent(input);
		input.capabilities[0].config.threshold = 99;
		expect(parsed.capabilities[0]!.config.threshold).toBe(3);
		expect(() => Object.assign(parsed.capabilities[0]!.config, { threshold: 99 })).toThrow();
		const a = await version();
		const b = immutableCopy(a);
		expect(a).not.toBe(b);
		expect(a.content).not.toBe(b.content);
	});
	it('validates Method, draft, version and profile storage contracts', async () => {
		const v = await version();
		expect(() => parseVersion({ ...v, number: 0 })).toThrow();
		expect(() => parseVersion({ ...v, canonical: '{}' })).toThrow();
		expect(() =>
			parseVersion({
				...v,
				provenance: {
					kind: 'revision',
					sourceMethodId: 'other',
					sourceVersionId: 'v0',
					sourceFingerprint: v.fingerprint
				}
			})
		).toThrow();
		expect(() =>
			parseDraft({
				schema: 'trading.method-draft@1',
				methodId: 'm1',
				revision: 0,
				updatedAt: v.createdAt,
				content,
				provenance: originalProvenance()
			})
		).toThrow();
		expect(() => parseMethod({ schema: 'trading.method@99' })).toThrow();
		expect(() =>
			parseProfile({
				schema: 'trading.workspace-profile@1',
				workspaceId: 'w',
				revision: 0,
				methodVersionId: null,
				updatedAt: v.createdAt
			})
		).toThrow();
	});
	it('rejects malformed commands and missing concurrency or idempotency tokens', () => {
		for (const c of [
			null,
			{ op: 'delete' },
			{ op: 'freeze', methodId: 'm', expectedRevision: 1 },
			{ op: 'list', extra: true },
			{ op: 'assign', requestId: 'r', workspaceId: 'w', expectedRevision: -1, versionId: null }
		])
			expect(() => parseMethodCommand(c)).toThrow();
	});
	it('produces semantic comparison with additions/removals/configuration/scope/metadata', async () => {
		const a = await version();
		const b = await version({
			...content,
			name: 'Changed',
			observations: [{ ...content.observations[0]!, timeframe: '1h' }],
			capabilities: [
				{ ...content.capabilities[0]!, config: { threshold: 7 } },
				{ ...content.capabilities[0]!, id: 'new' }
			]
		});
		const changes = compareMethodVersions(a, b);
		expect(changes.map((c) => c.kind)).toEqual(['metadata', 'scope', 'configuration', 'added']);
		expect(compareMethodVersions(b, a).map((c) => c.kind)).toContain('removed');
	});
});
