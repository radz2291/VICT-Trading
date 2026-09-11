import { createRuntime } from '@victframework/runtime';
import { defineCapability, defineGraph } from '@victframework/sdk';
import {
	EvaluationError,
	MethodError,
	EVALUATION_ERRORS,
	EVALUATION_LIMITS,
	parseEvaluationCommand,
	parseEvaluationRun,
	parseEvaluationReply,
	canonicalEvaluation,
	stableJson,
	type EvaluationRepository,
	type MethodRepository,
	type EvaluationService,
	type EvaluationReply,
	type EvaluationResponse,
	type EvaluationRun,
	type EvaluationCommand,
	type CapabilityCatalog
} from '@trading-os/trading-domain';
import { sha256 } from '@trading-os/trading-data/evaluation-store';
import { deterministicFixture } from '@trading-os/trading-data/evaluation-fixture';
import {
	createCalculationRegistry,
	evaluateMethod,
	evaluationIdentity,
	evaluationTimeline,
	inputQueryBounds,
	type CalculationRegistry
} from '@trading-os/trading-capabilities/calculations';
import {
	evaluationCommandContract,
	evaluationReplyContract,
	EVALUATION_CAPABILITIES
} from '../application/evaluation-actions';

export function createEvaluationService(
	repository: EvaluationRepository,
	methods: MethodRepository,
	catalog: CapabilityCatalog,
	options: {
		grants: readonly string[];
		registry?: CalculationRegistry;
		onGovernedEvent?: (event: { capabilityId: string; type: string }) => void;
	}
): EvaluationService {
	const registry = options.registry ?? createCalculationRegistry();
	const jobs = new Map<string, Promise<void>>();
	const now = () => new Date().toISOString();
	repository.recover(now());
	function failure(error: unknown): EvaluationResponse {
		const code =
			error instanceof EvaluationError
				? error.code
				: error instanceof MethodError && error.code === 'NOT_FOUND'
					? 'NOT_FOUND'
					: 'PERSISTENCE_FAILED';
		return {
			ok: false,
			code,
			message: EVALUATION_ERRORS[code],
			diagnostics: error instanceof EvaluationError ? error.diagnostics : []
		};
	}
	function version(id: string) {
		const v = methods.transaction((tx) => tx.getVersion(id));
		if (!v) throw new EvaluationError('NOT_FOUND');
		return v;
	}
	function reply(run: EvaluationRun): EvaluationReply {
		const result = run.resultFingerprint ? repository.getResult(run.resultFingerprint) : null;
		return parseEvaluationReply({ kind: 'run', run, result });
	}
	async function governed(
		command: EvaluationCommand,
		capability: {
			id: string;
			revision: string;
			effect: 'read' | 'write';
			permissions: readonly string[];
		},
		handler: () => Promise<EvaluationReply> | EvaluationReply
	): Promise<EvaluationReply> {
		let captured: unknown;
		const runtime = createRuntime({
			authority: { grants: options.grants },
			payloadRetention: 'none',
			maxSteps: 1
		});
		runtime.registerCapability(
			defineCapability({
				id: capability.id,
				revision: capability.revision,
				effect: capability.effect,
				permissions: capability.permissions,
				...(capability.effect === 'write' ? { idempotency: 'keyed' as const } : {}),
				input: evaluationCommandContract,
				output: evaluationReplyContract,
				invoke: async () => {
					try {
						return await handler();
					} catch (error) {
						captured = error;
						throw error;
					}
				}
			})
		);
		const activated = await runtime.activate(
			defineGraph({
				id: `${capability.id}.graph`,
				entry: 'operation',
				nodes: [{ id: 'operation', capability: capability.id }],
				edges: []
			})
		);
		if (!activated.ok) throw new EvaluationError('CALCULATION_FAILED');
		const result = await runtime.run<EvaluationReply>(command, {
			onEvent: (event) =>
				options.onGovernedEvent?.({ capabilityId: capability.id, type: event.type })
		});
		if (result.status !== 'completed' || !result.output) {
			if (captured) throw captured;
			if (!capability.permissions.every((p) => options.grants.includes(p)))
				throw new EvaluationError('DENIED');
			throw new EvaluationError('CALCULATION_FAILED');
		}
		return parseEvaluationReply(result.output);
	}
	function enqueue(command: Extract<EvaluationCommand, { op: 'start' }>): void {
		if (jobs.has(command.requestId)) return;
		const task = new Promise<void>((resolve) => setImmediate(resolve))
			.then(async () => {
				let active = repository.getRun(command.requestId);
				if (!active || active.status !== 'queued') return;
				try {
					await governed(
						command,
						{
							id: 'trading.evaluate',
							revision: '1',
							effect: 'write',
							permissions: ['evaluation.write', 'market.read']
						},
						() => {
							active = repository.transition(active!.id, active!.revision, 'running', now());
							const v = version(active.request.methodVersionId);
							const inputs = [...new Set(active.request.bindings.map((b) => b.seriesId))].map(
								(id) => {
									const series = repository.getSeries(id);
									if (!series) throw new EvaluationError('NOT_FOUND');
									return {
										series,
										bars: repository.readBars({
											seriesId: id,
											...inputQueryBounds(active!.request, series, v)
										})
									};
								}
							);
							if (inputs.reduce((n, i) => n + i.bars.length, 0) > EVALUATION_LIMITS.totalInputBars)
								throw new EvaluationError('LIMIT_EXCEEDED');
							const content = evaluateMethod(v, active.request, inputs, catalog, registry),
								canonical = canonicalEvaluation(content);
							const result = {
								content,
								canonical,
								inputFingerprint: sha256(canonicalEvaluation(content.identity)),
								fingerprint: sha256(canonical)
							};
							active = repository.complete(active.id, active.revision, result, now());
							return reply(active);
						}
					);
				} catch (error) {
					// A commit whose acknowledgement was lost is re-read before recording failure.
					const current = repository.getRun(command.requestId);
					if (current && (current.status === 'queued' || current.status === 'running'))
						repository.transition(
							current.id,
							current.revision,
							'failed',
							now(),
							error instanceof EvaluationError ? error.code : 'CALCULATION_FAILED'
						);
				}
			})
			.finally(() => jobs.delete(command.requestId));
		jobs.set(command.requestId, task);
		// Failures of the persistence channel remain queued/running until restart recovery;
		// no unhandled rejection and no false success. get/retry verifies stored truth.
		void task.catch(() => undefined);
	}
	return {
		async execute(input: unknown): Promise<EvaluationResponse> {
			try {
				const command = parseEvaluationCommand(input);
				const capability =
					command.op === 'install'
						? EVALUATION_CAPABILITIES[1]
						: command.op === 'start'
							? EVALUATION_CAPABILITIES[2]
							: EVALUATION_CAPABILITIES[0];
				const value = await governed(command, capability, () => {
					if (command.op === 'catalog') return { kind: 'catalog', series: repository.listSeries() };
					if (command.op === 'install') {
						const old = repository.getIngestion(command.requestId);
						if (old) {
							if (old.fixtureRevision !== command.fixtureRevision)
								throw new EvaluationError('IDEMPOTENCY_CONFLICT');
							return { kind: 'ingestion', receipt: old };
						}
						return {
							kind: 'ingestion',
							receipt: repository.ingest(
								command.requestId,
								command.fixtureRevision,
								deterministicFixture(),
								now()
							)
						};
					}
					if (command.op === 'runs')
						return { kind: 'runs', runs: repository.listRuns(command.methodVersionId) };
					if (command.op === 'get') {
						const run = repository.getRun(command.runId);
						if (!run) throw new EvaluationError('NOT_FOUND');
						return reply(run);
					}
					if (command.op === 'bars') {
						const series = repository.getSeries(command.seriesId);
						if (!series) throw new EvaluationError('NOT_FOUND');
						return {
							kind: 'bars',
							series,
							bars: repository.readBars({
								seriesId: series.id,
								start: command.start,
								end: command.end,
								limit: EVALUATION_LIMITS.frames
							})
						};
					}
					const existing = repository.getRun(command.requestId);
					if (existing) {
						if (stableJson(existing.request) !== stableJson(command.request))
							throw new EvaluationError('IDEMPOTENCY_CONFLICT');
						return reply(existing);
					}
					if (
						jobs.size >= 2 ||
						repository.listRuns(null).filter((r) => r.status === 'queued' || r.status === 'running')
							.length >= 2
					)
						throw new EvaluationError('LIMIT_EXCEEDED');
					const v = version(command.request.methodVersionId),
						series = command.request.bindings.map((b) => {
							const s = repository.getSeries(b.seriesId);
							if (!s) throw new EvaluationError('NOT_FOUND');
							return s;
						});
					const identity = evaluationIdentity(v, command.request, series, catalog, registry);
					const driver = series.find(
						(s) =>
							s.id ===
							command.request.bindings.find(
								(b) => b.observationId === command.request.driverObservationId
							)!.seriesId
					)!;
					evaluationTimeline(command.request, driver);
					const run = parseEvaluationRun({
						schema: 'trading.evaluation-run@1',
						id: command.requestId,
						request: command.request,
						identity,
						inputFingerprint: sha256(canonicalEvaluation(identity)),
						methodName: v.content.name,
						versionNumber: v.number,
						status: 'queued',
						revision: 1,
						createdAt: now(),
						startedAt: null,
						finishedAt: null,
						resultFingerprint: null,
						failureCode: null
					});
					return reply(repository.createRun(run));
				});
				if (command.op === 'start' && value.kind === 'run' && value.run.status === 'queued')
					enqueue(command);
				return { ok: true, value };
			} catch (error) {
				return failure(error);
			}
		},
		async drain() {
			await Promise.allSettled([...jobs.values()]);
		}
	};
}
