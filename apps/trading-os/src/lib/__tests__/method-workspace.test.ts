import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import { createMethodWorkspace } from '../method-workspace.svelte';
import { createMethodClient } from '../method-client';
import {
	METHOD_ERROR_MESSAGES,
	emptyMethodContent,
	originalProvenance,
	type MethodClient,
	type MethodCommand,
	type MethodDetail,
	type MethodResult
} from '@trading-os/trading-domain';
const initial: MethodDetail = {
	method: {
		schema: 'trading.method@1',
		id: 'method',
		name: 'Study',
		description: '',
		createdAt: '2026-09-10T00:00:00.000Z',
		updatedAt: '2026-09-10T00:00:00.000Z',
		versionCount: 0,
		draftRevision: 1,
		hasDraft: true,
		origin: originalProvenance()
	},
	draft: {
		schema: 'trading.method-draft@1',
		methodId: 'method',
		revision: 1,
		updatedAt: '2026-09-10T00:00:00.000Z',
		content: emptyMethodContent('Study'),
		provenance: originalProvenance()
	},
	versions: []
};
const ok = (detail = initial): MethodResult => ({ ok: true, value: { kind: 'detail', detail } });
const failed: MethodResult = {
	ok: false,
	code: 'PERSISTENCE_FAILED',
	message: METHOD_ERROR_MESSAGES.PERSISTENCE_FAILED,
	diagnostics: []
};
const catalog = createAuthoringCatalog();
const client = (handler: (c: MethodCommand) => Promise<MethodResult>): MethodClient => ({
	execute: vi.fn(handler)
});
afterEach(() => vi.useRealTimers());
describe('truthful Method authoring controller', () => {
	it('serializes reads against mutations and other reads so late content cannot replace newer work', async () => {
		let release!: (result: MethodResult) => void;
		const api = client(
			async () =>
				new Promise((r) => {
					release = r;
				})
		);
		const ws = createMethodWorkspace(api, catalog, 'default');
		const opening = ws.open('method');
		await ws.open('other');
		expect(await ws.create('Blocked')).toBe(false);
		expect(api.execute).toHaveBeenCalledTimes(1);
		release(ok());
		await opening;
		expect(ws.detail?.method.id).toBe('method');
	});
	it('renders loading, confirmed, dirty, saving and saved only after acknowledgment', async () => {
		let ack!: (r: MethodResult) => void;
		const api = client(async (c) =>
			c.op === 'get'
				? ok()
				: new Promise((r) => {
						ack = r;
					})
		);
		const ws = createMethodWorkspace(api, catalog, 'default');
		await ws.open('method');
		expect(ws.state).toBe('ready');
		ws.change({ ...ws.content!, name: 'Changed' });
		expect(ws.state).toBe('dirty');
		const saving = ws.save();
		expect(ws.state).toBe('saving');
		expect(ws.detail!.draft!.revision).toBe(1);
		ack(
			ok({
				...initial,
				method: { ...initial.method, name: 'Changed', draftRevision: 2 },
				draft: { ...initial.draft!, revision: 2, content: emptyMethodContent('Changed') }
			})
		);
		expect(await saving).toBe(true);
		expect(ws.state).toBe('saved');
		expect(ws.dirty).toBe(false);
		expect(ws.detail!.draft!.revision).toBe(2);
	});
	it('retains failed work and retries the exact command identity without overwriting later edits', async () => {
		let fail = true;
		const sent: MethodCommand[] = [];
		const ws = createMethodWorkspace(
			client(async (c) => {
				sent.push(c);
				return c.op === 'get' ? ok() : fail ? failed : ok();
			}),
			catalog,
			'default'
		);
		await ws.open('method');
		ws.change({ ...ws.content!, description: 'Recovery text' });
		expect(await ws.save()).toBe(false);
		expect(ws.state).toBe('failed');
		expect(ws.recovery?.description).toBe('Recovery text');
		ws.change({ ...ws.content!, description: 'This edit must be refused until reconciliation' });
		expect(ws.content?.description).toBe('Recovery text');
		fail = false;
		expect(await ws.retry()).toBe(true);
		expect(sent[1]).toEqual(sent[2]);
	});
	it('refuses overwrite after conflict and preserves recovery across reload', async () => {
		const conflict = {
			...failed,
			code: 'CONFLICT' as const,
			message: METHOD_ERROR_MESSAGES.CONFLICT
		};
		const ws = createMethodWorkspace(
			client(async (c) =>
				c.op === 'get'
					? ok()
					: c.op === 'list'
						? { ok: true, value: { kind: 'library', methods: [initial.method] } }
						: c.op === 'profile'
							? { ok: true, value: { kind: 'profile', profile: null } }
							: conflict
			),
			catalog,
			'default'
		);
		await ws.open('method');
		ws.change({ ...ws.content!, description: 'Keep me' });
		await ws.save();
		expect(ws.state).toBe('conflict');
		expect(await ws.save()).toBe(false);
		await ws.reload();
		expect(ws.content!.description).toBe('');
		expect(ws.recovery!.description).toBe('Keep me');
		ws.restoreRecovery();
		expect(ws.dirty).toBe(true);
		expect(ws.content!.description).toBe('Keep me');
	});
	it('does not open another Method while an unsaved draft exists', async () => {
		const ws = createMethodWorkspace(
			client(async () => ok()),
			catalog,
			'default'
		);
		await ws.open('method');
		ws.change({ ...ws.content!, name: 'Unsaved' });
		await ws.open('other');
		expect(ws.detail!.method.id).toBe('method');
		expect(ws.content!.name).toBe('Unsaved');
		expect(ws.message).toContain('Save or reconcile');
	});
	it('blocks invalid freezing and locates diagnostics without starting any run', async () => {
		const api = client(async () => ok());
		const ws = createMethodWorkspace(api, catalog, 'default');
		await ws.open('method');
		expect(await ws.validate()).toBe(false);
		expect(ws.diagnostics.map((d) => d.path)).toEqual(['observations', 'capabilities']);
		expect(await ws.freeze()).toBe(false);
		expect(api.execute).toHaveBeenCalledTimes(1);
	});
	it('clears unavailable records instead of presenting earlier content as current', async () => {
		let error = false;
		const ws = createMethodWorkspace(
			client(async () => (error ? failed : ok())),
			catalog,
			'default'
		);
		await ws.open('method');
		error = true;
		await ws.open('missing');
		expect(ws.state).toBe('failed');
		expect(ws.detail).toBeNull();
		expect(ws.content).toBeNull();
	});
	it('keeps profile failure separate from a successfully loaded library', async () => {
		const ws = createMethodWorkspace(
			client(async (c) =>
				c.op === 'profile' ? failed : { ok: true, value: { kind: 'library', methods: [] } }
			),
			catalog,
			'default'
		);
		await ws.load();
		expect(ws.state).toBe('ready');
		expect(ws.profileState).toBe('failed');
		expect(await ws.assign(null)).toBe(false);
	});
});
describe('Method HTTP response boundary', () => {
	it('rejects a well-formed success of the wrong operation kind', async () => {
		const api = createMethodClient(
			vi.fn(
				async () =>
					new Response(JSON.stringify({ ok: true, value: { kind: 'library', methods: [] } }))
			) as typeof fetch
		);
		expect(await api.execute({ op: 'create', requestId: 'request', name: 'Study' })).toMatchObject({
			ok: false,
			code: 'PERSISTENCE_FAILED'
		});
	});
	it('rejects malformed successes, unknown schema replies and leaked server errors', async () => {
		for (const value of [
			{ ok: true, value: {} },
			{
				ok: true,
				value: {
					kind: 'detail',
					detail: { ...initial, method: { ...initial.method, schema: 'future' } }
				}
			},
			{ ok: false, code: 'SQLITE_FAILURE', message: 'C:/private/secret.sqlite' }
		]) {
			const api = createMethodClient(
				vi.fn(async () => new Response(JSON.stringify(value))) as typeof fetch
			);
			const result = await api.execute({ op: 'list' });
			expect(result.ok).toBe(false);
			expect(JSON.stringify(result)).not.toContain('private');
		}
	});
	it('times out hung requests and reports unconfirmed persistence', async () => {
		vi.useFakeTimers();
		const send = vi.fn(
			(_url, init) =>
				new Promise<Response>((_resolve, reject) =>
					init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
				)
		) as typeof fetch;
		const pending = createMethodClient(send).execute({ op: 'list' });
		await vi.advanceTimersByTimeAsync(5000);
		expect(await pending).toMatchObject({ ok: false, code: 'PERSISTENCE_FAILED' });
	});
});
