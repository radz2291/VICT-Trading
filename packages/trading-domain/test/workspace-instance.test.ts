import { describe, expect, it } from 'vitest';
import {
	WORKSPACE_INSTANCE_SCHEMA,
	defaultWorkspaceInstance,
	parseWorkspaceInstance,
	serializeWorkspaceInstance
} from '../src/workspace-instance.ts';

describe('Workspace Instance', () => {
	it('round-trips through serialize → parse', () => {
		const instance = defaultWorkspaceInstance();
		const parsed = parseWorkspaceInstance(serializeWorkspaceInstance(instance));
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.instance).toEqual(instance);
		}
	});

	it('parses a valid hand-written record', () => {
		const parsed = parseWorkspaceInstance({
			id: 'default',
			schema: WORKSPACE_INSTANCE_SCHEMA,
			state: {
				instrumentId: 'FXT-B',
				timeframeId: '15m',
				layoutPreset: 'chart-focus',
				watchlistVisible: false
			},
			updatedAt: '2026-09-10T00:00:00.000Z'
		});
		expect(parsed.ok).toBe(true);
	});

	it('fails safe on a FUTURE schema marker', () => {
		const parsed = parseWorkspaceInstance({
			id: 'default',
			schema: 'trading.workspace-instance@2',
			state: {
				instrumentId: 'FXT-A',
				timeframeId: '1h',
				layoutPreset: 'balanced',
				watchlistVisible: true
			},
			updatedAt: '2026-09-10T00:00:00.000Z'
		});
		expect(parsed).toMatchObject({ ok: false, code: 'WORKSPACE_SCHEMA_UNSUPPORTED' });
	});

	it('fails safe on an unknown schema marker', () => {
		expect(
			parseWorkspaceInstance({
				id: 'd',
				schema: 'nope',
				state: {},
				updatedAt: '2026-01-01T00:00:00Z'
			})
		).toMatchObject({ ok: false, code: 'WORKSPACE_SCHEMA_UNSUPPORTED' });
	});

	it('rejects an unknown layout preset', () => {
		const parsed = parseWorkspaceInstance({
			id: 'default',
			schema: WORKSPACE_INSTANCE_SCHEMA,
			state: {
				instrumentId: 'FXT-A',
				timeframeId: '1h',
				layoutPreset: 'ultra-wide',
				watchlistVisible: true
			},
			updatedAt: '2026-09-10T00:00:00.000Z'
		});
		expect(parsed).toMatchObject({ ok: false, code: 'WORKSPACE_STATE_INVALID' });
	});

	it('rejects invalid updatedAt and missing state without throwing', () => {
		expect(
			parseWorkspaceInstance({
				id: 'default',
				schema: WORKSPACE_INSTANCE_SCHEMA,
				state: {},
				updatedAt: 'not-a-time'
			})
		).toMatchObject({ ok: false, code: 'WORKSPACE_UPDATED_AT_INVALID' });
		expect(parseWorkspaceInstance(null)).toMatchObject({ ok: false, code: 'WORKSPACE_NOT_OBJECT' });
		expect(parseWorkspaceInstance(7)).toMatchObject({ ok: false, code: 'WORKSPACE_NOT_OBJECT' });
	});

	it('never produces a Method Version — no method concept exists at T1', () => {
		const instance = defaultWorkspaceInstance();
		const keys = Object.keys(instance);
		expect(keys).toEqual(['id', 'schema', 'state', 'updatedAt']);
	});
});
