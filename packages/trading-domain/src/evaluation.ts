import { immutableCopy, type CapabilityInstance, type MethodVersion } from './method.ts';
import { exact, identifier, record, stableJson, textValue } from './method-validation.ts';
import { parseVersion } from './method-records.ts';
import type { Bar } from './bar.ts';

export const EVALUATION_LIMITS = Object.freeze({
	seriesBars: 65536,
	inputBars: 12000,
	totalInputBars: 120000,
	frames: 512,
	resultBytes: 4_000_000,
	responseBytes: 12_000_000,
	rangeMs: 366 * 86400000,
	catalog: 64,
	runs: 100
});
export const FIXTURE_LABEL = 'Deterministic fixture data — not live or broker history';
export const ENGINE_REVISION = 'trading.evaluator@1';
export const CALCULATION_REVISION = 'closed-bars-v1';
export const EVALUATION_OPERATION = 'trading.evaluate@1';
export type EvaluationErrorCode =
	| 'INVALID_REQUEST'
	| 'INVALID_RECORD'
	| 'UNSUPPORTED_SCHEMA'
	| 'INCOMPATIBLE_BINDING'
	| 'UNSUPPORTED_CALCULATION'
	| 'LIMIT_EXCEEDED'
	| 'NOT_FOUND'
	| 'IDEMPOTENCY_CONFLICT'
	| 'CONFLICT'
	| 'PERSISTENCE_FAILED'
	| 'CALCULATION_FAILED'
	| 'INTERRUPTED'
	| 'DENIED';
export const EVALUATION_ERRORS: Record<EvaluationErrorCode, string> = {
	INVALID_REQUEST: 'The evaluation request is malformed. Review its bounds and identities.',
	INVALID_RECORD: 'Stored data or result could not be verified. It has not been changed.',
	UNSUPPORTED_SCHEMA: 'This data schema is not supported by this build.',
	INCOMPATIBLE_BINDING: 'Bind every observation to an exact matching instrument and timeframe.',
	UNSUPPORTED_CALCULATION: 'An exact calculation revision required by this Method is unavailable.',
	LIMIT_EXCEEDED: 'This request exceeds an evaluation limit. Select a shorter range.',
	NOT_FOUND: 'The requested immutable record is unavailable.',
	IDEMPOTENCY_CONFLICT: 'This request ID was already used with different inputs.',
	CONFLICT: 'The operation state changed. Reload confirmed state.',
	PERSISTENCE_FAILED: 'Persistence could not be confirmed. Retry the same request to reconcile.',
	CALCULATION_FAILED: 'The calculation did not complete. No result is available for this run.',
	INTERRUPTED: 'The server stopped before completion. Start a new run to evaluate these inputs.',
	DENIED: 'This operation is not permitted.'
};
export class EvaluationError extends Error {
	constructor(
		readonly code: EvaluationErrorCode,
		readonly diagnostics: readonly CalculationDiagnostic[] = []
	) {
		super(EVALUATION_ERRORS[code]);
		this.name = 'EvaluationError';
	}
}
export type DiagnosticCode =
	| 'WARM_UP'
	| 'MISSING_DATA'
	| 'OUTSIDE_COVERAGE'
	| 'DEPENDENCY_UNAVAILABLE'
	| 'UNSUPPORTED_CALCULATION'
	| 'NON_FINITE'
	| 'ZERO_MEAN';
export const CALCULATION_DIAGNOSTICS: Record<DiagnosticCode, string> = {
	WARM_UP: 'Insufficient previous closed bars for the declared lookback.',
	MISSING_DATA: 'An expected closed bar is missing. Gaps are never filled.',
	OUTSIDE_COVERAGE: 'No current closed bar is available at this timestamp.',
	DEPENDENCY_UNAVAILABLE: 'The referenced analysis is unavailable at this timestamp.',
	UNSUPPORTED_CALCULATION: 'The exact calculation revision is unavailable.',
	NON_FINITE: 'Arithmetic exceeded the finite numeric range.',
	ZERO_MEAN: 'Percentage distance is undefined for a zero mean.'
};
export interface CalculationDiagnostic {
	readonly code: DiagnosticCode;
	readonly instanceId: string;
	readonly message: string;
}
export interface SeriesSpec {
	readonly schema: 'trading.series-content@1';
	readonly instrument: string;
	readonly timeframe: string;
	readonly durationMs: number;
	readonly alignmentMs: number;
	readonly timestampConvention: 'utc-open-ms';
	readonly source: {
		readonly kind: 'fixture';
		readonly label: string;
		readonly revision: string;
		readonly description: string;
	};
	readonly bars: readonly Bar[];
}
export interface DataGap {
	readonly start: number;
	readonly end: number;
	readonly missingBars: number;
}
export interface StoredSeries {
	readonly schema: 'trading.stored-series@1';
	readonly id: string;
	readonly fingerprint: string;
	readonly instrument: string;
	readonly timeframe: string;
	readonly durationMs: number;
	readonly alignmentMs: number;
	readonly timestampConvention: 'utc-open-ms';
	readonly source: SeriesSpec['source'];
	readonly coverage: { readonly start: number; readonly end: number; readonly barCount: number };
	readonly health: { readonly state: 'ready' | 'gaps'; readonly gaps: readonly DataGap[] };
	readonly ingestion: {
		readonly requestId: string;
		readonly ingestedAt: string;
		readonly operation: 'trading.ingest-fixture@1';
	};
}
export interface SeriesInput {
	readonly series: StoredSeries;
	readonly bars: readonly Bar[];
}
export interface ObservationBinding {
	readonly observationId: string;
	readonly seriesId: string;
}
export interface EvaluationRequest {
	readonly schema: 'trading.evaluation-request@1';
	readonly methodVersionId: string;
	readonly bindings: readonly ObservationBinding[];
	readonly start: number;
	readonly end: number;
	readonly driverObservationId: string;
	readonly calculationRevision: typeof CALCULATION_REVISION;
}
export interface CalculationPin {
	readonly capabilityId: string;
	readonly definitionRevision: string;
	readonly calculationRevision: string;
}
export interface EvaluationIdentity {
	readonly schema: 'trading.evaluation-input@1';
	readonly methodVersionId: string;
	readonly methodFingerprint: string;
	readonly bindings: readonly (ObservationBinding & { readonly seriesFingerprint: string })[];
	readonly start: number;
	readonly end: number;
	readonly driverObservationId: string;
	readonly calculations: readonly CalculationPin[];
	readonly engine: string;
	readonly operation: string;
	readonly timeModel: 'utc-closed-previous-lookback@1';
}
export type RuleState = 'true' | 'false' | 'unavailable';
export interface CapabilityOutput {
	readonly instanceId: string;
	readonly capabilityId: string;
	readonly definitionRevision: string;
	readonly calculationRevision: string;
	readonly kind: 'analysis' | 'rule';
	readonly state: RuleState | 'available';
	readonly values: Readonly<Record<string, number>>;
	readonly diagnostics: readonly CalculationDiagnostic[];
}
export interface EvaluationFrame {
	readonly time: number;
	readonly state: RuleState;
	readonly outputs: readonly CapabilityOutput[];
}
export interface EvaluationContent {
	readonly schema: 'trading.evaluation-result@1';
	readonly identity: EvaluationIdentity;
	readonly method: { readonly name: string; readonly number: number };
	readonly frames: readonly EvaluationFrame[];
	readonly counts: Readonly<Record<RuleState, number>>;
	readonly declarations: {
		readonly judgment: readonly CapabilityInstance[];
		readonly risk: readonly CapabilityInstance[];
		readonly execution: readonly CapabilityInstance[];
	};
}
export interface StoredEvaluationResult {
	readonly fingerprint: string;
	readonly inputFingerprint: string;
	readonly canonical: string;
	readonly content: EvaluationContent;
}
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted';
export interface EvaluationRun {
	readonly schema: 'trading.evaluation-run@1';
	readonly id: string;
	readonly request: EvaluationRequest;
	readonly inputFingerprint: string;
	readonly identity: EvaluationIdentity;
	readonly methodName: string;
	readonly versionNumber: number;
	readonly status: RunStatus;
	readonly revision: number;
	readonly createdAt: string;
	readonly startedAt: string | null;
	readonly finishedAt: string | null;
	readonly resultFingerprint: string | null;
	readonly failureCode: EvaluationErrorCode | null;
}
export interface IngestionReceipt {
	readonly requestId: string;
	readonly fixtureRevision: '1';
	readonly seriesIds: readonly string[];
	readonly ingestedAt: string;
	readonly durationMs: number;
	readonly barCount: number;
}
export type EvaluationCommand =
	| { readonly op: 'catalog' }
	| { readonly op: 'install'; readonly requestId: string; readonly fixtureRevision: '1' }
	| { readonly op: 'start'; readonly requestId: string; readonly request: EvaluationRequest }
	| { readonly op: 'runs'; readonly methodVersionId: string | null }
	| { readonly op: 'get'; readonly runId: string }
	| {
			readonly op: 'bars';
			readonly seriesId: string;
			readonly start: number;
			readonly end: number;
	  };
export type EvaluationReply =
	| { readonly kind: 'catalog'; readonly series: readonly StoredSeries[] }
	| { readonly kind: 'ingestion'; readonly receipt: IngestionReceipt }
	| {
			readonly kind: 'run';
			readonly run: EvaluationRun;
			readonly result: StoredEvaluationResult | null;
	  }
	| { readonly kind: 'runs'; readonly runs: readonly EvaluationRun[] }
	| { readonly kind: 'bars'; readonly series: StoredSeries; readonly bars: readonly Bar[] };
export type EvaluationResponse =
	| { readonly ok: true; readonly value: EvaluationReply }
	| {
			readonly ok: false;
			readonly code: EvaluationErrorCode;
			readonly message: string;
			readonly diagnostics: readonly CalculationDiagnostic[];
	  };
export interface EvaluationClient {
	execute(command: EvaluationCommand): Promise<EvaluationResponse>;
}
export interface BoundedBarQuery {
	readonly seriesId: string;
	readonly start: number;
	readonly end: number;
	readonly limit: number;
}
export interface EvaluationRepository {
	listSeries(): readonly StoredSeries[];
	getSeries(id: string): StoredSeries | null;
	readBars(query: BoundedBarQuery): readonly Bar[];
	ingest(
		requestId: string,
		revision: '1',
		specs: readonly SeriesSpec[],
		now: string
	): IngestionReceipt;
	getIngestion(requestId: string): IngestionReceipt | null;
	createRun(run: EvaluationRun): EvaluationRun;
	getRun(id: string): EvaluationRun | null;
	listRuns(methodVersionId: string | null): readonly EvaluationRun[];
	transition(
		id: string,
		expectedRevision: number,
		status: 'running' | 'failed',
		now: string,
		failure?: EvaluationErrorCode
	): EvaluationRun;
	complete(
		id: string,
		expectedRevision: number,
		result: StoredEvaluationResult,
		now: string
	): EvaluationRun;
	getResult(fingerprint: string): StoredEvaluationResult | null;
	recover(now: string): number;
	close(): void;
}
export interface EvaluationService {
	execute(input: unknown): Promise<EvaluationResponse>;
	drain(): Promise<void>;
}

export function fingerprintValue(v: unknown): string {
	if (typeof v !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(v))
		throw new EvaluationError('INVALID_RECORD');
	return v;
}
export function utcInteger(v: unknown): number {
	if (
		typeof v !== 'number' ||
		!Number.isSafeInteger(v) ||
		v < 0 ||
		v > 4102444800000 ||
		Object.is(v, -0)
	)
		throw new EvaluationError('INVALID_REQUEST');
	return v;
}
export function boundedArray(v: unknown, max: number): unknown[] {
	if (!Array.isArray(v) || v.length > max) throw new EvaluationError('LIMIT_EXCEEDED');
	return v;
}
function schema(r: Record<string, unknown>, expected: string) {
	if (r.schema !== expected) throw new EvaluationError('UNSUPPORTED_SCHEMA');
}
function count(v: unknown, max: number, min = 0): number {
	if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max || Object.is(v, -0))
		throw new EvaluationError('INVALID_REQUEST');
	return v;
}
function instant(v: unknown): string {
	if (
		typeof v !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) ||
		!Number.isFinite(Date.parse(v))
	)
		throw new EvaluationError('INVALID_RECORD');
	return v;
}
export function parseStoredBar(v: unknown): Bar {
	const r = record(v);
	exact(r, ['time', 'open', 'high', 'low', 'close', 'volume']);
	utcInteger(r.time);
	for (const k of ['open', 'high', 'low', 'close', 'volume'])
		if (typeof r[k] !== 'number' || !Number.isFinite(r[k]) || Object.is(r[k], -0))
			throw new EvaluationError('INVALID_REQUEST');
	const b = r as unknown as Bar;
	if (
		b.volume < 0 ||
		b.high < Math.max(b.open, b.close) ||
		b.low > Math.min(b.open, b.close) ||
		b.high < b.low
	)
		throw new EvaluationError('INVALID_REQUEST');
	return immutableCopy(b);
}
function source(v: unknown): SeriesSpec['source'] {
	const r = record(v);
	exact(r, ['kind', 'label', 'revision', 'description']);
	if (r.kind !== 'fixture' || r.label !== FIXTURE_LABEL)
		throw new EvaluationError('INVALID_REQUEST');
	identifier(r.revision);
	textValue(r.description, 500, true);
	return immutableCopy(r) as unknown as SeriesSpec['source'];
}
function seriesFields(r: Record<string, unknown>) {
	textValue(r.instrument, 80, true);
	textValue(r.timeframe, 30, true);
	count(r.durationMs, 7 * 86400000, 60000);
	utcInteger(r.alignmentMs);
	if (r.timestampConvention !== 'utc-open-ms' || Number(r.alignmentMs) >= Number(r.durationMs))
		throw new EvaluationError('INVALID_REQUEST');
	source(r.source);
	const known: Record<string, number> = { '15m': 900000, '1D': 86400000, '1W': 604800000 };
	if (
		known[String(r.timeframe)] !== r.durationMs ||
		(r.timeframe === '1W' ? r.alignmentMs !== 345600000 : r.alignmentMs !== 0)
	)
		throw new EvaluationError('INCOMPATIBLE_BINDING');
}
export function seriesHealth(bars: readonly Bar[], duration: number): StoredSeries['health'] {
	const gaps: DataGap[] = [];
	for (let i = 1; i < bars.length; i++) {
		const prev = bars[i - 1]!,
			b = bars[i]!;
		if (b.time - prev.time > duration)
			gaps.push({
				start: prev.time + duration,
				end: b.time,
				missingBars: (b.time - prev.time) / duration - 1
			});
	}
	if (gaps.length > 1024) throw new EvaluationError('LIMIT_EXCEEDED');
	return immutableCopy({ state: gaps.length ? 'gaps' : 'ready', gaps });
}
export function parseSeriesSpec(v: unknown): SeriesSpec {
	const r = record(v);
	schema(r, 'trading.series-content@1');
	exact(r, [
		'schema',
		'instrument',
		'timeframe',
		'durationMs',
		'alignmentMs',
		'timestampConvention',
		'source',
		'bars'
	]);
	seriesFields(r);
	const bars = boundedArray(r.bars, EVALUATION_LIMITS.seriesBars).map(parseStoredBar);
	if (!bars.length) throw new EvaluationError('INVALID_REQUEST');
	let previous = -1;
	for (const b of bars) {
		if (b.time <= previous || (b.time - Number(r.alignmentMs)) % Number(r.durationMs) !== 0)
			throw new EvaluationError('INVALID_REQUEST');
		previous = b.time;
	}
	seriesHealth(bars, Number(r.durationMs));
	return immutableCopy({ ...r, bars }) as unknown as SeriesSpec;
}
export function parseStoredSeries(v: unknown): StoredSeries {
	const r = record(v);
	schema(r, 'trading.stored-series@1');
	exact(r, [
		'schema',
		'id',
		'fingerprint',
		'instrument',
		'timeframe',
		'durationMs',
		'alignmentMs',
		'timestampConvention',
		'source',
		'coverage',
		'health',
		'ingestion'
	]);
	seriesFields(r);
	if (identifier(r.id) !== fingerprintValue(r.fingerprint))
		throw new EvaluationError('INVALID_RECORD');
	const c = record(r.coverage);
	exact(c, ['start', 'end', 'barCount']);
	const start = utcInteger(c.start),
		end = utcInteger(c.end),
		n = count(c.barCount, EVALUATION_LIMITS.seriesBars, 1);
	const d = Number(r.durationMs);
	if (end <= start || (start - Number(r.alignmentMs)) % d || (end - start) % d)
		throw new EvaluationError('INVALID_RECORD');
	const h = record(r.health);
	exact(h, ['state', 'gaps']);
	const gaps = boundedArray(h.gaps, 1024);
	let missing = 0,
		previous = start;
	for (const value of gaps) {
		const g = record(value);
		exact(g, ['start', 'end', 'missingBars']);
		const s = utcInteger(g.start),
			e = utcInteger(g.end),
			m = count(g.missingBars, EVALUATION_LIMITS.seriesBars, 1);
		if (s <= previous || e <= s || e >= end || (s - start) % d || e - s !== m * d)
			throw new EvaluationError('INVALID_RECORD');
		previous = e;
		missing += m;
	}
	if (h.state !== (gaps.length ? 'gaps' : 'ready') || (end - start) / d !== n + missing)
		throw new EvaluationError('INVALID_RECORD');
	const i = record(r.ingestion);
	exact(i, ['requestId', 'ingestedAt', 'operation']);
	identifier(i.requestId);
	instant(i.ingestedAt);
	if (i.operation !== 'trading.ingest-fixture@1') throw new EvaluationError('INVALID_RECORD');
	return immutableCopy(r) as unknown as StoredSeries;
}
export function parseEvaluationRequest(v: unknown): EvaluationRequest {
	const r = record(v);
	schema(r, 'trading.evaluation-request@1');
	exact(r, [
		'schema',
		'methodVersionId',
		'bindings',
		'start',
		'end',
		'driverObservationId',
		'calculationRevision'
	]);
	identifier(r.methodVersionId);
	identifier(r.driverObservationId);
	const start = utcInteger(r.start),
		end = utcInteger(r.end);
	if (end <= start || end - start > EVALUATION_LIMITS.rangeMs)
		throw new EvaluationError('LIMIT_EXCEEDED');
	if (r.calculationRevision !== CALCULATION_REVISION)
		throw new EvaluationError('UNSUPPORTED_CALCULATION');
	const bindings = boundedArray(r.bindings, 32)
		.map((v) => {
			const b = record(v);
			exact(b, ['observationId', 'seriesId']);
			return { observationId: identifier(b.observationId), seriesId: fingerprintValue(b.seriesId) };
		})
		.sort((a, b) =>
			a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0
		);
	if (
		!bindings.length ||
		new Set(bindings.map((b) => b.observationId)).size !== bindings.length ||
		!bindings.some((b) => b.observationId === r.driverObservationId)
	)
		throw new EvaluationError('INCOMPATIBLE_BINDING');
	return immutableCopy({ ...r, bindings }) as unknown as EvaluationRequest;
}
export function parseEvaluationCommand(v: unknown): EvaluationCommand {
	const r = record(v);
	if (r.op === 'catalog') {
		exact(r, ['op']);
	} else if (r.op === 'install') {
		exact(r, ['op', 'requestId', 'fixtureRevision']);
		identifier(r.requestId);
		if (r.fixtureRevision !== '1') throw new EvaluationError('UNSUPPORTED_SCHEMA');
	} else if (r.op === 'start') {
		exact(r, ['op', 'requestId', 'request']);
		identifier(r.requestId);
		return immutableCopy({
			...r,
			request: parseEvaluationRequest(r.request)
		}) as unknown as EvaluationCommand;
	} else if (r.op === 'runs') {
		exact(r, ['op', 'methodVersionId']);
		if (r.methodVersionId !== null) identifier(r.methodVersionId);
	} else if (r.op === 'get') {
		exact(r, ['op', 'runId']);
		identifier(r.runId);
	} else if (r.op === 'bars') {
		exact(r, ['op', 'seriesId', 'start', 'end']);
		fingerprintValue(r.seriesId);
		if (utcInteger(r.end) <= utcInteger(r.start)) throw new EvaluationError('INVALID_REQUEST');
	} else throw new EvaluationError('INVALID_REQUEST');
	return immutableCopy(r) as unknown as EvaluationCommand;
}
export function composeRules(policy: 'all' | 'any', states: readonly RuleState[]): RuleState {
	if (!states.length) return 'unavailable';
	if (policy === 'all')
		return states.includes('false')
			? 'false'
			: states.includes('unavailable')
				? 'unavailable'
				: 'true';
	return states.includes('true')
		? 'true'
		: states.includes('unavailable')
			? 'unavailable'
			: 'false';
}
/** UTF-8 byte length without a browser or Node dependency. */
export function utf8Length(text: string): number {
	let bytes = 0;
	for (const char of text) {
		const n = char.codePointAt(0)!;
		bytes += n <= 0x7f ? 1 : n <= 0x7ff ? 2 : n <= 0xffff ? 3 : 4;
	}
	return bytes;
}
export function canonicalEvaluation(value: unknown): string {
	const visit = (v: unknown, depth: number): void => {
		if (depth > 32) throw new EvaluationError('LIMIT_EXCEEDED');
		if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0)))
			throw new EvaluationError('INVALID_RECORD');
		if (v === undefined || typeof v === 'function' || typeof v === 'bigint')
			throw new EvaluationError('INVALID_RECORD');
		if (v && typeof v === 'object') Object.values(v).forEach((x) => visit(x, depth + 1));
	};
	visit(value, 0);
	const canonical = stableJson(value);
	if (utf8Length(canonical) > EVALUATION_LIMITS.resultBytes)
		throw new EvaluationError('LIMIT_EXCEEDED');
	return canonical;
}
export function parseEvaluationIdentity(v: unknown): EvaluationIdentity {
	const r = record(v);
	schema(r, 'trading.evaluation-input@1');
	exact(r, [
		'schema',
		'methodVersionId',
		'methodFingerprint',
		'bindings',
		'start',
		'end',
		'driverObservationId',
		'calculations',
		'engine',
		'operation',
		'timeModel'
	]);
	identifier(r.methodVersionId);
	fingerprintValue(r.methodFingerprint);
	identifier(r.driverObservationId);
	const bindings = boundedArray(r.bindings, 32).map((v) => {
		const b = record(v);
		exact(b, ['observationId', 'seriesId', 'seriesFingerprint']);
		identifier(b.observationId);
		if (fingerprintValue(b.seriesId) !== fingerprintValue(b.seriesFingerprint))
			throw new EvaluationError('INVALID_RECORD');
		return b;
	});
	parseEvaluationRequest({
		schema: 'trading.evaluation-request@1',
		methodVersionId: r.methodVersionId,
		bindings: bindings.map((b) => ({ observationId: b.observationId, seriesId: b.seriesId })),
		start: r.start,
		end: r.end,
		driverObservationId: r.driverObservationId,
		calculationRevision: CALCULATION_REVISION
	});
	const pins = boundedArray(r.calculations, 64);
	const seen = new Set();
	for (const p of pins) {
		const c = record(p);
		exact(c, ['capabilityId', 'definitionRevision', 'calculationRevision']);
		identifier(c.capabilityId);
		identifier(c.definitionRevision);
		identifier(c.calculationRevision);
		const key = `${c.capabilityId}@${c.definitionRevision}`;
		if (seen.has(key)) throw new EvaluationError('INVALID_RECORD');
		seen.add(key);
	}
	textValue(r.engine, 96, true);
	textValue(r.operation, 96, true);
	if (r.timeModel !== 'utc-closed-previous-lookback@1') throw new EvaluationError('INVALID_RECORD');
	return immutableCopy(r) as unknown as EvaluationIdentity;
}
export function parseEvaluationRun(v: unknown): EvaluationRun {
	const r = record(v);
	schema(r, 'trading.evaluation-run@1');
	exact(r, [
		'schema',
		'id',
		'request',
		'inputFingerprint',
		'identity',
		'methodName',
		'versionNumber',
		'status',
		'revision',
		'createdAt',
		'startedAt',
		'finishedAt',
		'resultFingerprint',
		'failureCode'
	]);
	identifier(r.id);
	fingerprintValue(r.inputFingerprint);
	const request = parseEvaluationRequest(r.request),
		identity = parseEvaluationIdentity(r.identity);
	textValue(r.methodName, 120, true);
	count(r.versionNumber, 1000000, 1);
	count(r.revision, 1000000, 1);
	instant(r.createdAt);
	if (r.startedAt !== null) instant(r.startedAt);
	if (r.finishedAt !== null) instant(r.finishedAt);
	if (!['queued', 'running', 'succeeded', 'failed', 'interrupted'].includes(String(r.status)))
		throw new EvaluationError('INVALID_RECORD');
	if (r.resultFingerprint !== null) fingerprintValue(r.resultFingerprint);
	if (r.failureCode !== null && !Object.hasOwn(EVALUATION_ERRORS, String(r.failureCode)))
		throw new EvaluationError('INVALID_RECORD');
	if (
		(r.status === 'succeeded') !== (r.resultFingerprint !== null) ||
		['failed', 'interrupted'].includes(String(r.status)) !== (r.failureCode !== null) ||
		['succeeded', 'failed', 'interrupted'].includes(String(r.status)) !== (r.finishedAt !== null)
	)
		throw new EvaluationError('INVALID_RECORD');
	if (
		request.methodVersionId !== identity.methodVersionId ||
		request.start !== identity.start ||
		request.end !== identity.end ||
		request.driverObservationId !== identity.driverObservationId ||
		stableJson(request.bindings) !==
			stableJson(
				identity.bindings.map(({ observationId, seriesId }) => ({ observationId, seriesId }))
			)
	)
		throw new EvaluationError('INVALID_RECORD');
	return immutableCopy({ ...r, request, identity }) as unknown as EvaluationRun;
}
export function parseEvaluationContent(v: unknown): EvaluationContent {
	const r = record(v);
	schema(r, 'trading.evaluation-result@1');
	exact(r, ['schema', 'identity', 'method', 'frames', 'counts', 'declarations']);
	const identity = parseEvaluationIdentity(r.identity);
	const method = record(r.method);
	exact(method, ['name', 'number']);
	textValue(method.name, 120, true);
	count(method.number, 1000000, 1);
	const counts: Record<RuleState, number> = { true: 0, false: 0, unavailable: 0 };
	let previous = -1;
	const frames = boundedArray(r.frames, EVALUATION_LIMITS.frames);
	if (!frames.length) throw new EvaluationError('INVALID_RECORD');
	for (const value of frames) {
		const f = record(value);
		exact(f, ['time', 'state', 'outputs']);
		const time = utcInteger(f.time);
		if (
			time <= previous ||
			time < identity.start ||
			time >= identity.end ||
			!['true', 'false', 'unavailable'].includes(String(f.state))
		)
			throw new EvaluationError('INVALID_RECORD');
		previous = time;
		counts[f.state as RuleState]++;
		const ids = new Set();
		for (const output of boundedArray(f.outputs, 64)) {
			const o = record(output);
			exact(o, [
				'instanceId',
				'capabilityId',
				'definitionRevision',
				'calculationRevision',
				'kind',
				'state',
				'values',
				'diagnostics'
			]);
			identifier(o.instanceId);
			identifier(o.capabilityId);
			identifier(o.definitionRevision);
			identifier(o.calculationRevision);
			if (ids.has(o.instanceId)) throw new EvaluationError('INVALID_RECORD');
			ids.add(o.instanceId);
			if (
				!identity.calculations.some(
					(p) =>
						p.capabilityId === o.capabilityId &&
						p.definitionRevision === o.definitionRevision &&
						p.calculationRevision === o.calculationRevision
				)
			)
				throw new EvaluationError('INVALID_RECORD');
			if (
				o.kind === 'analysis'
					? !['available', 'unavailable'].includes(String(o.state))
					: o.kind !== 'rule' || !['true', 'false', 'unavailable'].includes(String(o.state))
			)
				throw new EvaluationError('INVALID_RECORD');
			const vals = record(o.values);
			if (Object.keys(vals).length > 4) throw new EvaluationError('INVALID_RECORD');
			for (const [k, n] of Object.entries(vals)) {
				identifier(k);
				if (typeof n !== 'number' || !Number.isFinite(n) || Object.is(n, -0))
					throw new EvaluationError('INVALID_RECORD');
			}
			const diagnostics = boundedArray(o.diagnostics, 4);
			for (const diag of diagnostics) {
				const d = record(diag);
				exact(d, ['code', 'instanceId', 'message']);
				if (
					!Object.hasOwn(CALCULATION_DIAGNOSTICS, String(d.code)) ||
					d.instanceId !== o.instanceId ||
					d.message !== CALCULATION_DIAGNOSTICS[d.code as DiagnosticCode]
				)
					throw new EvaluationError('INVALID_RECORD');
			}
			if (
				(o.state === 'unavailable') !== diagnostics.length > 0 ||
				(o.state === 'unavailable' && Object.keys(vals).length)
			)
				throw new EvaluationError('INVALID_RECORD');
		}
	}
	if (stableJson(counts) !== stableJson(r.counts)) throw new EvaluationError('INVALID_RECORD');
	const decl = record(r.declarations);
	exact(decl, ['judgment', 'risk', 'execution']);
	for (const category of ['judgment', 'risk', 'execution'])
		for (const item of boundedArray(decl[category], 64)) {
			const c = record(item);
			exact(c, ['id', 'capabilityId', 'revision', 'config']);
			identifier(c.id);
			identifier(c.capabilityId);
			identifier(c.revision);
			const config = record(c.config);
			if (Object.keys(config).length > 24) throw new EvaluationError('INVALID_RECORD');
			for (const [k, n] of Object.entries(config)) {
				identifier(k);
				if (
					!['string', 'boolean', 'number'].includes(typeof n) ||
					(typeof n === 'string' && n.length > 2000)
				)
					throw new EvaluationError('INVALID_RECORD');
			}
		}
	canonicalEvaluation(r);
	return immutableCopy(r) as unknown as EvaluationContent;
}
export function parseStoredResult(v: unknown): StoredEvaluationResult {
	const r = record(v);
	exact(r, ['fingerprint', 'inputFingerprint', 'canonical', 'content']);
	fingerprintValue(r.fingerprint);
	fingerprintValue(r.inputFingerprint);
	const content = parseEvaluationContent(r.content);
	if (r.canonical !== canonicalEvaluation(content)) throw new EvaluationError('INVALID_RECORD');
	return immutableCopy({ ...r, content }) as unknown as StoredEvaluationResult;
}
export function parseIngestionReceipt(v: unknown): IngestionReceipt {
	const r = record(v);
	exact(r, ['requestId', 'fixtureRevision', 'seriesIds', 'ingestedAt', 'durationMs', 'barCount']);
	identifier(r.requestId);
	if (r.fixtureRevision !== '1') throw new EvaluationError('INVALID_RECORD');
	boundedArray(r.seriesIds, EVALUATION_LIMITS.catalog).forEach(fingerprintValue);
	instant(r.ingestedAt);
	count(r.durationMs, 3600000);
	count(r.barCount, 300000, 1);
	return immutableCopy(r) as unknown as IngestionReceipt;
}
export function parseEvaluationReply(v: unknown): EvaluationReply {
	const r = record(v);
	if (r.kind === 'catalog') {
		exact(r, ['kind', 'series']);
		boundedArray(r.series, EVALUATION_LIMITS.catalog).forEach(parseStoredSeries);
	} else if (r.kind === 'ingestion') {
		exact(r, ['kind', 'receipt']);
		parseIngestionReceipt(r.receipt);
	} else if (r.kind === 'runs') {
		exact(r, ['kind', 'runs']);
		boundedArray(r.runs, EVALUATION_LIMITS.runs).forEach(parseEvaluationRun);
	} else if (r.kind === 'run') {
		exact(r, ['kind', 'run', 'result']);
		const run = parseEvaluationRun(r.run);
		if (r.result !== null) {
			const result = parseStoredResult(r.result);
			if (
				run.status !== 'succeeded' ||
				run.resultFingerprint !== result.fingerprint ||
				run.inputFingerprint !== result.inputFingerprint ||
				stableJson(run.identity) !== stableJson(result.content.identity)
			)
				throw new EvaluationError('INVALID_RECORD');
		} else if (run.status === 'succeeded') throw new EvaluationError('INVALID_RECORD');
	} else if (r.kind === 'bars') {
		exact(r, ['kind', 'series', 'bars']);
		parseStoredSeries(r.series);
		boundedArray(r.bars, EVALUATION_LIMITS.frames).forEach(parseStoredBar);
	} else throw new EvaluationError('INVALID_RECORD');
	return immutableCopy(r) as unknown as EvaluationReply;
}
export function pinnedMethod(v: unknown): MethodVersion {
	return parseVersion(v);
}
