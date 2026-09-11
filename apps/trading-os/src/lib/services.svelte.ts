/**
 * Product services composition (author-owned).
 *
 * `createAppServices` is called ONCE per shell instance by the
 * `TradingShell` composition root and provided to the chrome and the
 * custom trading surfaces through Svelte context. All mutable service
 * state is owned per shell instance; the only module-level value is the
 * deterministic fixture market-data source (an immutable memoized series
 * cache — no mutable product state lives at module scope).
 */
import { browser } from '$app/environment';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import { createMethodClient } from './method-client';
import { createMethodWorkspace } from './method-workspace.svelte';
import { createEvaluationWorkspace } from './evaluation-workspace.svelte';
import { createEvaluationClient } from './evaluation-client';
import {
	defaultWorkspaceInstance,
	type Instrument,
	type Timeframe,
	type WorkspaceInstance,
	type WorkspaceInstanceState
} from '@trading-os/trading-domain';
import { createFixtureMarketData } from '@trading-os/trading-data';
import type {
	TradingServices,
	WorkspaceSaveState,
	WorkspaceService
} from '@trading-os/trading-surfaces';

/** Changes are coalesced into one save after this quiet window. */
const SAVE_DEBOUNCE_MS = 300;
/** Save attempts per episode before the channel truthfully reports failure. */
const SAVE_MAX_ATTEMPTS = 3;
/** Linear backoff between save retries (× attempt number). */
const SAVE_RETRY_BACKOFF_MS = 500;
/** A hung request is aborted and counted as a failed attempt. */
const SAVE_REQUEST_TIMEOUT_MS = 5_000;

/**
 * The workspace service: reactive product state over the persisted
 * Workspace Instance. Changes are debounced and persisted through the
 * declared `act.saveWorkspace` action (server-side SQLite) — never
 * localStorage.
 *
 * The persistence channel is TRUTHFUL and single-scheduled (at most one
 * pending save timer, at most the requests already on the wire):
 * - `saveState` exposes `saving` / `saved` / `failed` and is rendered by
 *   the shell's context strip — a failed save is never suppressed;
 * - every change bumps a state version; every request stamps the version
 *   it carries. A success only reports `saved` when no change is newer
 *   than the request's snapshot, and a stale (superseded) response —
 *   success OR failure — can never corrupt the channel state of a newer
 *   save;
 * - a failed request is retried with a bounded linear backoff (fresh
 *   snapshots: a change made during a delay or retry rides the next
 *   attempt); when the attempt budget is exhausted the channel reports
 *   `failed`, and the next genuine change re-arms it;
 * - a hung request is aborted (timeout) and counted as a failed attempt,
 *   so `saving` can never be pinned forever by a silent server;
 * - `flush()` persists immediately with `keepalive` (used on page hide),
 *   closing the reload-inside-the-debounce-window loss gap;
 * - an unmounted shell does NOT cancel a pending save: the timer's
 *   closure still fires, so navigation during the debounce window cannot
 *   lose the change.
 */
function createWorkspaceService(initial: WorkspaceInstance): WorkspaceService {
	let state = $state<WorkspaceInstanceState>({ ...initial.state });
	let saveState = $state<WorkspaceSaveState>('idle');

	// Persistence-channel bookkeeping. Plain closure variables: only
	// `saveState` is rendered directly; the rest is sequencing truth.
	let sendTimer: ReturnType<typeof setTimeout> | undefined;
	let attemptsUsed = 0;
	/** Version of the in-memory state; bumped by every genuine change. */
	let stateVersion = 0;
	/** Version known to be persisted (equal ⇒ nothing un-persisted). */
	let persistedVersion = 0;
	/** Monotonic request sequence: the newest issued request owns the channel. */
	let issued = 0;

	function clearSendTimer(): void {
		if (sendTimer !== undefined) {
			clearTimeout(sendTimer);
			sendTimer = undefined;
		}
	}

	/** The ONLY place a save gets scheduled — one timer, ever. */
	function scheduleSend(delayMs: number, keepalive = false): void {
		clearSendTimer();
		sendTimer = setTimeout(() => {
			sendTimer = undefined;
			void attemptSave(keepalive);
		}, delayMs);
	}

	/** A genuine change: coalesce, then persist (truthfully 'saving'). */
	function requestSave(): void {
		if (!browser) {
			return;
		}
		stateVersion += 1;
		attemptsUsed = 0; // a fresh change starts a fresh attempt budget
		saveState = 'saving';
		scheduleSend(SAVE_DEBOUNCE_MS);
	}

	/** Send exactly one save request carrying the current state. */
	async function attemptSave(keepalive = false): Promise<void> {
		if (!browser) {
			return;
		}
		clearSendTimer();
		const seq = ++issued;
		const sentVersion = stateVersion;
		saveState = 'saving';
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), SAVE_REQUEST_TIMEOUT_MS);
		let ok = false;
		try {
			const response = await fetch('/api/act', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				keepalive,
				signal: controller.signal,
				body: JSON.stringify({
					actionId: 'act.saveWorkspace',
					input: {
						id: initial.id,
						schema: initial.schema,
						state: { ...state },
						updatedAt: new Date().toISOString()
					}
				})
			});
			const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
			ok = response.ok && result?.ok === true;
		} catch {
			// Network failure, timeout abort, or unreadable response: a
			// failed attempt — retried below, never silently forgotten.
			ok = false;
		} finally {
			clearTimeout(timeout);
		}
		if (seq !== issued) {
			// A newer request exists; it owns the channel state. This stale
			// response — success or failure — must not corrupt it.
			return;
		}
		if (ok && sentVersion === stateVersion) {
			persistedVersion = sentVersion;
			saveState = 'saved';
			return;
		}
		if (ok) {
			// Persisted, but a newer change is already waiting: keep going.
			scheduleSend(0);
			return;
		}
		attemptsUsed += 1;
		if (attemptsUsed < SAVE_MAX_ATTEMPTS) {
			// Still trying: the channel stays truthfully 'saving', and the
			// retry snapshots the state again (it may have changed).
			scheduleSend(SAVE_RETRY_BACKOFF_MS * attemptsUsed);
			return;
		}
		// Attempt budget exhausted: report the failure. In-memory state
		// stays authoritative for the session; the next genuine change
		// re-arms the channel.
		saveState = 'failed';
	}

	return {
		get state() {
			return state;
		},
		get instruments(): readonly Instrument[] {
			return marketData.instruments;
		},
		get timeframes(): readonly Timeframe[] {
			return marketData.timeframes;
		},
		get saveState(): WorkspaceSaveState {
			return saveState;
		},
		setInstrument(instrumentId: string): void {
			state = { ...state, instrumentId };
			requestSave();
		},
		setTimeframe(timeframeId: string): void {
			state = { ...state, timeframeId };
			requestSave();
		},
		setLayoutPreset(preset: WorkspaceInstanceState['layoutPreset']): void {
			state = { ...state, layoutPreset: preset };
			requestSave();
		},
		setWatchlistVisible(watchlistVisible: boolean): void {
			state = { ...state, watchlistVisible };
			requestSave();
		},
		/** Persist immediately (page hide / explicit), bypassing debounce. */
		flush(): void {
			if (!browser) {
				return;
			}
			if (persistedVersion === stateVersion) {
				return; // nothing un-persisted (a pending timer, if any, carries it)
			}
			void attemptSave(true);
		}
	};
}

const marketData = createFixtureMarketData();

/**
 * Compose the T1 services bundle around the persisted workspace instance.
 * Background operations are real: T1 starts no durable runs, so the list
 * is truthfully empty — the shell renders that truth, never a fake job.
 */
export function createAppServices(initialWorkspace: WorkspaceInstance | null): TradingServices {
	const workspace = createWorkspaceService(initialWorkspace ?? defaultWorkspaceInstance());
	const evaluation = createEvaluationWorkspace(createEvaluationClient());
	return {
		evaluation,
		marketData,
		methods: createMethodWorkspace(
			createMethodClient(),
			createAuthoringCatalog(),
			initialWorkspace?.id ?? 'default'
		),
		workspace,
		backgroundOperations: {
			get operations() {
				return [
					...(evaluation.installing
						? [
								{
									id: 'fixture-install',
									label: 'Installing deterministic fixture',
									state: 'running' as const
								}
							]
						: []),
					...evaluation.activeRuns.map((run) => ({
						id: run.id,
						label: `${run.methodName} v${run.versionNumber} evaluation`,
						state: 'running' as const
					}))
				];
			}
		}
	};
}
