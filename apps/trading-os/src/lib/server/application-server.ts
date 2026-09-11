/**
 * THE server-side application server — author-owned composition root for
 * everything below the UI. The SQLite application-data adapter, resource
 * contracts, and below-UI authorization are bound HERE and only here;
 * browser code never touches Node-only modules.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
	createSqliteApplicationData,
	migrationsFromResources
} from '@victframework/appdata-sqlite';
import {
	createSqliteMethodRepository,
	METHOD_MIGRATIONS
} from '@trading-os/trading-data/method-store';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import { createMethodService, parseMethodCommand } from '@trading-os/trading-domain';
import { METHOD_ACTION_OPS } from '$lib/application/method-actions';
import type { ApplicationDataAdapter, ActionResult } from '@victframework/application';
import {
	compileAppPlan,
	workspaceResource,
	workspaceRecordContract
} from '$lib/application/definition';
import {
	defaultWorkspaceInstance,
	parseWorkspaceInstance,
	serializeWorkspaceInstance,
	type WorkspaceInstance
} from '@trading-os/trading-domain';

const DEFAULT_DB_PATH = join('.data', 'trading-os.sqlite');

/** The authorization profile of this deployment (server-side only). */
const GRANTS = ['workspace.read', 'workspace.write', 'method.read', 'method.write'];

/** The single trader-owned Workspace Instance identity for T1. */
export const DEFAULT_WORKSPACE_ID = 'default';

export type AppServer = ReturnType<typeof createAppServer>;

export function createAppServer() {
	const plan = compileAppPlan();
	const dbPath = process.env.TRADING_OS_DB_PATH ?? DEFAULT_DB_PATH;
	// Ensure the database directory exists (the adapter never creates parents).
	mkdirSync(join(dbPath, '..'), { recursive: true });
	const migrations = [migrationsFromResources([workspaceResource], 1), ...METHOD_MIGRATIONS];
	const data: ApplicationDataAdapter = createSqliteApplicationData({
		path: dbPath,
		resources: [workspaceResource],
		contracts: [workspaceRecordContract],
		migrations
	});
	const methods = createSqliteMethodRepository(dbPath, migrations);
	const methodService = createMethodService(methods, createAuthoringCatalog());

	async function readWorkspaceRecord(): Promise<
		| { readonly ok: true; readonly instance: WorkspaceInstance }
		| { readonly ok: false; readonly code: 'EMPTY' | 'UNPARSABLE' }
	> {
		const result = await data.query(
			{
				op: 'list',
				resourceId: 'workspace_instances',
				filters: { id: DEFAULT_WORKSPACE_ID },
				limit: 1
			},
			{ permissions: GRANTS, effect: 'read' }
		);
		if (!result.ok) {
			return { ok: false, code: 'EMPTY' };
		}
		const row = result.rows?.[0];
		if (row === undefined) {
			return { ok: false, code: 'EMPTY' };
		}
		const parsed = parseWorkspaceInstance(row);
		if (!parsed.ok) {
			// Fail safe: an unreadable persisted record is never reinterpreted,
			// partially applied, or crashed on.
			return { ok: false, code: 'UNPARSABLE' };
		}
		return { ok: true, instance: parsed.instance };
	}

	async function readWorkspace(): Promise<WorkspaceInstance> {
		const record = await readWorkspaceRecord();
		// Reads fail safe to the documented default: no stored record, or a
		// record this build cannot parse (e.g. a future schema), never yields
		// a crash or a silently reinterpreted state.
		return record.ok ? record.instance : defaultWorkspaceInstance(DEFAULT_WORKSPACE_ID);
	}

	async function saveWorkspace(next: WorkspaceInstance): Promise<ActionResult> {
		// The record's own updatedAt (client-issued at send time, regenerated
		// on every attempt) is the write-ordering token. It is preserved —
		// never re-stamped — so a late/retried write carrying an older state
		// can be detected and refused instead of silently reverting newer
		// persisted state.
		const record = serializeWorkspaceInstance(next);
		const current = await readWorkspaceRecord();
		if (!current.ok && current.code === 'UNPARSABLE') {
			// The store holds a record this build cannot parse (e.g. a future
			// schema). Overwriting it is a data-destroying downgrade: refuse
			// with a structured failure instead.
			return {
				ok: false,
				code: 'SCHEMA_CONFLICT',
				message: 'The stored workspace record cannot be read by this build; it was not overwritten.'
			};
		}
		if (current.ok && Date.parse(current.instance.updatedAt) > Date.parse(record.updatedAt)) {
			return {
				ok: false,
				code: 'STALE_WRITE',
				message: 'A newer workspace state is already persisted; the older write was refused.'
			};
		}
		const update = await data.mutate(
			{
				resourceId: 'workspace_instances',
				op: 'update',
				input: record,
				id: record.id
			},
			{ permissions: GRANTS, effect: 'write' }
		);
		if (update.ok) {
			return { ok: true, value: record };
		}
		if (update.code !== 'DATA_UNKNOWN_IDENTITY') {
			return { ok: false, code: update.code, message: update.message };
		}
		// First save: create the keyed row.
		const create = await data.mutate(
			{
				resourceId: 'workspace_instances',
				op: 'create',
				input: record,
				idempotencyKey: `workspace:${record.id}`
			},
			{ permissions: GRANTS, effect: 'write' }
		);
		if (create.ok) {
			return { ok: true, value: record };
		}
		return { ok: false, code: create.code, message: create.message };
	}

	async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
		const action = plan.actions[actionId];
		if (action === undefined) {
			return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
		}
		try {
			if (Object.hasOwn(METHOD_ACTION_OPS, actionId)) {
				const permission = action.kind === 'query' ? 'method.read' : 'method.write';
				if (!GRANTS.includes(permission))
					return { ok: false, code: 'DENIED', message: 'This action is not permitted.' };
				let command;
				try {
					command = parseMethodCommand(input);
				} catch {
					return await methodService.execute(input);
				}
				const allowed: readonly string[] =
					METHOD_ACTION_OPS[actionId as keyof typeof METHOD_ACTION_OPS];
				if (!allowed.includes(command.op))
					return {
						ok: false,
						code: 'INVALID_REQUEST',
						message: 'The command does not match the declared action.'
					};
				return await methodService.execute(command);
			}
			if (action.id === 'act.saveWorkspace') {
				const contractResult = workspaceRecordContract.parse(input);
				if (!contractResult.ok) {
					return {
						ok: false,
						code: 'CONTRACT_REJECTED',
						message: 'The workspace record did not satisfy its contract.'
					};
				}
				const parsed = parseWorkspaceInstance(contractResult.value);
				if (!parsed.ok) {
					return { ok: false, code: 'CONTRACT_REJECTED', message: parsed.message };
				}
				return await saveWorkspace(parsed.instance);
			}
			if (action.id === 'act.queryWorkspaces') {
				const result = await data.query(
					{
						op: 'list',
						resourceId: 'workspace_instances',
						sort: [{ field: 'updatedAt', direction: 'desc' }]
					},
					{ permissions: GRANTS, effect: 'read' }
				);
				if (!result.ok) {
					return { ok: false, code: result.code, message: result.message };
				}
				return { ok: true, value: { rows: result.rows ?? [], total: result.total ?? 0 } };
			}
			return {
				ok: false,
				code: 'UNSUPPORTED_ACTION',
				message: 'This action is declared but not wired in T1.'
			};
		} catch {
			return {
				ok: false,
				code: 'ACTION_FAILED',
				message: 'The action could not be completed; this safe failure is server-generated.'
			};
		}
	}

	function loadRoute(path: string) {
		const route = plan.routes.find((entry) => entry.route.path === path);
		return route ?? null;
	}

	return {
		plan,
		data,
		dispatch,
		readWorkspace,
		loadRoute,
		async close(): Promise<void> {
			methods.close();
			(data as { close?: () => void }).close?.();
		}
	};
}

let server: AppServer | undefined;

/** The process-wide composition root (one per server process, by design). */
export function getAppServer(): AppServer {
	if (server === undefined) {
		server = createAppServer();
	}
	return server;
}
