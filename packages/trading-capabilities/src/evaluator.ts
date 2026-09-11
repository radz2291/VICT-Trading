import {
	CALCULATION_REVISION,
	ENGINE_REVISION,
	EVALUATION_OPERATION,
	EVALUATION_LIMITS,
	CALCULATION_DIAGNOSTICS,
	EvaluationError,
	composeRules,
	immutableCopy,
	parseEvaluationRequest,
	parseEvaluationContent,
	parseStoredSeries,
	parseStoredBar,
	parseVersion,
	validateMethod,
	canonicalEvaluation,
	type Bar,
	type CapabilityCatalog,
	type CapabilityInstance,
	type CapabilityOutput,
	type CalculationPin,
	type DiagnosticCode,
	type EvaluationIdentity,
	type EvaluationRequest,
	type EvaluationContent,
	type MethodVersion,
	type SeriesInput,
	type StoredSeries,
	type RuleState
} from '@trading-os/trading-domain';

export interface CalculationContext {
	readonly instance: CapabilityInstance;
	readonly time: number;
	readonly current: Bar | null;
	readonly previous: readonly Bar[];
	readonly unavailable: DiagnosticCode | null;
	readonly source: CapabilityOutput | undefined;
}
export interface Calculation {
	readonly capabilityId: string;
	readonly definitionRevision: string;
	readonly revision: string;
	readonly kind: 'analysis' | 'rule';
	calculate(context: CalculationContext): {
		readonly values?: Readonly<Record<string, number>>;
		readonly state?: RuleState;
		readonly unavailable?: DiagnosticCode;
	};
}
export interface CalculationRegistry {
	readonly pins: readonly CalculationPin[];
	resolve(
		id: string,
		definitionRevision: string,
		calculationRevision: string
	): Calculation | undefined;
}
/** Exact, immutable registry. No mutable latest entry and no ambient I/O. */
export function createCalculationRegistry(
	definitions: readonly Calculation[] = CALCULATIONS
): CalculationRegistry {
	const entries = new Map<string, Calculation>();
	for (const c of definitions) {
		const key = `${c.capabilityId}@${c.definitionRevision}/${c.revision}`;
		if (
			entries.has(key) ||
			!c.revision ||
			!c.capabilityId ||
			!c.definitionRevision ||
			!['analysis', 'rule'].includes(c.kind) ||
			typeof c.calculate !== 'function'
		)
			throw new TypeError('Invalid calculation registry');
		entries.set(key, Object.freeze({ ...c }));
	}
	return Object.freeze({
		pins: immutableCopy(
			definitions.map((c) => ({
				capabilityId: c.capabilityId,
				definitionRevision: c.definitionRevision,
				calculationRevision: c.revision
			}))
		),
		resolve: (id: string, definition: string, revision: string) =>
			entries.get(`${id}@${definition}/${revision}`)
	});
}
const base = { definitionRevision: '1', revision: CALCULATION_REVISION } as const;
const CALCULATIONS: readonly Calculation[] = Object.freeze([
	{
		...base,
		capabilityId: 'analysis.range',
		kind: 'analysis',
		calculate: ({ previous }) => ({
			values: {
				high: Math.max(...previous.map((b) => b.high)),
				low: Math.min(...previous.map((b) => b.low))
			}
		})
	},
	{
		...base,
		capabilityId: 'analysis.mean',
		kind: 'analysis',
		calculate: ({ previous, instance }) => ({
			values: {
				mean:
					previous.reduce(
						(sum, b) => sum + b[instance.config.price as 'close' | 'open' | 'high' | 'low'],
						0
					) / previous.length
			}
		})
	},
	{
		...base,
		capabilityId: 'rule.range-relation',
		kind: 'rule',
		calculate: ({ current, source, instance }) => {
			if (
				source?.state !== 'available' ||
				source.values.high === undefined ||
				source.values.low === undefined
			)
				return { unavailable: 'DEPENDENCY_UNAVAILABLE' };
			const p = current!.close,
				{ high, low } = source.values;
			const pass =
				instance.config.relation === 'above-high'
					? p > high
					: instance.config.relation === 'below-low'
						? p < low
						: p >= low && p <= high;
			return { state: pass ? 'true' : 'false', values: { close: p, high, low } };
		}
	},
	{
		...base,
		capabilityId: 'rule.mean-distance',
		kind: 'rule',
		calculate: ({ current, source, instance }) => {
			if (source?.state !== 'available' || source.values.mean === undefined)
				return { unavailable: 'DEPENDENCY_UNAVAILABLE' };
			const mean = source.values.mean;
			if (mean === 0) return { unavailable: 'ZERO_MEAN' };
			const distance =
				((instance.config.side === 'above' ? current!.close - mean : mean - current!.close) /
					Math.abs(mean)) *
				100;
			return {
				state: distance >= Number(instance.config.distancePercent) ? 'true' : 'false',
				values: { close: current!.close, mean, distancePercent: distance }
			};
		}
	},
	{
		...base,
		capabilityId: 'rule.session-window',
		kind: 'rule',
		calculate: ({ time, instance }) => {
			const start = (
				{ '00:00–08:00': 0, '08:00–16:00': 8, '16:00–24:00': 16 } as Record<string, number>
			)[String(instance.config.session)]!;
			const hour = (time % 86400000) / 3600000;
			return {
				state: hour >= start && hour < start + 8 ? 'true' : 'false',
				values: { utcHour: hour }
			};
		}
	}
]);

export function evaluationIdentity(
	version: MethodVersion,
	request: EvaluationRequest,
	series: readonly StoredSeries[],
	catalog: CapabilityCatalog,
	registry: CalculationRegistry
): EvaluationIdentity {
	const v = parseVersion(version),
		r = parseEvaluationRequest(request);
	if (v.id !== r.methodVersionId || validateMethod(v.content, catalog).length)
		throw new EvaluationError('INVALID_REQUEST');
	const bindings = r.bindings.map((b) => {
		const observation = v.content.observations.find((o) => o.id === b.observationId),
			s = series.find((s) => s.id === b.seriesId);
		if (
			!observation ||
			!s ||
			s.instrument !== observation.instrument ||
			s.timeframe !== observation.timeframe
		)
			throw new EvaluationError('INCOMPATIBLE_BINDING');
		parseStoredSeries(s);
		return { ...b, seriesFingerprint: s.fingerprint };
	});
	if (bindings.length !== v.content.observations.length)
		throw new EvaluationError('INCOMPATIBLE_BINDING');
	const calculations: CalculationPin[] = [];
	for (const instance of v.content.capabilities) {
		const definition = catalog.resolve(instance.capabilityId, instance.revision)!;
		if (definition.category !== 'analysis' && definition.category !== 'rule') continue;
		const calculation = registry.resolve(
			instance.capabilityId,
			instance.revision,
			r.calculationRevision
		);
		if (!calculation || calculation.kind !== definition.category)
			throw new EvaluationError('UNSUPPORTED_CALCULATION', [
				{
					code: 'UNSUPPORTED_CALCULATION',
					instanceId: instance.id,
					message: CALCULATION_DIAGNOSTICS.UNSUPPORTED_CALCULATION
				}
			]);
		if (
			!calculations.some(
				(c) =>
					c.capabilityId === instance.capabilityId && c.definitionRevision === instance.revision
			)
		)
			calculations.push({
				capabilityId: instance.capabilityId,
				definitionRevision: instance.revision,
				calculationRevision: calculation.revision
			});
	}
	calculations.sort((a, b) =>
		`${a.capabilityId}@${a.definitionRevision}` < `${b.capabilityId}@${b.definitionRevision}`
			? -1
			: 1
	);
	return immutableCopy({
		schema: 'trading.evaluation-input@1',
		methodVersionId: v.id,
		methodFingerprint: v.fingerprint,
		bindings,
		start: r.start,
		end: r.end,
		driverObservationId: r.driverObservationId,
		calculations,
		engine: ENGINE_REVISION,
		operation: EVALUATION_OPERATION,
		timeModel: 'utc-closed-previous-lookback@1'
	});
}
/** Closed-bar alignment is independent of strategy vocabulary and wall clock. */
export function expectedOpen(time: number, series: StoredSeries): number {
	return (
		Math.floor((time - series.alignmentMs) / series.durationMs) * series.durationMs +
		series.alignmentMs -
		series.durationMs
	);
}
export function evaluationTimeline(
	request: EvaluationRequest,
	driver: StoredSeries
): readonly number[] {
	const first =
		Math.ceil((request.start - driver.alignmentMs) / driver.durationMs) * driver.durationMs +
		driver.alignmentMs;
	const n = Math.max(0, Math.ceil((request.end - first) / driver.durationMs));
	if (n < 1 || n > EVALUATION_LIMITS.frames) throw new EvaluationError('LIMIT_EXCEEDED');
	return Object.freeze(Array.from({ length: n }, (_, i) => first + i * driver.durationMs));
}
export function inputQueryBounds(
	request: EvaluationRequest,
	series: StoredSeries,
	version: MethodVersion
): { start: number; end: number; limit: number } {
	const observations = request.bindings
		.filter((b) => b.seriesId === series.id)
		.map((b) => b.observationId);
	const lookback = Math.max(
		0,
		...version.content.capabilities
			.filter((c) => observations.includes(String(c.config.context)))
			.map((c) => (typeof c.config.lookback === 'number' ? c.config.lookback : 0))
	);
	const start = Math.max(
		series.coverage.start,
		expectedOpen(request.start, series) - lookback * series.durationMs
	);
	const end = Math.min(series.coverage.end, request.end);
	return {
		start: Math.max(0, start),
		end: Math.max(start, end),
		limit: EVALUATION_LIMITS.inputBars
	};
}
/** One canonical evaluator. Inputs are loaded once by the composition root, never by this core. */
export function evaluateMethod(
	version: MethodVersion,
	request: EvaluationRequest,
	inputs: readonly SeriesInput[],
	catalog: CapabilityCatalog,
	registry: CalculationRegistry
): EvaluationContent {
	const identity = evaluationIdentity(
		version,
		request,
		inputs.map((i) => i.series),
		catalog,
		registry
	);
	if (
		new Set(inputs.map((i) => i.series.id)).size !== inputs.length ||
		inputs.reduce((n, i) => n + i.bars.length, 0) > EVALUATION_LIMITS.totalInputBars
	)
		throw new EvaluationError('LIMIT_EXCEEDED');
	const indexed = new Map<string, { series: StoredSeries; bars: Map<number, Bar> }>();
	for (const input of inputs) {
		if (input.bars.length > EVALUATION_LIMITS.inputBars)
			throw new EvaluationError('LIMIT_EXCEEDED');
		const bars = new Map<number, Bar>();
		let prev = -1;
		for (const value of input.bars) {
			const b = parseStoredBar(value);
			if (
				b.time <= prev ||
				(b.time - input.series.alignmentMs) % input.series.durationMs ||
				b.time < input.series.coverage.start ||
				b.time >= input.series.coverage.end
			)
				throw new EvaluationError('INVALID_RECORD');
			prev = b.time;
			bars.set(b.time, b);
		}
		indexed.set(input.series.id, { series: input.series, bars });
	}
	const driver = indexed.get(
		request.bindings.find((b) => b.observationId === request.driverObservationId)!.seriesId
	)!;
	const counts: Record<RuleState, number> = { true: 0, false: 0, unavailable: 0 };
	const declarations: {
		judgment: CapabilityInstance[];
		risk: CapabilityInstance[];
		execution: CapabilityInstance[];
	} = { judgment: [], risk: [], execution: [] };
	for (const instance of version.content.capabilities) {
		const category = catalog.resolve(instance.capabilityId, instance.revision)!.category;
		if (category === 'judgment' || category === 'risk' || category === 'execution')
			declarations[category].push(instance);
	}
	const frames = evaluationTimeline(request, driver.series).map((time) => {
		const outputs: CapabilityOutput[] = [];
		for (const instance of version.content.capabilities) {
			const calculation = registry.resolve(
				instance.capabilityId,
				instance.revision,
				request.calculationRevision
			);
			if (!calculation) continue;
			const binding = request.bindings.find((b) => b.observationId === instance.config.context)!;
			const input = indexed.get(binding.seriesId)!;
			const open = expectedOpen(time, input.series),
				current = input.bars.get(open) ?? null;
			let unavailable: DiagnosticCode | null = current
				? null
				: open < input.series.coverage.start || open >= input.series.coverage.end
					? 'OUTSIDE_COVERAGE'
					: 'MISSING_DATA';
			const previous: Bar[] = [];
			const n = calculation.kind === 'analysis' ? Number(instance.config.lookback) : 0;
			if (!unavailable)
				for (let i = n; i >= 1; i--) {
					const t = open - i * input.series.durationMs,
						b = input.bars.get(t);
					if (t < input.series.coverage.start) {
						unavailable = 'WARM_UP';
						break;
					}
					if (!b) {
						unavailable = 'MISSING_DATA';
						break;
					}
					previous.push(b);
				}
			let values: Record<string, number> = {},
				state: CapabilityOutput['state'] = 'unavailable';
			if (!unavailable) {
				const result = calculation.calculate({
					instance,
					time,
					current,
					previous: Object.freeze(previous),
					unavailable: null,
					source: outputs.find((o) => o.instanceId === instance.config.source)
				});
				unavailable = result.unavailable ?? null;
				if (!unavailable) {
					values = { ...(result.values ?? {}) };
					if (Object.values(values).some((n) => !Number.isFinite(n))) unavailable = 'NON_FINITE';
					else {
						for (const key of Object.keys(values)) if (Object.is(values[key], -0)) values[key] = 0;
						state = calculation.kind === 'analysis' ? 'available' : (result.state ?? 'unavailable');
					}
				}
			}
			if (unavailable) {
				values = {};
				state = 'unavailable';
			}
			const output: CapabilityOutput = immutableCopy({
				instanceId: instance.id,
				capabilityId: instance.capabilityId,
				definitionRevision: instance.revision,
				calculationRevision: calculation.revision,
				kind: calculation.kind,
				state,
				values,
				diagnostics: unavailable
					? [
							{
								code: unavailable,
								instanceId: instance.id,
								message: CALCULATION_DIAGNOSTICS[unavailable]
							}
						]
					: []
			});
			outputs.push(output);
		}
		const state = composeRules(
			version.content.rulePolicy,
			outputs.filter((o) => o.kind === 'rule').map((o) => o.state as RuleState)
		);
		counts[state]++;
		return { time, state, outputs };
	});
	const content = parseEvaluationContent({
		schema: 'trading.evaluation-result@1',
		identity,
		method: { name: version.content.name, number: version.number },
		frames,
		counts,
		declarations
	});
	canonicalEvaluation(content);
	return content;
}
