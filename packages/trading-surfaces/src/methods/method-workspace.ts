import type {
	CapabilityCatalog,
	Diagnostic,
	Method,
	MethodContent,
	MethodDetail,
	MethodVersion,
	VersionComparison,
	WorkspaceProfile
} from '@trading-os/trading-domain';
export type AuthoringState =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'dirty'
	| 'saving'
	| 'saved'
	| 'failed'
	| 'conflict';
export interface MethodWorkspaceService {
	readonly catalog: CapabilityCatalog;
	readonly methods: readonly Method[];
	readonly detail: MethodDetail | null;
	readonly content: MethodContent | null;
	readonly selectedVersion: MethodVersion | null;
	readonly comparison: VersionComparison | null;
	readonly profile: WorkspaceProfile | null;
	readonly profileLabel?: string;
	readonly profileState: 'loading' | 'ready' | 'failed';
	readonly state: AuthoringState;
	readonly message: string;
	readonly dirty: boolean;
	readonly diagnostics: readonly Diagnostic[];
	readonly validated: boolean;
	readonly recovery: MethodContent | null;
	load(): Promise<void>;
	open(id: string): Promise<void>;
	create(name: string): Promise<boolean>;
	change(content: MethodContent): void;
	save(): Promise<boolean>;
	validate(): Promise<boolean>;
	freeze(): Promise<boolean>;
	revise(versionId: string): Promise<boolean>;
	clone(versionId: string, name: string): Promise<boolean>;
	selectVersion(id: string): void;
	compare(left: string, right: string): Promise<void>;
	assign(versionId: string | null): Promise<boolean>;
	reload(): Promise<void>;
	restoreRecovery(): void;
	retry(): Promise<boolean>;
}
