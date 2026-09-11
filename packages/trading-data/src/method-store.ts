/** Server-only adapter. Import through trading-data/method-store, never the browser barrel. */
import { createHash } from 'node:crypto';
import {
	openAppDatabase,
	applyApplicationDataMigrations,
	type ApplicationDataMigration
} from '@victframework/appdata-sqlite';
import {
	MethodError,
	parseMethod,
	parseDraft,
	parseVersion,
	parseProfile,
	parseMethodReply,
	parseMethodCommand,
	type MethodRepository,
	type MethodTransaction,
	type RequestReceipt
} from '@trading-os/trading-domain';

export const METHOD_MIGRATIONS: readonly ApplicationDataMigration[] = [
	{
		id: 'trading-method-system-v2',
		version: 2,
		name: 'method-lineages-drafts-immutable-versions',
		statements: [
			`CREATE TABLE appdata_methods (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));`,
			`CREATE TABLE appdata_method_drafts (method_id TEXT PRIMARY KEY REFERENCES appdata_methods(id), revision INTEGER NOT NULL CHECK(revision > 0), source_id TEXT REFERENCES appdata_method_versions(id), data TEXT NOT NULL CHECK(json_valid(data)));`,
			`CREATE TABLE appdata_method_versions (id TEXT PRIMARY KEY, method_id TEXT NOT NULL REFERENCES appdata_methods(id), number INTEGER NOT NULL CHECK(number > 0), source_id TEXT REFERENCES appdata_method_versions(id), data TEXT NOT NULL CHECK(json_valid(data)), UNIQUE(method_id, number));`,
			`CREATE TABLE appdata_method_requests (key TEXT PRIMARY KEY, command TEXT NOT NULL, reply TEXT NOT NULL CHECK(json_valid(reply)));`,
			`CREATE TRIGGER method_version_no_update BEFORE UPDATE ON appdata_method_versions BEGIN SELECT RAISE(ABORT, 'immutable'); END;`,
			`CREATE TRIGGER method_version_no_delete BEFORE DELETE ON appdata_method_versions BEGIN SELECT RAISE(ABORT, 'immutable'); END;`,
			`CREATE TRIGGER method_request_no_update BEFORE UPDATE ON appdata_method_requests BEGIN SELECT RAISE(ABORT, 'immutable'); END;`,
			`CREATE TRIGGER method_request_no_delete BEFORE DELETE ON appdata_method_requests BEGIN SELECT RAISE(ABORT, 'immutable'); END;`
		]
	},
	{
		id: 'trading-workspace-profiles-v3',
		version: 3,
		name: 'independent-workspace-profile-revisions',
		statements: [
			`CREATE TABLE appdata_workspace_profiles (workspace_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0), version_id TEXT REFERENCES appdata_method_versions(id), data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(workspace_id, revision));`,
			`CREATE TRIGGER workspace_profile_no_update BEFORE UPDATE ON appdata_workspace_profiles BEGIN SELECT RAISE(ABORT, 'immutable'); END;`,
			`CREATE TRIGGER workspace_profile_no_delete BEFORE DELETE ON appdata_workspace_profiles BEGIN SELECT RAISE(ABORT, 'immutable'); END;`
		]
	}
];

export function createSqliteMethodRepository(
	path: string,
	migrations: readonly ApplicationDataMigration[]
): MethodRepository {
	const open = openAppDatabase(path, 5000);
	try {
		applyApplicationDataMigrations(open, migrations, () => new Date().toISOString());
	} catch (error) {
		open.close();
		throw error;
	}
	const { db } = open;
	function decode<T>(row: unknown, parse: (v: unknown) => T): T | null {
		if (!row) return null;
		try {
			const columns = row as Record<string, unknown>;
			const parsed = parse(JSON.parse(String(columns.data)));
			const value = parsed as Record<string, unknown>;
			const mapping: Record<string, string> = {
				id: 'id',
				method_id: 'methodId',
				number: 'number',
				revision: 'revision',
				workspace_id: 'workspaceId',
				version_id: 'methodVersionId'
			};
			for (const [column, field] of Object.entries(mapping)) {
				if (Object.hasOwn(columns, column) && columns[column] !== value[field])
					throw new MethodError('INVALID_RECORD');
			}
			if (
				Object.hasOwn(columns, 'source_id') &&
				columns.source_id !==
					(value.provenance as { sourceVersionId: string | null }).sourceVersionId
			)
				throw new MethodError('INVALID_RECORD');
			return parsed;
		} catch (error) {
			if (error instanceof MethodError && error.code === 'UNSUPPORTED_SCHEMA') throw error;
			throw new MethodError('INVALID_RECORD');
		}
	}
	function version(v: unknown) {
		const parsed = parseVersion(v);
		if (
			`sha256:${createHash('sha256').update(parsed.canonical).digest('hex')}` !== parsed.fingerprint
		)
			throw new MethodError('INVALID_RECORD');
		return parsed;
	}
	const tx: MethodTransaction = {
		listMethods: () =>
			db
				.prepare('SELECT * FROM appdata_methods ORDER BY id')
				.all()
				.map((row) => decode(row, parseMethod)!),
		getMethod: (id) =>
			decode(db.prepare('SELECT * FROM appdata_methods WHERE id = ?').get(id), parseMethod),
		getDraft: (id) =>
			decode(
				db.prepare('SELECT * FROM appdata_method_drafts WHERE method_id = ?').get(id),
				parseDraft
			),
		getVersion: (id) =>
			decode(db.prepare('SELECT * FROM appdata_method_versions WHERE id = ?').get(id), version),
		listVersions: (id) =>
			db
				.prepare('SELECT * FROM appdata_method_versions WHERE method_id = ? ORDER BY number')
				.all(id)
				.map((row) => decode(row, version)!),
		getProfile: (id) =>
			decode(
				db
					.prepare(
						'SELECT * FROM appdata_workspace_profiles WHERE workspace_id = ? ORDER BY revision DESC LIMIT 1'
					)
					.get(id),
				parseProfile
			),
		getReceipt: (key) => {
			const row = db
				.prepare('SELECT command, reply FROM appdata_method_requests WHERE key = ?')
				.get(key) as { command: string; reply: string } | undefined;
			if (!row) return null;
			try {
				const command = parseMethodCommand(JSON.parse(row.command));
				if (!('requestId' in command) || command.requestId !== key)
					throw new MethodError('INVALID_RECORD');
				return {
					key,
					command: row.command,
					reply: parseMethodReply(JSON.parse(row.reply))
				} satisfies RequestReceipt;
			} catch {
				throw new MethodError('INVALID_RECORD');
			}
		},
		insertMethod: (method) => {
			parseMethod(method);
			db.prepare('INSERT INTO appdata_methods(id, data) VALUES (?, ?)').run(
				method.id,
				JSON.stringify(method)
			);
		},
		updateMethod: (method) => {
			parseMethod(method);
			const result = db
				.prepare('UPDATE appdata_methods SET data = ? WHERE id = ?')
				.run(JSON.stringify(method), method.id);
			if (result.changes !== 1) throw new MethodError('CONFLICT');
		},
		putDraft: (draft, expected) => {
			parseDraft(draft);
			if (expected === null) {
				if (tx.getDraft(draft.methodId)) throw new MethodError('CONFLICT');
				db.prepare(
					'INSERT INTO appdata_method_drafts(method_id, revision, source_id, data) VALUES (?, ?, ?, ?)'
				).run(
					draft.methodId,
					draft.revision,
					draft.provenance.sourceVersionId,
					JSON.stringify(draft)
				);
			} else {
				const result = db
					.prepare(
						'UPDATE appdata_method_drafts SET revision = ?, source_id = ?, data = ? WHERE method_id = ? AND revision = ?'
					)
					.run(
						draft.revision,
						draft.provenance.sourceVersionId,
						JSON.stringify(draft),
						draft.methodId,
						expected
					);
				if (result.changes !== 1) throw new MethodError('CONFLICT');
			}
		},
		removeDraft: (id, expected) => {
			const result = db
				.prepare('DELETE FROM appdata_method_drafts WHERE method_id = ? AND revision = ?')
				.run(id, expected);
			if (result.changes !== 1) throw new MethodError('CONFLICT');
		},
		insertVersion: (value) => {
			version(value);
			db.prepare(
				'INSERT INTO appdata_method_versions(id, method_id, number, source_id, data) VALUES (?, ?, ?, ?, ?)'
			).run(
				value.id,
				value.methodId,
				value.number,
				value.provenance.sourceVersionId,
				JSON.stringify(value)
			);
		},
		insertProfile: (profile) => {
			parseProfile(profile);
			db.prepare(
				'INSERT INTO appdata_workspace_profiles(workspace_id, revision, version_id, data) VALUES (?, ?, ?, ?)'
			).run(
				profile.workspaceId,
				profile.revision,
				profile.methodVersionId,
				JSON.stringify(profile)
			);
		},
		insertReceipt: (receipt) => {
			parseMethodReply(receipt.reply);
			db.prepare('INSERT INTO appdata_method_requests(key, command, reply) VALUES (?, ?, ?)').run(
				receipt.key,
				receipt.command,
				JSON.stringify(receipt.reply)
			);
		}
	};
	return {
		transaction<T>(work: (tx: MethodTransaction) => T): T {
			let began = false;
			try {
				db.exec('BEGIN IMMEDIATE');
				began = true;
				const result = work(tx);
				if (result instanceof Promise) throw new MethodError('PERSISTENCE_FAILED');
				db.exec('COMMIT');
				return result;
			} catch (error) {
				if (began) db.exec('ROLLBACK');
				if (error instanceof MethodError) throw error;
				throw new MethodError('PERSISTENCE_FAILED');
			}
		},
		close: () => open.close()
	};
}
