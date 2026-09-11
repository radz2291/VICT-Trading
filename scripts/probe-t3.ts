/** Reproducible local computational measurements; never trading performance. */
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrationsFromResources } from '@victframework/appdata-sqlite';
import {
	createSqliteEvaluationRepository,
	EVALUATION_MIGRATIONS,
	sha256
} from '../packages/trading-data/src/evaluation-store.ts';
import { METHOD_MIGRATIONS } from '../packages/trading-data/src/method-store.ts';
import { deterministicFixture } from '../packages/trading-data/src/evaluation-fixture.ts';
import {
	createCalculationRegistry,
	evaluateMethod,
	inputQueryBounds
} from '../packages/trading-capabilities/src/evaluator.ts';
import { createAuthoringCatalog } from '../packages/trading-capabilities/src/index.ts';
import {
	reversionFixture,
	breakoutFixture
} from '../packages/trading-capabilities/test/fixtures.ts';
import { version } from '../packages/trading-capabilities/test/evaluation-helpers.ts';
import { canonicalEvaluation, parseEvaluationRequest } from '@trading-os/trading-domain';
const directory = mkdtempSync(join(tmpdir(), 'tos-t3-measure-')),
	path = join(directory, 'measure.sqlite');
const repo = createSqliteEvaluationRepository(path, [
	migrationsFromResources([], 1),
	...METHOD_MIGRATIONS,
	...EVALUATION_MIGRATIONS
]);
try {
	const before = process.memoryUsage().rss,
		begin = performance.now(),
		fixture = deterministicFixture();
	const generated = performance.now();
	const receipt = repo.ingest('measurement', '1', fixture, new Date().toISOString());
	const ingested = performance.now(),
		series = repo.listSeries();
	const evaluations = [reversionFixture, breakoutFixture].map((content) => {
		const v = version(content),
			driver = content.observations.at(-1)!;
		const bindings = content.observations.map((o) => ({
			observationId: o.id,
			seriesId: series.find(
				(s) =>
					s.instrument === o.instrument && s.timeframe === o.timeframe && s.health.state === 'ready'
			)!.id
		}));
		const d = series.find(
			(s) => s.id === bindings.find((b) => b.observationId === driver.id)!.seriesId
		)!;
		const request = parseEvaluationRequest({
			schema: 'trading.evaluation-request@1',
			methodVersionId: v.id,
			bindings,
			driverObservationId: driver.id,
			calculationRevision: 'closed-bars-v1',
			start: d.coverage.end - 95 * d.durationMs,
			end: d.coverage.end + d.durationMs
		});
		const t = performance.now();
		const inputs = [...new Set(bindings.map((b) => b.seriesId))].map((id) => {
			const s = repo.getSeries(id)!;
			return {
				series: s,
				bars: repo.readBars({ seriesId: id, ...inputQueryBounds(request, s, v) })
			};
		});
		const loaded = performance.now(),
			result = evaluateMethod(
				v,
				request,
				inputs,
				createAuthoringCatalog(),
				createCalculationRegistry()
			),
			canonical = canonicalEvaluation(result),
			finished = performance.now();
		return {
			method: content.name,
			frames: result.frames.length,
			inputBars: inputs.reduce((n, i) => n + i.bars.length, 0),
			loadMs: loaded - t,
			evaluationAndCanonicalMs: finished - loaded,
			resultBytes: Buffer.byteLength(canonical),
			fingerprint: sha256(canonical),
			counts: result.counts
		};
	});
	repo.close();
	console.log(
		JSON.stringify(
			{
				node: process.version,
				fixtureRevision: '1',
				seed: 73129,
				anchor: '2025-01-06T00:00:00.000Z',
				bars: receipt.barCount,
				generationMs: generated - begin,
				ingestionMs: ingested - generated,
				databaseBytes: statSync(path).size,
				rssDeltaBytes: process.memoryUsage().rss - before,
				series: series.map((s) => ({
					id: s.id,
					instrument: s.instrument,
					timeframe: s.timeframe,
					bars: s.coverage.barCount,
					health: s.health.state
				})),
				evaluations
			},
			null,
			2
		)
	);
} finally {
	repo.close();
	rmSync(directory, { recursive: true, force: true });
}
