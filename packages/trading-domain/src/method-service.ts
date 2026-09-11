import {
	MethodError,
	METHOD_ERROR_MESSAGES,
	immutableCopy,
	emptyMethodContent,
	originalProvenance,
	type MethodCommand,
	type MethodReply,
	type MethodResult,
	type MethodRepository,
	type MethodTransaction,
	type MethodDetail,
	type MethodVersion,
	type CapabilityCatalog,
	type Provenance,
	type SemanticChange
} from './method.ts';
import {
	record,
	exact,
	identifier,
	revisionValue,
	textValue,
	parseMethodContent,
	canonicalizeMethod,
	contentFingerprint,
	stableJson
} from './method-validation.ts';
import { parseMethodReply } from './method-records.ts';

export function parseMethodCommand(input: unknown): MethodCommand {
	const c = record(input);
	const fields: Record<string, string[]> = {
		list: [],
		get: ['methodId'],
		version: ['versionId'],
		compare: ['leftId', 'rightId'],
		profile: ['workspaceId'],
		create: ['requestId', 'name'],
		save: ['requestId', 'methodId', 'expectedRevision', 'content'],
		validate: ['content'],
		freeze: ['requestId', 'methodId', 'expectedRevision'],
		revise: ['requestId', 'versionId'],
		clone: ['requestId', 'versionId', 'name'],
		assign: ['requestId', 'workspaceId', 'expectedRevision', 'versionId']
	};
	if (typeof c.op !== 'string' || !Object.hasOwn(fields, c.op))
		throw new MethodError('INVALID_REQUEST');
	exact(c, ['op', ...fields[c.op]!]);
	const normalized = { ...c };
	for (const key of fields[c.op]!) {
		if (key === 'content') normalized[key] = parseMethodContent(c[key]);
		else if (key === 'name') normalized[key] = textValue(c[key], 120, true);
		else if (key === 'expectedRevision') revisionValue(c[key], c.op === 'assign' ? 0 : 1);
		else if (!(key === 'versionId' && c.op === 'assign' && c[key] === null)) identifier(c[key]);
	}
	return immutableCopy(normalized) as unknown as MethodCommand;
}
function required<T>(v: T | null): T {
	if (v === null) throw new MethodError('NOT_FOUND');
	return v;
}
function detail(tx: MethodTransaction, id: string): MethodDetail {
	return {
		method: required(tx.getMethod(id)),
		draft: tx.getDraft(id),
		versions: tx.listVersions(id)
	};
}
function fromVersion(v: MethodVersion, kind: 'revision' | 'clone'): Provenance {
	return {
		kind,
		sourceVersionId: v.id,
		sourceMethodId: v.methodId,
		sourceFingerprint: v.fingerprint
	};
}
export function compareMethodVersions(
	left: MethodVersion,
	right: MethodVersion
): readonly SemanticChange[] {
	const changes: SemanticChange[] = [];
	const add = (kind: SemanticChange['kind'], path: string, a: unknown, b: unknown) => {
		if (stableJson(a) !== stableJson(b))
			changes.push({
				kind,
				path,
				before: typeof a === 'string' ? a : stableJson(a),
				after: typeof b === 'string' ? b : stableJson(b)
			});
	};
	for (const key of ['name', 'description'] as const)
		add('metadata', key, left.content[key], right.content[key]);
	for (const observationId of new Set(
		[...left.content.observations, ...right.content.observations].map((o) => o.id)
	)) {
		const a = left.content.observations.find((o) => o.id === observationId);
		const b = right.content.observations.find((o) => o.id === observationId);
		if (a && b) {
			for (const key of ['label', 'instrument', 'timeframe', 'dataType'] as const)
				add('scope', `${observationId} · ${key}`, a[key], b[key]);
		} else
			add(
				'scope',
				observationId,
				a ? `${a.label} · ${a.instrument} · ${a.timeframe} · ${a.dataType}` : 'Absent',
				b ? `${b.label} · ${b.instrument} · ${b.timeframe} · ${b.dataType}` : 'Absent'
			);
	}
	add('rules', 'Rule combination', left.content.rulePolicy, right.content.rulePolicy);
	for (const c of left.content.capabilities) {
		const other = right.content.capabilities.find((x) => x.id === c.id);
		if (!other) add('removed', c.id, c, null);
		else {
			add(
				'configuration',
				`${c.id} · definition revision`,
				`${c.capabilityId}@${c.revision}`,
				`${other.capabilityId}@${other.revision}`
			);
			for (const key of Array.from(
				new Set([...Object.keys(c.config), ...Object.keys(other.config)])
			).sort())
				add('configuration', `${c.id} · ${key}`, c.config[key] ?? null, other.config[key] ?? null);
		}
	}
	for (const c of right.content.capabilities)
		if (!left.content.capabilities.some((x) => x.id === c.id)) add('added', c.id, null, c);
	const shared = new Set(
		left.content.capabilities
			.filter((c) => right.content.capabilities.some((x) => x.id === c.id))
			.map((c) => c.id)
	);
	add(
		'ordering',
		'Capability dependency order',
		left.content.capabilities.filter((c) => shared.has(c.id)).map((c) => c.id),
		right.content.capabilities.filter((c) => shared.has(c.id)).map((c) => c.id)
	);
	return immutableCopy(changes);
}

/** Application use cases own lifecycle rules. The repository supplies atomic persistence only. */
export function createMethodService(
	repository: MethodRepository,
	catalog: CapabilityCatalog,
	options: { now?: () => string; id?: () => string } = {}
) {
	const now = options.now ?? (() => new Date().toISOString());
	const id = options.id ?? (() => globalThis.crypto.randomUUID());
	async function execute(input: unknown): Promise<MethodResult> {
		try {
			const command = parseMethodCommand(input);
			if (command.op === 'validate') {
				const validated = await canonicalizeMethod(command.content, catalog);
				return {
					ok: true,
					value: immutableCopy({
						kind: 'validation',
						diagnostics: validated.diagnostics,
						canonical: validated.canonical,
						fingerprint: validated.fingerprint
					})
				};
			}
			// Hash outside the transaction; the revision is checked AGAIN inside the write lock.
			// An existing receipt wins even after its original draft has been consumed.
			const key = 'requestId' in command ? command.requestId : null;
			const encoded = stableJson(command);
			const replay = key ? repository.transaction((tx) => tx.getReceipt(key)) : null;
			if (replay) {
				if (replay.command !== encoded) throw new MethodError('IDEMPOTENCY_CONFLICT');
				return { ok: true, value: parseMethodReply(replay.reply) };
			}
			let frozen: Awaited<ReturnType<typeof canonicalizeMethod>> | null = null;
			if (command.op === 'freeze') {
				const draft = repository.transaction((tx) => required(tx.getDraft(command.methodId)));
				if (draft.revision !== command.expectedRevision) throw new MethodError('CONFLICT');
				frozen = await canonicalizeMethod(draft.content, catalog);
				if (frozen.diagnostics.length)
					throw new MethodError('VALIDATION_FAILED', frozen.diagnostics);
			}
			const reply = repository.transaction((tx) => {
				const receipt = key ? tx.getReceipt(key) : null;
				if (receipt) {
					if (receipt.command !== encoded) throw new MethodError('IDEMPOTENCY_CONFLICT');
					return parseMethodReply(receipt.reply);
				}
				const timestamp = now();
				let result: MethodReply;
				switch (command.op) {
					case 'list':
						result = { kind: 'library', methods: tx.listMethods() };
						break;
					case 'get':
						result = { kind: 'detail', detail: detail(tx, command.methodId) };
						break;
					case 'profile':
						result = { kind: 'profile', profile: tx.getProfile(command.workspaceId) };
						break;
					case 'version':
						result = {
							kind: 'detail',
							detail: detail(tx, required(tx.getVersion(command.versionId)).methodId)
						};
						break;
					case 'compare': {
						const left = required(tx.getVersion(command.leftId));
						const right = required(tx.getVersion(command.rightId));
						result = {
							kind: 'comparison',
							comparison: { left, right, changes: compareMethodVersions(left, right) }
						};
						break;
					}
					case 'create':
					case 'clone': {
						const source =
							command.op === 'clone' ? required(tx.getVersion(command.versionId)) : null;
						const methodId = id();
						const provenance = source ? fromVersion(source, 'clone') : originalProvenance();
						const content = source
							? { ...source.content, name: command.name }
							: emptyMethodContent(command.name);
						tx.insertMethod({
							schema: 'trading.method@1',
							id: methodId,
							name: command.name,
							description: content.description,
							createdAt: timestamp,
							updatedAt: timestamp,
							versionCount: 0,
							draftRevision: 1,
							hasDraft: true,
							origin: provenance
						});
						tx.putDraft(
							{
								schema: 'trading.method-draft@1',
								methodId,
								revision: 1,
								updatedAt: timestamp,
								content,
								provenance
							},
							null
						);
						result = { kind: 'detail', detail: detail(tx, methodId) };
						break;
					}
					case 'save': {
						const method = required(tx.getMethod(command.methodId));
						const draft = required(tx.getDraft(command.methodId));
						if (draft.revision !== command.expectedRevision) throw new MethodError('CONFLICT');
						tx.putDraft(
							{
								...draft,
								content: command.content,
								revision: draft.revision + 1,
								updatedAt: timestamp
							},
							command.expectedRevision
						);
						tx.updateMethod({
							...method,
							name: command.content.name,
							description: command.content.description,
							draftRevision: draft.revision + 1,
							updatedAt: timestamp
						});
						result = { kind: 'detail', detail: detail(tx, method.id) };
						break;
					}
					case 'freeze': {
						const method = required(tx.getMethod(command.methodId));
						const draft = required(tx.getDraft(command.methodId));
						if (draft.revision !== command.expectedRevision) throw new MethodError('CONFLICT');
						if (!frozen?.canonical || !frozen.fingerprint)
							throw new MethodError('VALIDATION_FAILED');
						tx.insertVersion({
							schema: 'trading.method-version@1',
							id: id(),
							methodId: method.id,
							number: method.versionCount + 1,
							createdAt: timestamp,
							provenance: draft.provenance,
							content: frozen.content,
							canonical: frozen.canonical,
							fingerprint: frozen.fingerprint
						});
						tx.removeDraft(method.id, draft.revision);
						tx.updateMethod({
							...method,
							versionCount: method.versionCount + 1,
							hasDraft: false,
							updatedAt: timestamp
						});
						result = { kind: 'detail', detail: detail(tx, method.id) };
						break;
					}
					case 'revise': {
						const source = required(tx.getVersion(command.versionId));
						const method = required(tx.getMethod(source.methodId));
						if (tx.getDraft(source.methodId)) throw new MethodError('CONFLICT');
						tx.putDraft(
							{
								schema: 'trading.method-draft@1',
								methodId: source.methodId,
								revision: method.draftRevision + 1,
								updatedAt: timestamp,
								content: source.content,
								provenance: fromVersion(source, 'revision')
							},
							null
						);
						tx.updateMethod({
							...method,
							hasDraft: true,
							draftRevision: method.draftRevision + 1,
							name: source.content.name,
							description: source.content.description,
							updatedAt: timestamp
						});
						result = { kind: 'detail', detail: detail(tx, source.methodId) };
						break;
					}
					case 'assign': {
						const current = tx.getProfile(command.workspaceId);
						if ((current?.revision ?? 0) !== command.expectedRevision)
							throw new MethodError('CONFLICT');
						if (command.versionId !== null) required(tx.getVersion(command.versionId));
						const profile = {
							schema: 'trading.workspace-profile@1' as const,
							workspaceId: command.workspaceId,
							revision: command.expectedRevision + 1,
							methodVersionId: command.versionId,
							updatedAt: timestamp
						};
						tx.insertProfile(profile);
						result = { kind: 'profile', profile };
						break;
					}
				}
				const safe = parseMethodReply(result);
				if (key) tx.insertReceipt({ key, command: encoded, reply: safe });
				return safe;
			});
			// Verify content identity on retrieval too, including unsupported capability revisions.
			const versions =
				reply.kind === 'detail'
					? reply.detail.versions
					: reply.kind === 'comparison'
						? [reply.comparison.left, reply.comparison.right]
						: [];
			for (const version of versions)
				if ((await contentFingerprint(version.canonical)) !== version.fingerprint)
					throw new MethodError('INVALID_RECORD');
			return { ok: true, value: reply };
		} catch (error) {
			const known = error instanceof MethodError ? error : new MethodError('PERSISTENCE_FAILED');
			return {
				ok: false,
				code: known.code,
				message: METHOD_ERROR_MESSAGES[known.code],
				diagnostics: known.diagnostics
			};
		}
	}
	return { execute };
}
