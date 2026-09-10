/**
 * Product services composition (author-owned).
 *
 * `createAppServices` is called ONCE per shell instance by the
 * `TradingShell` composition root and provided to the chrome and the
 * custom trading surfaces through Svelte context. There is deliberately
 * NO module-level mutable singleton: every shell instance owns its
 * services, and the server render owns a separate instance.
 */
import { browser } from '$app/environment';
import {
	defaultWorkspaceInstance,
	type Instrument,
	type Timeframe,
	type WorkspaceInstance,
	type WorkspaceInstanceState
} from '@trading-os/trading-domain';
import { createFixtureMarketData } from '@trading-os/trading-data';
import type { TradingServices, WorkspaceService } from '@trading-os/trading-surfaces';

const SAVE_DEBOUNCE_MS = 300;

/**
 * The workspace service: reactive product state over the persisted
 * Workspace Instance. Changes are debounced and persisted through the
 * declared `act.saveWorkspace` action (server-side SQLite) — never
 * localStorage.
 */
function createWorkspaceService(initial: WorkspaceInstance): WorkspaceService {
	let state = $state<WorkspaceInstanceState>({ ...initial.state });
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	function persist(next: WorkspaceInstanceState): void {
		state = next;
		if (!browser) {
			return;
		}
		if (saveTimer !== undefined) {
			clearTimeout(saveTimer);
		}
		saveTimer = setTimeout(() => {
			void fetch('/api/act', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					actionId: 'act.saveWorkspace',
					input: {
						id: initial.id,
						schema: initial.schema,
						state: { ...state },
						updatedAt: new Date().toISOString()
					}
				})
			}).catch(() => {
				// A failed save is retried on the next change; the workspace in
				// memory stays authoritative for the session. Reload restores the
				// last successfully persisted instance.
			});
		}, SAVE_DEBOUNCE_MS);
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
		setInstrument(instrumentId: string): void {
			persist({ ...state, instrumentId });
		},
		setTimeframe(timeframeId: string): void {
			persist({ ...state, timeframeId });
		},
		setLayoutPreset(preset: WorkspaceInstanceState['layoutPreset']): void {
			persist({ ...state, layoutPreset: preset });
		},
		setWatchlistVisible(watchlistVisible: boolean): void {
			persist({ ...state, watchlistVisible });
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
	return {
		marketData,
		workspace,
		backgroundOperations: {
			operations: []
		}
	};
}
