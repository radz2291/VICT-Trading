/** Definition-only Method contracts. No market data or evaluation behavior. */
export const METHOD_CONTENT_SCHEMA = 'trading.method-content@1' as const;
export type Scalar = string | number | boolean;
export interface Diagnostic {
	readonly code: string;
	readonly path: string;
	readonly message: string;
}
export type MethodErrorCode =
	| 'INVALID_REQUEST'
	| 'UNSUPPORTED_SCHEMA'
	| 'INVALID_RECORD'
	| 'VALIDATION_FAILED'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'IDEMPOTENCY_CONFLICT'
	| 'PERSISTENCE_FAILED'
	| 'DENIED';
export class MethodError extends Error {
	constructor(
		readonly code: MethodErrorCode,
		readonly diagnostics: readonly Diagnostic[] = []
	) {
		super(METHOD_ERROR_MESSAGES[code]);
		this.name = 'MethodError';
	}
}
export const METHOD_ERROR_MESSAGES: Record<MethodErrorCode, string> = {
	INVALID_REQUEST: 'The request is malformed or exceeds an authoring limit.',
	UNSUPPORTED_SCHEMA: 'This schema is not supported by this build. No data was changed.',
	INVALID_RECORD: 'The stored record is unavailable or malformed. No data was changed.',
	VALIDATION_FAILED: 'Resolve the definition diagnostics before creating a version.',
	NOT_FOUND: 'The requested Method, draft, or version is unavailable.',
	CONFLICT: 'Newer state exists. Your changes were not applied. Reload and reconcile your draft.',
	IDEMPOTENCY_CONFLICT: 'This request identity was already used with different content.',
	PERSISTENCE_FAILED: 'Persistence could not be confirmed. Retain your changes and retry.',
	DENIED: 'This action is not permitted.'
};
export interface Observation {
	readonly id: string;
	readonly label: string;
	readonly instrument: string;
	readonly timeframe: string;
	readonly dataType: 'bars';
}
export interface CapabilityInstance {
	readonly id: string;
	readonly capabilityId: string;
	readonly revision: string;
	readonly config: Readonly<Record<string, Scalar>>;
}
export interface MethodContent {
	readonly schema: typeof METHOD_CONTENT_SCHEMA;
	readonly name: string;
	readonly description: string;
	readonly observations: readonly Observation[];
	/** Author-defined dependency order. Rules combine by the explicit all/any policy. */
	readonly rulePolicy: 'all' | 'any';
	readonly capabilities: readonly CapabilityInstance[];
}
export type CapabilityCategory = 'analysis' | 'rule' | 'judgment' | 'risk' | 'execution';
export type CapabilityField = {
	readonly key: string;
	readonly label: string;
	readonly description: string;
	readonly required: boolean;
} & (
	| { readonly type: 'text'; readonly maxLength: number; readonly default: string }
	| {
			readonly type: 'number';
			readonly min: number;
			readonly max: number;
			readonly integer: boolean;
			readonly default: number;
	  }
	| { readonly type: 'enum'; readonly options: readonly string[]; readonly default: string }
	| { readonly type: 'boolean'; readonly default: boolean }
	| { readonly type: 'context'; readonly default: string }
	| { readonly type: 'instance'; readonly output: string; readonly default: string }
);
export interface CapabilityDefinition {
	readonly id: string;
	readonly revision: string;
	readonly label: string;
	readonly description: string;
	readonly category: CapabilityCategory;
	readonly output: string | null;
	readonly availability: 'definition-only';
	readonly fields: readonly CapabilityField[];
}
export interface CapabilityCatalog {
	readonly definitions: readonly CapabilityDefinition[];
	resolve(id: string, revision: string): CapabilityDefinition | undefined;
}
export interface Provenance {
	readonly kind: 'original' | 'revision' | 'clone';
	readonly sourceVersionId: string | null;
	readonly sourceMethodId: string | null;
	readonly sourceFingerprint: string | null;
}
export interface Method {
	readonly schema: 'trading.method@1';
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly versionCount: number;
	readonly draftRevision: number;
	readonly hasDraft: boolean;
	readonly origin: Provenance;
}
export interface WorkingDraft {
	readonly schema: 'trading.method-draft@1';
	readonly methodId: string;
	readonly revision: number;
	readonly updatedAt: string;
	readonly content: MethodContent;
	readonly provenance: Provenance;
}
export interface MethodVersion {
	readonly schema: 'trading.method-version@1';
	readonly id: string;
	readonly methodId: string;
	readonly number: number;
	readonly createdAt: string;
	readonly provenance: Provenance;
	readonly content: MethodContent;
	readonly canonical: string;
	readonly fingerprint: string;
}
/** Independently revisioned working context; layout remains owned by Workspace Instance. */
export interface WorkspaceProfile {
	readonly schema: 'trading.workspace-profile@1';
	readonly workspaceId: string;
	readonly revision: number;
	readonly methodVersionId: string | null;
	readonly updatedAt: string;
}
export interface MethodDetail {
	readonly method: Method;
	readonly draft: WorkingDraft | null;
	readonly versions: readonly MethodVersion[];
}
export interface SemanticChange {
	readonly kind:
		| 'metadata'
		| 'scope'
		| 'added'
		| 'removed'
		| 'configuration'
		| 'ordering'
		| 'rules';
	readonly path: string;
	readonly before: string;
	readonly after: string;
}
export interface VersionComparison {
	readonly left: MethodVersion;
	readonly right: MethodVersion;
	readonly changes: readonly SemanticChange[];
}
export interface RequestReceipt {
	readonly key: string;
	readonly command: string;
	readonly reply: MethodReply;
}
/** Synchronous transaction callback: adapters must commit/rollback as a unit, never await in it. */
export interface MethodTransaction {
	listMethods(): readonly Method[];
	getMethod(id: string): Method | null;
	getDraft(methodId: string): WorkingDraft | null;
	getVersion(id: string): MethodVersion | null;
	listVersions(methodId: string): readonly MethodVersion[];
	getProfile(workspaceId: string): WorkspaceProfile | null;
	getReceipt(key: string): RequestReceipt | null;
	insertMethod(method: Method): void;
	updateMethod(method: Method): void;
	putDraft(draft: WorkingDraft, expectedRevision: number | null): void;
	removeDraft(methodId: string, expectedRevision: number): void;
	insertVersion(version: MethodVersion): void;
	insertProfile(profile: WorkspaceProfile): void;
	insertReceipt(receipt: RequestReceipt): void;
}
export interface MethodRepository {
	transaction<T>(work: (tx: MethodTransaction) => T): T;
	close(): void;
}
export type MethodCommand =
	| { readonly op: 'list' }
	| { readonly op: 'get'; readonly methodId: string }
	| { readonly op: 'version'; readonly versionId: string }
	| { readonly op: 'compare'; readonly leftId: string; readonly rightId: string }
	| { readonly op: 'profile'; readonly workspaceId: string }
	| { readonly op: 'create'; readonly requestId: string; readonly name: string }
	| {
			readonly op: 'save';
			readonly requestId: string;
			readonly methodId: string;
			readonly expectedRevision: number;
			readonly content: MethodContent;
	  }
	| { readonly op: 'validate'; readonly content: MethodContent }
	| {
			readonly op: 'freeze';
			readonly requestId: string;
			readonly methodId: string;
			readonly expectedRevision: number;
	  }
	| { readonly op: 'revise'; readonly requestId: string; readonly versionId: string }
	| {
			readonly op: 'clone';
			readonly requestId: string;
			readonly versionId: string;
			readonly name: string;
	  }
	| {
			readonly op: 'assign';
			readonly requestId: string;
			readonly workspaceId: string;
			readonly expectedRevision: number;
			readonly versionId: string | null;
	  };
export type MethodReply =
	| { readonly kind: 'library'; readonly methods: readonly Method[] }
	| { readonly kind: 'detail'; readonly detail: MethodDetail }
	| { readonly kind: 'comparison'; readonly comparison: VersionComparison }
	| { readonly kind: 'profile'; readonly profile: WorkspaceProfile | null }
	| {
			readonly kind: 'validation';
			readonly diagnostics: readonly Diagnostic[];
			readonly canonical: string | null;
			readonly fingerprint: string | null;
	  };
export type MethodResult =
	| { readonly ok: true; readonly value: MethodReply }
	| {
			readonly ok: false;
			readonly code: MethodErrorCode;
			readonly message: string;
			readonly diagnostics: readonly Diagnostic[];
	  };
export interface MethodClient {
	execute(command: MethodCommand): Promise<MethodResult>;
}

export function emptyMethodContent(name = ''): MethodContent {
	return {
		schema: METHOD_CONTENT_SCHEMA,
		name,
		description: '',
		observations: [],
		rulePolicy: 'all',
		capabilities: []
	};
}
export function originalProvenance(): Provenance {
	return { kind: 'original', sourceVersionId: null, sourceMethodId: null, sourceFingerprint: null };
}
/** Clone JSON data, then recursively freeze it. No caller can mutate an acknowledged snapshot. */
export function immutableCopy<T>(value: T): T {
	const copy = JSON.parse(JSON.stringify(value)) as T;
	function freeze(item: unknown): void {
		if (item && typeof item === 'object') {
			Object.values(item).forEach(freeze);
			Object.freeze(item);
		}
	}
	freeze(copy);
	return copy;
}
