/**
 * The trader-owned Workspace Instance model (T1): the persisted arrangement
 * of the market workspace. This is NOT a Method Version — T1 has no method
 * model; a workspace change never creates a unit of trading proof.
 *
 * The model is versioned by schema marker. Parsing fails safe: unknown or
 * future schemas are refused with a structured result, never defaulted
 * silently and never thrown.
 */

/** Canonical Workspace Instance schema marker. */
export const WORKSPACE_INSTANCE_SCHEMA = 'trading.workspace-instance@1';

/** Bounded layout presets supported by the T1 market workspace. */
export type WorkspaceLayoutPreset = 'chart-focus' | 'balanced' | 'inspect';

export const WORKSPACE_LAYOUT_PRESETS: readonly WorkspaceLayoutPreset[] = [
	'chart-focus',
	'balanced',
	'inspect'
];

/** The persisted state of the market workspace. */
export interface WorkspaceInstanceState {
	readonly instrumentId: string;
	readonly timeframeId: string;
	readonly layoutPreset: WorkspaceLayoutPreset;
	readonly watchlistVisible: boolean;
}

/** A trader-owned Workspace Instance with its schema marker. */
export interface WorkspaceInstance {
	/** Stable instance identity (T1 ships the single `'default'` instance). */
	readonly id: string;
	readonly schema: typeof WORKSPACE_INSTANCE_SCHEMA;
	readonly state: WorkspaceInstanceState;
	/** Last persisted instant, ISO 8601 UTC. */
	readonly updatedAt: string;
}

/** Structured parse outcome; never throws for any input. */
export type WorkspaceParseResult =
	| { readonly ok: true; readonly instance: WorkspaceInstance }
	| {
			readonly ok: false;
			readonly code:
				| 'WORKSPACE_NOT_OBJECT'
				| 'WORKSPACE_SCHEMA_UNSUPPORTED'
				| 'WORKSPACE_ID_INVALID'
				| 'WORKSPACE_UPDATED_AT_INVALID'
				| 'WORKSPACE_STATE_INVALID';
			readonly message: string;
	  };

/** The T1 default workspace state (deterministic; used on first run). */
export function defaultWorkspaceInstance(id: string = 'default'): WorkspaceInstance {
	return {
		id,
		schema: WORKSPACE_INSTANCE_SCHEMA,
		state: {
			instrumentId: 'FXT-A',
			timeframeId: '1h',
			layoutPreset: 'balanced',
			watchlistVisible: true
		},
		updatedAt: '1970-01-01T00:00:00.000Z'
	};
}

/** Serialize an instance into the persisted record shape. */
export function serializeWorkspaceInstance(instance: WorkspaceInstance): {
	id: string;
	schema: string;
	state: WorkspaceInstanceState;
	updatedAt: string;
} {
	return {
		id: instance.id,
		schema: instance.schema,
		state: { ...instance.state },
		updatedAt: instance.updatedAt
	};
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Parse a persisted workspace record. Total: any input yields a structured
 * result. Unknown/future schema markers are refused (fail safe) so a newer
 * application's data is never silently reinterpreted by an older one.
 */
export function parseWorkspaceInstance(row: unknown): WorkspaceParseResult {
	if (typeof row !== 'object' || row === null) {
		return {
			ok: false,
			code: 'WORKSPACE_NOT_OBJECT',
			message: 'Workspace record must be an object.'
		};
	}
	const r = row as Record<string, unknown>;
	if (r['schema'] !== WORKSPACE_INSTANCE_SCHEMA) {
		return {
			ok: false,
			code: 'WORKSPACE_SCHEMA_UNSUPPORTED',
			message: `Workspace schema '${String(r['schema'])}' is not supported by this build ('${WORKSPACE_INSTANCE_SCHEMA}').`
		};
	}
	if (!isNonEmptyString(r['id'])) {
		return {
			ok: false,
			code: 'WORKSPACE_ID_INVALID',
			message: 'Workspace id must be a non-empty string.'
		};
	}
	if (!isNonEmptyString(r['updatedAt']) || Number.isNaN(Date.parse(r['updatedAt']))) {
		return {
			ok: false,
			code: 'WORKSPACE_UPDATED_AT_INVALID',
			message: 'Workspace updatedAt must be an ISO 8601 timestamp.'
		};
	}
	const state = r['state'];
	if (typeof state !== 'object' || state === null) {
		return {
			ok: false,
			code: 'WORKSPACE_STATE_INVALID',
			message: 'Workspace state must be an object.'
		};
	}
	const s = state as Record<string, unknown>;
	if (!isNonEmptyString(s['instrumentId'])) {
		return {
			ok: false,
			code: 'WORKSPACE_STATE_INVALID',
			message: 'instrumentId must be a non-empty string.'
		};
	}
	if (!isNonEmptyString(s['timeframeId'])) {
		return {
			ok: false,
			code: 'WORKSPACE_STATE_INVALID',
			message: 'timeframeId must be a non-empty string.'
		};
	}
	if (
		typeof s['layoutPreset'] !== 'string' ||
		!WORKSPACE_LAYOUT_PRESETS.includes(s['layoutPreset'] as WorkspaceLayoutPreset)
	) {
		return {
			ok: false,
			code: 'WORKSPACE_STATE_INVALID',
			message: `layoutPreset must be one of: ${WORKSPACE_LAYOUT_PRESETS.join(', ')}.`
		};
	}
	if (typeof s['watchlistVisible'] !== 'boolean') {
		return {
			ok: false,
			code: 'WORKSPACE_STATE_INVALID',
			message: 'watchlistVisible must be a boolean.'
		};
	}
	return {
		ok: true,
		instance: {
			id: r['id'],
			schema: WORKSPACE_INSTANCE_SCHEMA,
			state: {
				instrumentId: s['instrumentId'],
				timeframeId: s['timeframeId'],
				layoutPreset: s['layoutPreset'] as WorkspaceLayoutPreset,
				watchlistVisible: s['watchlistVisible']
			},
			updatedAt: r['updatedAt']
		}
	};
}
