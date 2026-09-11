import {
	MethodError,
	immutableCopy,
	type Method,
	type WorkingDraft,
	type MethodVersion,
	type WorkspaceProfile,
	type Provenance,
	type MethodReply
} from './method.ts';
import {
	record,
	exact,
	identifier,
	revisionValue,
	textValue,
	parseMethodContent,
	stableJson
} from './method-validation.ts';

function schema(r: Record<string, unknown>, expected: string): void {
	if (r.schema !== expected) throw new MethodError('UNSUPPORTED_SCHEMA');
}
function instant(v: unknown): string {
	if (
		typeof v !== 'string' ||
		!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) ||
		!Number.isFinite(Date.parse(v))
	)
		throw new MethodError('INVALID_RECORD');
	return v;
}
export function parseProvenance(v: unknown): Provenance {
	const p = record(v);
	exact(p, ['kind', 'sourceVersionId', 'sourceMethodId', 'sourceFingerprint']);
	if (p.kind === 'original') {
		if ([p.sourceVersionId, p.sourceMethodId, p.sourceFingerprint].some((x) => x !== null))
			throw new MethodError('INVALID_RECORD');
	} else if (p.kind === 'revision' || p.kind === 'clone') {
		identifier(p.sourceVersionId);
		identifier(p.sourceMethodId);
		fingerprintValue(p.sourceFingerprint);
	} else throw new MethodError('INVALID_RECORD');
	return immutableCopy(p) as unknown as Provenance;
}
function fingerprintValue(v: unknown): string {
	if (typeof v !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(v))
		throw new MethodError('INVALID_RECORD');
	return v;
}
export function parseMethod(v: unknown): Method {
	const r = record(v);
	schema(r, 'trading.method@1');
	exact(r, [
		'schema',
		'id',
		'name',
		'description',
		'createdAt',
		'updatedAt',
		'versionCount',
		'draftRevision',
		'hasDraft',
		'origin'
	]);
	identifier(r.id);
	textValue(r.name, 120);
	textValue(r.description, 4000);
	instant(r.createdAt);
	instant(r.updatedAt);
	revisionValue(r.versionCount, 0);
	revisionValue(r.draftRevision);
	if (typeof r.hasDraft !== 'boolean') throw new MethodError('INVALID_RECORD');
	parseProvenance(r.origin);
	return immutableCopy(r) as unknown as Method;
}
export function parseDraft(v: unknown): WorkingDraft {
	const r = record(v);
	schema(r, 'trading.method-draft@1');
	exact(r, ['schema', 'methodId', 'revision', 'updatedAt', 'content', 'provenance']);
	identifier(r.methodId);
	revisionValue(r.revision);
	instant(r.updatedAt);
	const content = parseMethodContent(r.content);
	const provenance = parseProvenance(r.provenance);
	if (provenance.kind === 'revision' && provenance.sourceMethodId !== r.methodId)
		throw new MethodError('INVALID_RECORD');
	return immutableCopy({ ...r, content, provenance }) as unknown as WorkingDraft;
}
export function parseVersion(v: unknown): MethodVersion {
	const r = record(v);
	schema(r, 'trading.method-version@1');
	exact(r, [
		'schema',
		'id',
		'methodId',
		'number',
		'createdAt',
		'provenance',
		'content',
		'canonical',
		'fingerprint'
	]);
	identifier(r.id);
	identifier(r.methodId);
	revisionValue(r.number);
	instant(r.createdAt);
	const provenance = parseProvenance(r.provenance);
	const content = parseMethodContent(r.content);
	if (provenance.kind === 'revision' && provenance.sourceMethodId !== r.methodId)
		throw new MethodError('INVALID_RECORD');
	if (typeof r.canonical !== 'string' || r.canonical !== stableJson(content))
		throw new MethodError('INVALID_RECORD');
	fingerprintValue(r.fingerprint);
	return immutableCopy({ ...r, content, provenance }) as unknown as MethodVersion;
}
export function parseProfile(v: unknown): WorkspaceProfile {
	const r = record(v);
	schema(r, 'trading.workspace-profile@1');
	exact(r, ['schema', 'workspaceId', 'revision', 'methodVersionId', 'updatedAt']);
	identifier(r.workspaceId);
	revisionValue(r.revision);
	instant(r.updatedAt);
	if (r.methodVersionId !== null) identifier(r.methodVersionId);
	return immutableCopy(r) as unknown as WorkspaceProfile;
}
/** Both sides of HTTP validate the response envelope before accepting persisted state. */
export function parseMethodReply(v: unknown): MethodReply {
	const r = record(v);
	const list = (v: unknown): unknown[] => {
		if (!Array.isArray(v)) throw new MethodError('INVALID_RECORD');
		return v;
	};
	switch (r.kind) {
		case 'library':
			exact(r, ['kind', 'methods']);
			list(r.methods).forEach(parseMethod);
			break;
		case 'detail': {
			exact(r, ['kind', 'detail']);
			const d = record(r.detail);
			exact(d, ['method', 'draft', 'versions']);
			const method = parseMethod(d.method);
			const draft = d.draft === null ? null : parseDraft(d.draft);
			const versions = list(d.versions).map(parseVersion);
			if (
				method.hasDraft !== (draft !== null) ||
				(draft && draft.revision !== method.draftRevision) ||
				(draft && draft.methodId !== method.id) ||
				versions.length !== method.versionCount ||
				versions.some((x, i) => x.methodId !== method.id || x.number !== i + 1)
			)
				throw new MethodError('INVALID_RECORD');
			break;
		}
		case 'comparison': {
			exact(r, ['kind', 'comparison']);
			const c = record(r.comparison);
			exact(c, ['left', 'right', 'changes']);
			parseVersion(c.left);
			parseVersion(c.right);
			for (const v of list(c.changes)) {
				const d = record(v);
				exact(d, ['kind', 'path', 'before', 'after']);
				if (
					!['metadata', 'scope', 'added', 'removed', 'configuration', 'ordering', 'rules'].includes(
						String(d.kind)
					)
				)
					throw new MethodError('INVALID_RECORD');
				textValue(d.path, 200);
				textValue(d.before, 100000);
				textValue(d.after, 100000);
			}
			break;
		}
		case 'profile':
			exact(r, ['kind', 'profile']);
			if (r.profile !== null) parseProfile(r.profile);
			break;
		case 'validation':
			exact(r, ['kind', 'diagnostics', 'canonical', 'fingerprint']);
			for (const v of list(r.diagnostics)) {
				const d = record(v);
				exact(d, ['code', 'path', 'message']);
				identifier(d.code);
				textValue(d.path, 200);
				textValue(d.message, 500);
			}
			if (r.canonical !== null) {
				textValue(r.canonical, 300000);
				fingerprintValue(r.fingerprint);
			} else if (r.fingerprint !== null) throw new MethodError('INVALID_RECORD');
			break;
		default:
			throw new MethodError('INVALID_RECORD');
	}
	return immutableCopy(r) as unknown as MethodReply;
}
