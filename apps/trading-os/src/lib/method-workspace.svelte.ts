import {
	immutableCopy,
	validateMethod,
	type CapabilityCatalog,
	type MethodClient,
	type MethodCommand,
	type MethodContent,
	type MethodDetail,
	type MethodVersion,
	type Method,
	type Diagnostic,
	type VersionComparison,
	type WorkspaceProfile
} from '@trading-os/trading-domain';
import type { MethodWorkspaceService, AuthoringState } from '@trading-os/trading-surfaces';

/** Per-shell authoring controller. Only acknowledged server responses advance stored revision. */
export function createMethodWorkspace(
	client: MethodClient,
	catalog: CapabilityCatalog,
	workspaceId: string
): MethodWorkspaceService {
	let methods = $state<readonly Method[]>([]),
		detail = $state<MethodDetail | null>(null),
		content = $state<MethodContent | null>(null);
	let selectedVersion = $state<MethodVersion | null>(null),
		comparison = $state<VersionComparison | null>(null);
	let profile = $state<WorkspaceProfile | null>(null),
		profileState = $state<'loading' | 'ready' | 'failed'>('loading');
	let profileLabel = $state('');
	async function resolveProfileLabel() {
		profileLabel = '';
		const id = profile?.methodVersionId;
		if (!id) return;
		const response = await client.execute({ op: 'version', versionId: id });
		if (response.ok && response.value.kind === 'detail') {
			const v = response.value.detail.versions.find((v) => v.id === id);
			if (v) profileLabel = `${v.content.name} · Version ${v.number}`;
		}
		if (!profileLabel) profileLabel = 'Selected Method Version — label unavailable';
	}
	let state = $state<AuthoringState>('idle'),
		message = $state(''),
		dirty = $state(false),
		diagnostics = $state<readonly Diagnostic[]>([]),
		validated = $state(false);
	let recovery = $state<MethodContent | null>(null);
	let pending: MethodCommand | null = null;
	let busy = false;
	const requestId = () => globalThis.crypto.randomUUID();
	function receive(next: MethodDetail) {
		detail = next;
		content = next.draft?.content ?? null;
		selectedVersion = next.versions.at(-1) ?? null;
		methods = [...methods.filter((m) => m.id !== next.method.id), next.method];
		comparison = null;
		dirty = false;
		validated = false;
		diagnostics = [];
		state = 'saved';
		message = '';
	}
	async function mutate(command: MethodCommand): Promise<boolean> {
		if (busy) return false;
		busy = true;
		pending = command;
		state = 'saving';
		message = '';
		const result = await client.execute(command);
		busy = false;
		if (!result.ok) {
			state = result.code === 'CONFLICT' ? 'conflict' : 'failed';
			message =
				command.op === 'assign'
					? 'Workspace Profile assignment was not confirmed. Reload the profile and retry the association.'
					: result.message;
			diagnostics = result.diagnostics;
			recovery = content ? immutableCopy(content) : recovery;
			return false;
		}
		pending = null;
		if (result.value.kind === 'detail') receive(result.value.detail);
		else if (result.value.kind === 'profile') {
			profile = result.value.profile;
			await resolveProfileLabel();
			profileState = 'ready';
			state = dirty ? 'dirty' : 'saved';
			message = 'Workspace Profile saved. Working context only — no active run.';
		}
		return true;
	}
	async function open(id: string) {
		if (busy || pending || dirty || state === 'conflict') {
			message = 'Save or reconcile the current draft before opening another Method.';
			return;
		}
		busy = true;
		state = 'loading';
		detail = null;
		content = null;
		selectedVersion = null;
		comparison = null;
		diagnostics = [];
		message = '';
		const result = await client.execute({ op: 'get', methodId: id });
		busy = false;
		if (result.ok && result.value.kind === 'detail') {
			receive(result.value.detail);
			state = 'ready';
		} else {
			state = 'failed';
			message = result.ok ? 'The Method record is unavailable.' : result.message;
		}
	}
	async function load() {
		if (state !== 'idle' && state !== 'failed') return;
		if (busy || dirty || pending) return;
		busy = true;
		state = 'loading';
		message = '';
		const [library, context] = await Promise.all([
			client.execute({ op: 'list' }),
			client.execute({ op: 'profile', workspaceId })
		]);
		busy = false;
		if (context.ok && context.value.kind === 'profile') {
			profile = context.value.profile;
			await resolveProfileLabel();
			profileState = 'ready';
		} else profileState = 'failed';
		if (library.ok && library.value.kind === 'library') {
			methods = library.value.methods;
			state = 'ready';
		} else {
			methods = [];
			state = 'failed';
			message = library.ok ? 'Library unavailable.' : library.message;
		}
	}
	function change(next: MethodContent) {
		if (busy || pending || !detail?.draft) return;
		content = immutableCopy(next);
		dirty = true;
		validated = false;
		if (state !== 'conflict') state = 'dirty';
		diagnostics = diagnostics.length ? validateMethod(content, catalog) : [];
	}
	async function save() {
		if (!detail?.draft || !content || state === 'conflict') return false;
		// An uncertain save must reconcile its exact request before accepting further writes.
		if (pending) return mutate(pending);
		return mutate({
			op: 'save',
			requestId: requestId(),
			methodId: detail.method.id,
			expectedRevision: detail.draft.revision,
			content: immutableCopy(content)
		});
	}
	async function validate() {
		if (!content || busy) return false;
		diagnostics = validateMethod(content, catalog);
		validated = true;
		return diagnostics.length === 0;
	}
	return {
		catalog,
		get methods() {
			return methods;
		},
		get detail() {
			return detail;
		},
		get content() {
			return content;
		},
		get selectedVersion() {
			return selectedVersion;
		},
		get comparison() {
			return comparison;
		},
		get profile() {
			return profile;
		},
		get profileLabel() {
			return profileLabel;
		},
		get profileState() {
			return profileState;
		},
		get state() {
			return state;
		},
		get message() {
			return message;
		},
		get dirty() {
			return dirty;
		},
		get diagnostics() {
			return diagnostics;
		},
		get validated() {
			return validated;
		},
		get recovery() {
			return recovery;
		},
		load,
		open,
		change,
		save,
		validate,
		async create(name) {
			if (dirty || pending) return false;
			return mutate({ op: 'create', requestId: requestId(), name });
		},
		async freeze() {
			if (dirty || pending || !detail?.draft || !(await validate())) return false;
			return mutate({
				op: 'freeze',
				requestId: requestId(),
				methodId: detail.method.id,
				expectedRevision: detail.draft.revision
			});
		},
		async revise(versionId) {
			if (dirty || pending || detail?.draft) return false;
			return mutate({ op: 'revise', requestId: requestId(), versionId });
		},
		async clone(versionId, name) {
			if (dirty || pending) return false;
			return mutate({ op: 'clone', requestId: requestId(), versionId, name });
		},
		selectVersion(id) {
			selectedVersion = detail?.versions.find((v) => v.id === id) ?? null;
		},
		async compare(leftId, rightId) {
			if (busy || pending) return;
			busy = true;
			const previous = state;
			state = 'loading';
			comparison = null;
			message = '';
			const result = await client.execute({ op: 'compare', leftId, rightId });
			busy = false;
			state = previous;
			if (result.ok && result.value.kind === 'comparison') comparison = result.value.comparison;
			else message = result.ok ? 'Comparison unavailable.' : result.message;
		},
		async assign(versionId) {
			if (profileState !== 'ready' || busy || pending) return false;
			return mutate({
				op: 'assign',
				requestId: requestId(),
				workspaceId,
				expectedRevision: profile?.revision ?? 0,
				versionId
			});
		},
		async reload() {
			if (busy) return;
			recovery =
				content && (dirty || state === 'conflict' || state === 'failed')
					? immutableCopy(content)
					: recovery;
			const id = detail?.method.id;
			dirty = false;
			pending = null;
			state = 'idle';
			await load();
			if (id && methods.some((m) => m.id === id)) await open(id);
		},
		restoreRecovery() {
			if (recovery && detail?.draft) change(recovery);
		},
		async retry() {
			if (pending) return mutate(pending);
			await load();
			return state !== 'failed';
		}
	};
}
