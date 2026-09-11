import { describe, expect, it } from 'vitest';
import {
	canonicalizeMethod,
	validateMethod,
	type CapabilityDefinition
} from '@trading-os/trading-domain';
import {
	AUTHORING_DEFINITIONS,
	createAuthoringCatalog,
	createCapabilityCatalog
} from '../src/index.ts';
import { breakoutFixture, reversionFixture } from './fixtures.ts';
describe('versioned definition-only capability catalog', () => {
	const catalog = createAuthoringCatalog();
	it('resolves exact IDs and revisions only', () => {
		expect(catalog.resolve('analysis.range', '1')?.label).toBe('Range reference');
		expect(catalog.resolve('analysis.range', '2')).toBeUndefined();
		expect(catalog.resolve('unknown', '1')).toBeUndefined();
	});
	it('exposes real generic metadata and no evaluation hooks', () => {
		for (const d of catalog.definitions) {
			expect(d.availability).toBe('definition-only');
			expect(d.fields.length).toBeGreaterThan(0);
			expect(Object.keys(d)).not.toContain('evaluate');
			expect(Object.values(d).some((v) => typeof v === 'function')).toBe(false);
			for (const f of d.fields) {
				expect(f.label).toBeTruthy();
				expect(f.description).toBeTruthy();
			}
		}
	});
	it('composes materially different fixtures from the same catalog', async () => {
		const a = await canonicalizeMethod(breakoutFixture, catalog);
		const b = await canonicalizeMethod(reversionFixture, catalog);
		expect(a.diagnostics).toEqual([]);
		expect(b.diagnostics).toEqual([]);
		expect(a.fingerprint).not.toBe(b.fingerprint);
		expect(a.content.observations).toHaveLength(2);
		expect(b.content.observations).toHaveLength(1);
		expect(b.content.capabilities).toHaveLength(2);
	});
	it('retains unsupported revisions safely, blocking freezing', async () => {
		const unsupported = {
			...reversionFixture,
			capabilities: reversionFixture.capabilities.map((c) => ({ ...c, revision: '99' }))
		};
		const result = await canonicalizeMethod(unsupported, catalog);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'UNSUPPORTED_CAPABILITY',
			path: 'capabilities.0'
		});
		expect(result.canonical).toBeNull();
	});
	it('validates configuration numbers, enums, unknown fields and exact field locations', () => {
		const bad = {
			...reversionFixture,
			capabilities: [
				{
					...reversionFixture.capabilities[0]!,
					config: { context: 'daily', lookback: 1.5, price: 'last', extra: true }
				},
				reversionFixture.capabilities[1]!
			]
		};
		expect(validateMethod(bad, catalog).map((d) => d.path)).toEqual([
			'capabilities.0.config.extra',
			'capabilities.0.config.lookback',
			'capabilities.0.config.price'
		]);
	});
	it('rejects dangling, incompatible and forward analysis references', () => {
		const bad = { ...breakoutFixture, capabilities: [...breakoutFixture.capabilities].reverse() };
		expect(validateMethod(bad, catalog).some((d) => d.code === 'INVALID_REFERENCE')).toBe(true);
		const badContext = { ...reversionFixture, observations: [] };
		expect(
			validateMethod(badContext, catalog).filter((d) => d.code === 'INVALID_REFERENCE')
		).toHaveLength(2);
	});
	it('registers a compatible extension without changing the screen or base catalog', async () => {
		const extra: CapabilityDefinition = {
			...AUTHORING_DEFINITIONS[0]!,
			id: 'extension.range',
			revision: '2',
			label: 'Extended range'
		};
		const extended = createCapabilityCatalog([...AUTHORING_DEFINITIONS, extra]);
		expect(catalog.resolve(extra.id, '2')).toBeUndefined();
		const fixture = {
			...breakoutFixture,
			capabilities: breakoutFixture.capabilities.map((c, i) =>
				i === 0 ? { ...c, capabilityId: extra.id, revision: '2' } : c
			)
		};
		expect((await canonicalizeMethod(fixture, extended)).diagnostics).toEqual([]);
	});
	it('registration is atomic, immutable, and rejects duplicate or invalid definitions', () => {
		expect(() =>
			createCapabilityCatalog([...AUTHORING_DEFINITIONS, AUTHORING_DEFINITIONS[0]!])
		).toThrow();
		expect(() => createCapabilityCatalog([{ ...AUTHORING_DEFINITIONS[0]!, label: '' }])).toThrow();
		expect(() => Object.assign(catalog.definitions[0]!, { revision: '3' })).toThrow();
		expect(catalog.resolve('analysis.range', '1')).toBeTruthy();
	});
	it('is deterministic across fresh catalogs and repeated configuration authoring', async () => {
		expect((await canonicalizeMethod(breakoutFixture, createAuthoringCatalog())).fingerprint).toBe(
			(await canonicalizeMethod(breakoutFixture, createAuthoringCatalog())).fingerprint
		);
	});
});
