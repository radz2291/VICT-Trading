import type {
	Bar,
	CalculationDiagnostic,
	EvaluationRequest,
	EvaluationRun,
	IngestionReceipt,
	MethodVersion,
	StoredEvaluationResult,
	StoredSeries
} from '@trading-os/trading-domain';
export interface EvaluationWorkspaceService {
	readonly series: readonly StoredSeries[];
	readonly runs: readonly EvaluationRun[];
	readonly catalogState: 'idle' | 'loading' | 'ready' | 'failed';
	readonly state: 'idle' | 'loading' | 'starting' | 'ready' | 'failed';
	readonly installing: boolean;
	readonly message: string;
	readonly diagnostics: readonly CalculationDiagnostic[];
	readonly selectedVersion: MethodVersion | null;
	readonly run: EvaluationRun | null;
	readonly result: StoredEvaluationResult | null;
	readonly receipt: IngestionReceipt | null;
	readonly activeRuns: readonly EvaluationRun[];
	readonly chartBars: readonly Bar[];
	readonly chartSeries: StoredSeries | null;
	readonly chartState: 'idle' | 'loading' | 'ready' | 'failed';
	load(): Promise<void>;
	install(): Promise<void>;
	configure(version: MethodVersion): void;
	start(request: EvaluationRequest): Promise<void>;
	retry(): Promise<void>;
	openRun(id: string): Promise<void>;
	loadChart(seriesId: string, start: number, end: number): Promise<void>;
	refreshRuns(): Promise<void>;
	dispose(): void;
}
