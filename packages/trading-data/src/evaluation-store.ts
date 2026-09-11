/** Server-only SQLite storage. Never export from the browser barrel. */
import { createHash } from 'node:crypto';
import {
	openAppDatabase,
	applyApplicationDataMigrations,
	type ApplicationDataMigration
} from '@victframework/appdata-sqlite';
import {
	EvaluationError,
	EVALUATION_LIMITS,
	canonicalEvaluation,
	stableJson,
	parseSeriesSpec,
	parseStoredSeries,
	parseStoredBar,
	parseEvaluationRun,
	parseStoredResult,
	parseIngestionReceipt,
	seriesHealth,
	identifier,
	utcInteger,
	type EvaluationRepository,
	type StoredSeries,
	type EvaluationRun
} from '@trading-os/trading-domain';

export const sha256 = (text: string): string =>
	`sha256:${createHash('sha256').update(text).digest('hex')}`;
const immutableTables = ['market_series', 'market_bars', 'market_ingestions', 'evaluation_results'];
export const EVALUATION_MIGRATIONS: readonly ApplicationDataMigration[] = [
	{
		id: 'trading-data-evaluation-v4',
		version: 4,
		name: 'immutable-market-series-and-evaluation-results',
		statements: [
			`CREATE TABLE appdata_market_series(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, instrument TEXT NOT NULL, timeframe TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), metadata_hash TEXT NOT NULL);`,
			`CREATE TABLE appdata_market_bars(series_id TEXT NOT NULL REFERENCES appdata_market_series(id) DEFERRABLE INITIALLY DEFERRED, time INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), fingerprint TEXT NOT NULL, PRIMARY KEY(series_id,time));`,
			`CREATE TRIGGER market_bars_no_append BEFORE INSERT ON appdata_market_bars WHEN EXISTS(SELECT 1 FROM appdata_market_series WHERE id=NEW.series_id) BEGIN SELECT RAISE(ABORT,'immutable'); END;`,
			`CREATE TABLE appdata_market_ingestions(request_id TEXT PRIMARY KEY, revision TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)));`,
			`CREATE TABLE appdata_evaluation_runs(id TEXT PRIMARY KEY, method_version_id TEXT NOT NULL REFERENCES appdata_method_versions(id), input_fingerprint TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','interrupted')), revision INTEGER NOT NULL CHECK(revision>0), result_fingerprint TEXT REFERENCES appdata_evaluation_results(fingerprint), data TEXT NOT NULL CHECK(json_valid(data)));`,
			`CREATE INDEX evaluation_runs_method ON appdata_evaluation_runs(method_version_id,id);`,
			`CREATE TABLE appdata_evaluation_results(fingerprint TEXT PRIMARY KEY, input_fingerprint TEXT NOT NULL UNIQUE, canonical TEXT NOT NULL CHECK(json_valid(canonical)));`,
			`CREATE TRIGGER evaluation_run_no_delete BEFORE DELETE ON appdata_evaluation_runs BEGIN SELECT RAISE(ABORT,'immutable'); END;`,
			`CREATE TRIGGER evaluation_run_transition BEFORE UPDATE ON appdata_evaluation_runs WHEN OLD.status NOT IN ('queued','running') OR NEW.id<>OLD.id OR NEW.method_version_id<>OLD.method_version_id OR NEW.input_fingerprint<>OLD.input_fingerprint OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='queued' AND NEW.status IN ('running','failed','interrupted')) OR (OLD.status='running' AND NEW.status IN ('succeeded','failed','interrupted'))) BEGIN SELECT RAISE(ABORT,'invalid transition'); END;`,
			...immutableTables.flatMap((t) =>
				['UPDATE', 'DELETE'].map(
					(op) =>
						`CREATE TRIGGER ${t}_no_${op.toLowerCase()} BEFORE ${op} ON appdata_${t} BEGIN SELECT RAISE(ABORT,'immutable'); END;`
				)
			)
		]
	}
];

export function createSqliteEvaluationRepository(
	path: string,
	migrations: readonly ApplicationDataMigration[]
): EvaluationRepository {
	const open = openAppDatabase(path, 5000);
	try {
		applyApplicationDataMigrations(open, migrations, () => new Date().toISOString());
	} catch (e) {
		open.close();
		throw e;
	}
	const db = open.db;
	function safe<T>(f: () => T): T {
		try {
			return f();
		} catch (e) {
			if (e instanceof EvaluationError) throw e;
			throw new EvaluationError('INVALID_RECORD');
		}
	}
	function transaction<T>(f: () => T): T {
		let started = false;
		try {
			db.exec('BEGIN IMMEDIATE');
			started = true;
			const r = f();
			if (r instanceof Promise) throw new EvaluationError('PERSISTENCE_FAILED');
			db.exec('COMMIT');
			return r;
		} catch (e) {
			if (started) db.exec('ROLLBACK');
			if (e instanceof EvaluationError) throw e;
			throw new EvaluationError('PERSISTENCE_FAILED');
		}
	}
	function seriesRow(row: unknown): StoredSeries | null {
		if (!row) return null;
		return safe(() => {
			const r = row as Record<string, unknown>,
				s = parseStoredSeries(JSON.parse(String(r.data)));
			if (
				s.id !== r.id ||
				s.fingerprint !== r.fingerprint ||
				s.instrument !== r.instrument ||
				s.timeframe !== r.timeframe ||
				sha256(stableJson(s)) !== r.metadata_hash
			)
				throw new EvaluationError('INVALID_RECORD');
			return s;
		});
	}
	function runRow(row: unknown): EvaluationRun | null {
		if (!row) return null;
		return safe(() => {
			const r = row as Record<string, unknown>,
				v = parseEvaluationRun(JSON.parse(String(r.data)));
			if (
				v.id !== r.id ||
				v.request.methodVersionId !== r.method_version_id ||
				v.status !== r.status ||
				v.revision !== r.revision ||
				v.inputFingerprint !== r.input_fingerprint ||
				v.resultFingerprint !== r.result_fingerprint ||
				sha256(canonicalEvaluation(v.identity)) !== v.inputFingerprint
			)
				throw new EvaluationError('INVALID_RECORD');
			return v;
		});
	}
	function update(run: EvaluationRun, expected: number): EvaluationRun {
		const v = parseEvaluationRun(run);
		const r = db
			.prepare(
				'UPDATE appdata_evaluation_runs SET status=?,revision=?,result_fingerprint=?,data=? WHERE id=? AND revision=?'
			)
			.run(v.status, v.revision, v.resultFingerprint, JSON.stringify(v), v.id, expected);
		if (r.changes !== 1) throw new EvaluationError('CONFLICT');
		return v;
	}
	const repo: EvaluationRepository = {
		listSeries: () =>
			safe(() => {
				const rows = db
					.prepare('SELECT * FROM appdata_market_series ORDER BY instrument,timeframe,id LIMIT ?')
					.all(EVALUATION_LIMITS.catalog + 1);
				if (rows.length > EVALUATION_LIMITS.catalog) throw new EvaluationError('LIMIT_EXCEEDED');
				return rows.map((r) => seriesRow(r)!);
			}),
		getSeries: (id) =>
			safe(() => seriesRow(db.prepare('SELECT * FROM appdata_market_series WHERE id=?').get(id))),
		readBars: (query) =>
			safe(() => {
				const { seriesId, start, end, limit } = query;
				utcInteger(start);
				utcInteger(end);
				if (
					!Number.isSafeInteger(limit) ||
					limit < 1 ||
					limit > EVALUATION_LIMITS.inputBars ||
					end < start
				)
					throw new EvaluationError('INVALID_REQUEST');
				const series = repo.getSeries(seriesId);
				if (!series) throw new EvaluationError('NOT_FOUND');
				const rows = db
					.prepare(
						'SELECT * FROM appdata_market_bars WHERE series_id=? AND time>=? AND time<? ORDER BY time LIMIT ?'
					)
					.all(seriesId, start, end, limit + 1);
				if (rows.length > limit) throw new EvaluationError('LIMIT_EXCEEDED');
				return Object.freeze(
					rows.map((row) => {
						const r = row as Record<string, unknown>,
							b = parseStoredBar(JSON.parse(String(r.data)));
						if (
							r.series_id !== seriesId ||
							r.time !== b.time ||
							sha256(stableJson(b)) !== r.fingerprint ||
							(b.time - series.alignmentMs) % series.durationMs ||
							b.time < series.coverage.start ||
							b.time >= series.coverage.end
						)
							throw new EvaluationError('INVALID_RECORD');
						return b;
					})
				);
			}),
		getIngestion: (requestId) =>
			safe(() => {
				const row = db
					.prepare('SELECT * FROM appdata_market_ingestions WHERE request_id=?')
					.get(requestId) as Record<string, unknown> | undefined;
				if (!row) return null;
				const r = parseIngestionReceipt(JSON.parse(String(row.data)));
				if (r.requestId !== row.request_id || r.fixtureRevision !== row.revision)
					throw new EvaluationError('INVALID_RECORD');
				return r;
			}),
		ingest: (requestId, revision, specs, now) => {
			identifier(requestId);
			if (revision !== '1') throw new EvaluationError('UNSUPPORTED_SCHEMA');
			if (!specs.length || specs.length > 8) throw new EvaluationError('LIMIT_EXCEEDED');
			const begin = Date.now();
			const prepared = specs.map((value) => {
				const spec = parseSeriesSpec(value),
					id = sha256(stableJson(spec));
				const { bars, ...metadata } = spec;
				const s = parseStoredSeries({
					...metadata,
					schema: 'trading.stored-series@1',
					id,
					fingerprint: id,
					coverage: {
						start: bars[0]!.time,
						end: bars.at(-1)!.time + spec.durationMs,
						barCount: bars.length
					},
					health: seriesHealth(bars, spec.durationMs),
					ingestion: { requestId, ingestedAt: now, operation: 'trading.ingest-fixture@1' }
				});
				return { spec, series: s };
			});
			if (
				new Set(prepared.map((p) => p.series.id)).size !== prepared.length ||
				prepared.reduce((n, p) => n + p.spec.bars.length, 0) > 300000
			)
				throw new EvaluationError('LIMIT_EXCEEDED');
			return transaction(() => {
				const old = repo.getIngestion(requestId),
					ids = prepared.map((p) => p.series.id).sort();
				if (old) {
					if (old.fixtureRevision !== revision || stableJson(old.seriesIds) !== stableJson(ids))
						throw new EvaluationError('IDEMPOTENCY_CONFLICT');
					return old;
				}
				const insertBar = db.prepare(
					'INSERT INTO appdata_market_bars(series_id,time,data,fingerprint) VALUES(?,?,?,?)'
				);
				for (const { spec, series } of prepared) {
					if (repo.getSeries(series.id)) continue;
					for (const b of spec.bars) {
						const canonical = stableJson(b);
						insertBar.run(series.id, b.time, canonical, sha256(canonical));
					}
					db.prepare(
						'INSERT INTO appdata_market_series(id,fingerprint,instrument,timeframe,data,metadata_hash) VALUES(?,?,?,?,?,?)'
					).run(
						series.id,
						series.fingerprint,
						series.instrument,
						series.timeframe,
						JSON.stringify(series),
						sha256(stableJson(series))
					);
				}
				const receipt = parseIngestionReceipt({
					requestId,
					fixtureRevision: revision,
					seriesIds: ids,
					ingestedAt: now,
					durationMs: Date.now() - begin,
					barCount: prepared.reduce((n, p) => n + p.spec.bars.length, 0)
				});
				db.prepare(
					'INSERT INTO appdata_market_ingestions(request_id,revision,data) VALUES(?,?,?)'
				).run(requestId, revision, JSON.stringify(receipt));
				return receipt;
			});
		},
		createRun: (value) =>
			transaction(() => {
				const run = parseEvaluationRun(value);
				if (
					run.status !== 'queued' ||
					run.revision !== 1 ||
					sha256(canonicalEvaluation(run.identity)) !== run.inputFingerprint
				)
					throw new EvaluationError('INVALID_RECORD');
				const old = repo.getRun(run.id);
				if (old) {
					if (
						stableJson(old.request) !== stableJson(run.request) ||
						old.inputFingerprint !== run.inputFingerprint
					)
						throw new EvaluationError('IDEMPOTENCY_CONFLICT');
					return old;
				}
				db.prepare(
					'INSERT INTO appdata_evaluation_runs(id,method_version_id,input_fingerprint,status,revision,result_fingerprint,data) VALUES(?,?,?,?,?,?,?)'
				).run(
					run.id,
					run.request.methodVersionId,
					run.inputFingerprint,
					run.status,
					run.revision,
					null,
					JSON.stringify(run)
				);
				return run;
			}),
		getRun: (id) =>
			safe(() => runRow(db.prepare('SELECT * FROM appdata_evaluation_runs WHERE id=?').get(id))),
		listRuns: (methodId) =>
			safe(() => {
				const rows =
					methodId === null
						? db
								.prepare('SELECT * FROM appdata_evaluation_runs ORDER BY rowid DESC LIMIT ?')
								.all(EVALUATION_LIMITS.runs)
						: db
								.prepare(
									'SELECT * FROM appdata_evaluation_runs WHERE method_version_id=? ORDER BY rowid DESC LIMIT ?'
								)
								.all(methodId, EVALUATION_LIMITS.runs);
				return rows.map((r) => runRow(r)!);
			}),
		transition: (id, expected, status, now, failure) =>
			transaction(() => {
				const old = repo.getRun(id);
				if (!old || old.revision !== expected) throw new EvaluationError('CONFLICT');
				return update(
					{
						...old,
						status,
						revision: expected + 1,
						startedAt: status === 'running' ? now : old.startedAt,
						finishedAt: status === 'failed' ? now : null,
						failureCode: status === 'failed' ? (failure ?? 'CALCULATION_FAILED') : null
					},
					expected
				);
			}),
		complete: (id, expected, value, now) =>
			transaction(() => {
				const result = parseStoredResult(value),
					old = repo.getRun(id);
				if (!old || old.revision !== expected || old.status !== 'running')
					throw new EvaluationError('CONFLICT');
				if (
					result.inputFingerprint !== old.inputFingerprint ||
					sha256(result.canonical) !== result.fingerprint ||
					sha256(canonicalEvaluation(result.content.identity)) !== result.inputFingerprint ||
					stableJson(old.identity) !== stableJson(result.content.identity)
				)
					throw new EvaluationError('INVALID_RECORD');
				const existing = repo.getResult(result.fingerprint);
				if (existing) {
					if (
						existing.canonical !== result.canonical ||
						existing.inputFingerprint !== result.inputFingerprint
					)
						throw new EvaluationError('INVALID_RECORD');
				} else
					db.prepare(
						'INSERT INTO appdata_evaluation_results(fingerprint,input_fingerprint,canonical) VALUES(?,?,?)'
					).run(result.fingerprint, result.inputFingerprint, result.canonical);
				return update(
					{
						...old,
						status: 'succeeded',
						revision: expected + 1,
						resultFingerprint: result.fingerprint,
						finishedAt: now
					},
					expected
				);
			}),
		getResult: (fingerprint) =>
			safe(() => {
				const r = db
					.prepare('SELECT * FROM appdata_evaluation_results WHERE fingerprint=?')
					.get(fingerprint) as Record<string, unknown> | undefined;
				if (!r) return null;
				const v = parseStoredResult({
					fingerprint: r.fingerprint,
					inputFingerprint: r.input_fingerprint,
					canonical: r.canonical,
					content: JSON.parse(String(r.canonical))
				});
				if (
					sha256(v.canonical) !== v.fingerprint ||
					sha256(canonicalEvaluation(v.content.identity)) !== v.inputFingerprint
				)
					throw new EvaluationError('INVALID_RECORD');
				return v;
			}),
		recover: (now) =>
			transaction(() => {
				const rows = db
					.prepare("SELECT * FROM appdata_evaluation_runs WHERE status IN ('queued','running')")
					.all();
				for (const row of rows) {
					const r = runRow(row)!;
					update(
						{
							...r,
							status: 'interrupted',
							revision: r.revision + 1,
							finishedAt: now,
							failureCode: 'INTERRUPTED'
						},
						r.revision
					);
				}
				return rows.length;
			}),
		close: () => open.close()
	};
	return Object.freeze(repo);
}
