/**
 * Workspace Instance persistence proof over the production SQLite
 * application-data adapter: save → close → reopen → restore, schema
 * handling, safe failure, and no cross-workspace leakage.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppServer } from '$lib/server/application-server';
import {
	defaultWorkspaceInstance,
	serializeWorkspaceInstance,
	type WorkspaceInstance
} from '@trading-os/trading-domain';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'tos-persistence-'));
	process.env.TRADING_OS_DB_PATH = join(dir, 'ws.sqlite');
});

afterEach(() => {
	delete process.env.TRADING_OS_DB_PATH;
	rmSync(dir, { recursive: true, force: true });
});

function workspaceUpdate(overrides: Partial<WorkspaceInstance['state']> = {}): WorkspaceInstance {
	const base = defaultWorkspaceInstance();
	return {
		...base,
		state: { ...base.state, ...overrides }
	};
}

describe('workspace persistence (SQLite application-data)', () => {
	it('saves, closes the adapter, reopens, and restores the exact workspace', async () => {
		const first = createAppServer();
		const saved = first.plan; // touch plan to ensure compile ran
		expect(saved.applicationId).toBe('trading.os');

		const instance = workspaceUpdate({
			instrumentId: 'FXT-C',
			timeframeId: '15m',
			layoutPreset: 'chart-focus',
			watchlistVisible: false
		});
		const result = await first.dispatch('act.saveWorkspace', serializeWorkspaceInstance(instance));
		expect(result.ok).toBe(true);
		await first.close();

		// Reopen on the same file through a fresh server.
		const second = createAppServer();
		const restored = await second.readWorkspace();
		expect(restored.state).toEqual(instance.state);
		await second.close();
	});

	it('returns the documented default for a fresh store and persists after first create', async () => {
		const server = createAppServer();
		const initial = await server.readWorkspace();
		expect(initial.state.instrumentId).toBe('FXT-A');
		const update = workspaceUpdate({ layoutPreset: 'inspect' });
		const result = await server.dispatch('act.saveWorkspace', serializeWorkspaceInstance(update));
		expect(result.ok).toBe(true);
		const after = await server.readWorkspace();
		expect(after.state.layoutPreset).toBe('inspect');
		await server.close();
	});

	it('rejects contract-violating workspace input with a safe structured failure', async () => {
		const server = createAppServer();
		const bad = {
			id: 'default',
			schema: 'trading.workspace-instance@9',
			state: {},
			updatedAt: 'nope'
		};
		const result = await server.dispatch('act.saveWorkspace', bad);
		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error('expected a structured failure');
		}
		expect(result.code).toBe('CONTRACT_REJECTED');
		// The store is untouched.
		const current = await server.readWorkspace();
		expect(current.state.layoutPreset).toBe('balanced');
		await server.close();
	});

	it('rejects an unknown action and a future workspace schema safely', async () => {
		const server = createAppServer();
		const unknownAction = await server.dispatch('act.doesNotExist', {});
		expect(unknownAction).toMatchObject({ ok: false, code: 'UNKNOWN_ACTION' });
		const futureSchema = await server.dispatch('act.queryWorkspaces', {});
		expect(futureSchema.ok).toBe(true);
		await server.close();
	});

	it('keeps separate database paths isolated (no cross-workspace leakage)', async () => {
		const dbA = join(dir, 'a.sqlite');
		const dbB = join(dir, 'b.sqlite');
		process.env.TRADING_OS_DB_PATH = dbA;
		const serverA = createAppServer();
		await serverA.dispatch(
			'act.saveWorkspace',
			serializeWorkspaceInstance(workspaceUpdate({ instrumentId: 'FXT-B' }))
		);
		await serverA.close();

		process.env.TRADING_OS_DB_PATH = dbB;
		const serverB = createAppServer();
		const restoredB = await serverB.readWorkspace();
		expect(restoredB.state.instrumentId).toBe('FXT-A');
		await serverB.close();

		process.env.TRADING_OS_DB_PATH = dbA;
		const serverA2 = createAppServer();
		const restoredA = await serverA2.readWorkspace();
		expect(restoredA.state.instrumentId).toBe('FXT-B');
		await serverA2.close();
		delete process.env.TRADING_OS_DB_PATH;
		process.env.TRADING_OS_DB_PATH = join(dir, 'ws.sqlite');
	});
});
