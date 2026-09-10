/**
 * Adversarial tests for the Workspace Instance save channel (the client
 * side of persistence truth). Every failure shape the network can produce
 * — failed, delayed, hung, out-of-order, interrupted, retrying — must leave
 * the exposed `saveState` truthful: `saving` while a save is genuinely
 * pending, `saved` only for the newest state, `failed` when the retry
 * budget is exhausted, and recovery on the next change.
 *
 * Fetch is a controlled double; timers are fake, so debounce/backoff/
 * timeout behavior is deterministic and no real time passes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppServices } from '$lib/services.svelte';
import { defaultWorkspaceInstance } from '@trading-os/trading-domain';

type Deferred = {
	promise: Promise<Response>;
	resolve: (response: Response) => void;
	reject: (reason: unknown) => void;
};

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();
Object.defineProperty(globalThis, 'fetch', {
	value: fetchMock,
	writable: true,
	configurable: true
});

function okResponse(): Response {
	return {
		ok: true,
		status: 200,
		json: async () => ({ ok: true })
	} as unknown as Response;
}

function errorResponse(status = 500): Response {
	return {
		ok: false,
		status,
		json: async () => ({ ok: false, code: 'SAVE_FAILED', message: 'structured failure' })
	} as unknown as Response;
}

function deferred(): Deferred {
	let resolve!: (response: Response) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<Response>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** Sent request bodies, parsed (newest last). */
function sentPayloads(): { actionId: string; input: { state: Record<string, unknown> } }[] {
	return fetchMock.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

async function advance(ms: number): Promise<void> {
	await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
	vi.useFakeTimers();
	fetchMock.mockReset();
	fetchMock.mockImplementation(async () => okResponse());
});

afterEach(() => {
	vi.useRealTimers();
});

function createService() {
	return createAppServices(defaultWorkspaceInstance()).workspace;
}

describe('workspace save channel (truthful persistence states)', () => {
	it('reports saving immediately, saves once after the debounce window, then saved', async () => {
		const workspace = createService();
		expect(workspace.saveState).toBe('idle');
		workspace.setLayoutPreset('inspect');
		expect(workspace.saveState).toBe('saving');
		await advance(299);
		expect(fetchMock).not.toHaveBeenCalled();
		await advance(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const payload = sentPayloads()[0]!;
		expect(payload.actionId).toBe('act.saveWorkspace');
		expect(payload.input.state.layoutPreset).toBe('inspect');
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('coalesces rapid changes into a single save carrying the latest state', async () => {
		const workspace = createService();
		workspace.setTimeframe('15m');
		await advance(100);
		workspace.setInstrument('FXT-C');
		await advance(100);
		workspace.setLayoutPreset('chart-focus');
		await advance(1000);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const payload = sentPayloads()[0]!;
		expect(payload.input.state).toEqual({
			instrumentId: 'FXT-C',
			timeframeId: '15m',
			layoutPreset: 'chart-focus',
			watchlistVisible: true
		});
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('retries a failing save with backoff, then truthfully reports failed', async () => {
		fetchMock.mockImplementation(async () => {
			throw new TypeError('network down');
		});
		const workspace = createService();
		workspace.setWatchlistVisible(false);
		await advance(300); // attempt 1
		expect(workspace.saveState).toBe('saving');
		await advance(500); // attempt 2 (backoff ×1)
		await advance(1000); // attempt 3 (backoff ×2)
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(workspace.saveState).toBe('failed');
		// Exhausted: nothing further is scheduled — the channel waits for a
		// genuine change instead of silently hammering.
		await advance(10_000);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(workspace.saveState).toBe('failed');
	});

	it('treats a structured server rejection (non-2xx) as a failed attempt', async () => {
		let calls = 0;
		fetchMock.mockImplementation(async () => {
			calls += 1;
			return calls < 3 ? errorResponse(500) : okResponse();
		});
		const workspace = createService();
		workspace.setInstrument('FXT-D');
		await advance(300);
		await advance(500);
		await advance(1000);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(workspace.saveState).toBe('saved');
	});

	it('a change during the retry window rides the next attempt (latest state wins)', async () => {
		let calls = 0;
		fetchMock.mockImplementation(async () => {
			calls += 1;
			return calls === 1 ? errorResponse(500) : okResponse();
		});
		const workspace = createService();
		workspace.setTimeframe('4h');
		await advance(300); // attempt 1 fails
		expect(workspace.saveState).toBe('saving');
		workspace.setLayoutPreset('inspect'); // genuine change while retrying
		await advance(500); // retry fires (backoff ×1)
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const second = sentPayloads()[1]!;
		expect(second.input.state.timeframeId).toBe('4h');
		expect(second.input.state.layoutPreset).toBe('inspect');
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('delayed responses keep the channel truthfully in saving', async () => {
		const slow = deferred();
		fetchMock.mockImplementation(() => slow.promise);
		const workspace = createService();
		workspace.setInstrument('FXT-B');
		await advance(300);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(workspace.saveState).toBe('saving');
		slow.resolve(okResponse());
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('aborts a hung request (timeout) and retries', async () => {
		let aborted = 0;
		// First attempt hangs until its abort signal fires; later attempts succeed.
		fetchMock.mockImplementationOnce((_input, init) => {
			const signal = (init as RequestInit).signal as AbortSignal;
			return new Promise<Response>((_resolve, reject) => {
				signal.addEventListener('abort', () => {
					aborted += 1;
					reject(new DOMException('The operation was aborted.', 'AbortError'));
				});
			});
		});
		fetchMock.mockImplementation(async () => okResponse());
		const workspace = createService();
		workspace.setLayoutPreset('inspect');
		await advance(300); // attempt 1 goes out and hangs
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await advance(5_000); // request timeout aborts it
		expect(aborted).toBe(1);
		expect(workspace.saveState).toBe('saving'); // retry pending — not failed yet
		await advance(500); // retry fires and succeeds
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('an out-of-order stale failure cannot corrupt a newer saved state', async () => {
		const first = deferred();
		const second = deferred();
		const queue = [first, second];
		fetchMock.mockImplementation(
			() => queue.shift()?.promise ?? Promise.reject(new TypeError('network down'))
		);
		const workspace = createService();
		workspace.setTimeframe('15m');
		await advance(300); // request A (older) on the wire
		workspace.setLayoutPreset('inspect');
		await advance(300); // request B (newer) on the wire concurrently
		expect(fetchMock).toHaveBeenCalledTimes(2);
		second.resolve(okResponse()); // the NEWER save completes first
		await advance(0);
		expect(workspace.saveState).toBe('saved');
		first.reject(new TypeError('network down')); // the OLDER save fails late
		await advance(100);
		expect(workspace.saveState).toBe('saved');
	});

	it('an out-of-order stale success cannot mask a newer failure', async () => {
		const first = deferred();
		const second = deferred();
		const queue = [first, second];
		fetchMock.mockImplementation(
			() => queue.shift()?.promise ?? Promise.reject(new TypeError('network down'))
		);
		const workspace = createService();
		workspace.setTimeframe('1D');
		await advance(300); // request A
		workspace.setInstrument('FXT-E');
		await advance(300); // request B
		// B fails its whole retry budget.
		second.reject(new TypeError('network down'));
		await advance(500);
		await advance(1000);
		expect(workspace.saveState).toBe('failed');
		// A (older state) then succeeds late — it must NOT revive the channel.
		first.resolve(okResponse());
		await advance(100);
		expect(workspace.saveState).toBe('failed');
	});

	it('a success that raced a newer change does not report the newer change saved', async () => {
		const first = deferred();
		fetchMock.mockImplementation(() => first.promise);
		const workspace = createService();
		workspace.setTimeframe('15m');
		await advance(300); // request A (snapshot v1) on the wire
		workspace.setInstrument('FXT-F'); // newer change, not yet sent
		first.resolve(okResponse()); // A completes carrying only v1
		for (let i = 0; i < 10; i++) await Promise.resolve(); // drain microtasks, no timers
		// The channel must still be saving v2 — v2 was never persisted.
		expect(workspace.saveState).toBe('saving');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await advance(0); // the immediate follow-up save fires
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const second = sentPayloads()[1]!;
		expect(second.input.state.instrumentId).toBe('FXT-F');
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('flush persists immediately with keepalive inside the debounce window', async () => {
		const workspace = createService();
		workspace.setInstrument('FXT-C');
		await advance(100); // inside the 300 ms debounce window
		workspace.flush();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const init = fetchMock.mock.calls[0]![1] as RequestInit;
		expect(init.keepalive).toBe(true);
		const payload = sentPayloads()[0]!;
		expect(payload.input.state.instrumentId).toBe('FXT-C');
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('flush is a no-op when everything is already persisted', async () => {
		const workspace = createService();
		workspace.setInstrument('FXT-C');
		await advance(300);
		await advance(0);
		expect(workspace.saveState).toBe('saved');
		workspace.flush();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('flush after terminal failure attempts an immediate recovery save', async () => {
		fetchMock.mockImplementation(async () => {
			throw new TypeError('network down');
		});
		const workspace = createService();
		workspace.setInstrument('FXT-D');
		await advance(300 + 500 + 1000);
		expect(workspace.saveState).toBe('failed');
		fetchMock.mockImplementation(async () => okResponse());
		workspace.flush();
		expect(fetchMock).toHaveBeenCalledTimes(4);
		await advance(0);
		expect(workspace.saveState).toBe('saved');
	});

	it('a pending save survives losing the service reference (no loss on teardown)', async () => {
		let workspace: ReturnType<typeof createService> | null = createService();
		workspace.setLayoutPreset('inspect');
		workspace = null; // the shell dropped the reference mid-debounce
		await advance(300);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(sentPayloads()[0]!.input.state.layoutPreset).toBe('inspect');
	});

	it('a failed episode recovers on the next genuine change', async () => {
		let calls = 0;
		fetchMock.mockImplementation(async () => {
			calls += 1;
			return calls <= 3 ? errorResponse(500) : okResponse();
		});
		const workspace = createService();
		workspace.setTimeframe('5m');
		await advance(300 + 500 + 1000);
		expect(workspace.saveState).toBe('failed');
		workspace.setWatchlistVisible(false); // genuine change re-arms
		expect(workspace.saveState).toBe('saving');
		await advance(300);
		await advance(0);
		expect(workspace.saveState).toBe('saved');
		const last = sentPayloads().at(-1)!;
		expect(last.input.state.watchlistVisible).toBe(false);
	});
});
