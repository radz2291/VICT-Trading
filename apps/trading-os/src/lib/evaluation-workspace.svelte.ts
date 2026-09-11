import {
	immutableCopy,
	EVALUATION_ERRORS,
	type EvaluationClient,
	type EvaluationCommand,
	type EvaluationRun,
	type EvaluationRequest,
	type StoredSeries,
	type StoredEvaluationResult,
	type MethodVersion,
	type IngestionReceipt,
	type CalculationDiagnostic,
	type Bar
} from '@trading-os/trading-domain';
import type { EvaluationWorkspaceService } from '@trading-os/trading-surfaces';
export function createEvaluationWorkspace(client: EvaluationClient): EvaluationWorkspaceService {
	let series = $state<readonly StoredSeries[]>([]),
		runs = $state<readonly EvaluationRun[]>([]),
		run = $state<EvaluationRun | null>(null),
		result = $state<StoredEvaluationResult | null>(null),
		selectedVersion = $state<MethodVersion | null>(null);
	let catalogState = $state<EvaluationWorkspaceService['catalogState']>('idle'),
		state = $state<EvaluationWorkspaceService['state']>('idle'),
		installing = $state(false),
		message = $state(''),
		diagnostics = $state<readonly CalculationDiagnostic[]>([]),
		receipt = $state<IngestionReceipt | null>(null);
	let chartBars = $state<readonly Bar[]>([]),
		chartSeries = $state<StoredSeries | null>(null),
		chartState = $state<EvaluationWorkspaceService['chartState']>('idle');
	let pending: EvaluationCommand | null = null,
		seq = 0,
		chartSeq = 0,
		runsSeq = 0,
		catalogSeq = 0,
		disposed = false,
		timer: ReturnType<typeof setTimeout> | undefined;
	const active = (r: EvaluationRun) => r.status === 'queued' || r.status === 'running';
	function accept(next: EvaluationRun, value: StoredEvaluationResult | null) {
		run = next;
		result = value;
		runs = [next, ...runs.filter((r) => r.id !== next.id)].slice(0, 100);
		state = next.status === 'failed' || next.status === 'interrupted' ? 'failed' : 'ready';
		message = next.failureCode ? EVALUATION_ERRORS[next.failureCode] : '';
	}
	function poll() {
		if (disposed || timer) return;
		if (!runs.some(active)) return;
		timer = setTimeout(() => {
			timer = undefined;
			void refreshRuns();
		}, 300);
	}
	async function refreshRuns() {
		const token = ++runsSeq;
		const response = await client.execute({ op: 'runs', methodVersionId: null });
		if (disposed || token !== runsSeq) return;
		if (response.ok && response.value.kind === 'runs') {
			runs = response.value.runs;
			if (run && active(run)) {
				const updated = runs.find((r) => r.id === run!.id);
				if (updated && !active(updated)) await openRun(updated.id);
				else if (updated) run = updated;
			}
			poll();
		} else {
			message = response.ok ? 'Evaluation status unavailable.' : response.message;
			state = 'failed'; /* Stop automatic polling on error; explicit refresh/retry is bounded. */
		}
	}
	async function load() {
		const token = ++catalogSeq;
		catalogState = 'loading';
		const response = await client.execute({ op: 'catalog' });
		if (disposed || token !== catalogSeq) return;
		if (response.ok && response.value.kind === 'catalog') {
			series = response.value.series;
			catalogState = 'ready';
		} else {
			series = [];
			catalogState = 'failed';
			message = response.ok ? 'Data catalog unavailable.' : response.message;
		}
		await refreshRuns();
	}
	async function openRun(id: string) {
		if (installing || state === 'starting') return;
		const token = ++seq;
		state = 'loading';
		run = null;
		result = null;
		message = '';
		diagnostics = [];
		const response = await client.execute({ op: 'get', runId: id });
		if (disposed || token !== seq) return;
		if (response.ok && response.value.kind === 'run') {
			accept(response.value.run, response.value.result);
			poll();
		} else {
			state = 'failed';
			message = response.ok ? 'Result unavailable.' : response.message;
		}
	}
	async function submit(command: EvaluationCommand) {
		if (state === 'starting' || installing) return;
		const token = ++seq;
		pending = immutableCopy(command);
		message = '';
		diagnostics = [];
		if (command.op === 'install') installing = true;
		else {
			state = 'starting';
			run = null;
			result = null;
		}
		const response = await client.execute(command);
		if (disposed || token !== seq) return;
		installing = false;
		if (!response.ok) {
			if (response.code !== 'PERSISTENCE_FAILED') pending = null;
			state = 'failed';
			message = response.message;
			diagnostics = response.diagnostics;
			return;
		}
		pending = null;
		if (response.value.kind === 'ingestion') {
			receipt = response.value.receipt;
			state = 'ready';
			await load();
		} else if (response.value.kind === 'run') {
			accept(response.value.run, response.value.result);
			poll();
		}
	}
	return {
		get series() {
			return series;
		},
		get runs() {
			return runs;
		},
		get catalogState() {
			return catalogState;
		},
		get state() {
			return state;
		},
		get installing() {
			return installing;
		},
		get message() {
			return message;
		},
		get diagnostics() {
			return diagnostics;
		},
		get selectedVersion() {
			return selectedVersion;
		},
		get run() {
			return run;
		},
		get result() {
			return result;
		},
		get receipt() {
			return receipt;
		},
		get activeRuns() {
			return runs.filter(active);
		},
		get chartBars() {
			return chartBars;
		},
		get chartSeries() {
			return chartSeries;
		},
		get chartState() {
			return chartState;
		},
		load,
		refreshRuns,
		openRun,
		async install() {
			await submit(
				pending?.op === 'install'
					? pending
					: { op: 'install', requestId: crypto.randomUUID(), fixtureRevision: '1' }
			);
		},
		configure(v) {
			if (state === 'starting' || installing) return;
			seq++;
			selectedVersion = v;
			run = null;
			result = null;
			state = 'idle';
			message = '';
			diagnostics = [];
		},
		async start(request: EvaluationRequest) {
			if (pending) {
				message = 'Retry the unconfirmed request before starting another evaluation.';
				return;
			}
			await submit({ op: 'start', requestId: crypto.randomUUID(), request });
		},
		async retry() {
			if (pending) await submit(pending);
			else if (run) await openRun(run.id);
			else await load();
		},
		async loadChart(seriesId, start, end) {
			const token = ++chartSeq;
			chartState = 'loading';
			chartBars = [];
			chartSeries = null;
			const response = await client.execute({ op: 'bars', seriesId, start, end });
			if (disposed || token !== chartSeq) return;
			if (response.ok && response.value.kind === 'bars') {
				chartBars = response.value.bars;
				chartSeries = response.value.series;
				chartState = 'ready';
			} else chartState = 'failed';
		},
		dispose() {
			disposed = true;
			seq++;
			chartSeq++;
			if (timer) clearTimeout(timer);
		}
	};
}
