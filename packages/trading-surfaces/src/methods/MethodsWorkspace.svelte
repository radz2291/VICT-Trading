<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getTradingServices } from '../services.ts';
	import MethodEditor from './MethodEditor.svelte';
	import MethodSnapshot from './MethodSnapshot.svelte';
	import MethodDialog from './MethodDialog.svelte';
	import './methods.css';
	import EvaluationWorkspace from '../evaluation/EvaluationWorkspace.svelte';
	const services = getTradingServices();
	const service = services.methods;
	let search = $state(''),
		sort = $state('updated'),
		view = $state<'draft' | 'versions' | 'compare' | 'evaluate'>('draft');
	let dialog = $state<'create' | 'freeze' | 'clone' | null>(null);
	let leftId = $state(''),
		rightId = $state('');
	const busy = $derived(service?.state === 'saving' || service?.state === 'loading');
	const library = $derived(
		[...(service?.methods ?? [])]
			.filter((m) => `${m.name} ${m.description}`.toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) =>
				sort === 'name'
					? a.name.localeCompare(b.name)
					: b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
			)
	);
	const stateLabel = $derived(
		service
			? {
					idle: 'Not loaded',
					loading: 'Loading…',
					ready: 'Confirmed state',
					dirty: 'Unsaved draft',
					saving: 'Saving…',
					saved: 'Saved',
					failed: 'Failed — persistence not confirmed',
					conflict: 'Conflict — changes not applied'
				}[service.state]
			: 'Unavailable'
	);
	onMount(() => {
		void service?.load();
	});
	async function confirm(name: string) {
		if (!service) return;
		const mode = dialog;
		dialog = null;
		const ok =
			mode === 'create'
				? await service.create(name)
				: mode === 'clone' && service.selectedVersion
					? await service.clone(service.selectedVersion.id, name)
					: mode === 'freeze'
						? await service.freeze()
						: false;
		if (ok) view = mode === 'freeze' ? 'versions' : 'draft';
	}
	async function open(id: string) {
		await service?.open(id);
		view = service?.detail?.draft ? 'draft' : 'versions';
	}
	function downloadRecovery() {
		if (!service?.recovery) return;
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(service.recovery, null, 2)], { type: 'application/json' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'method-draft-recovery.json';
		a.click();
		URL.revokeObjectURL(url);
	}
	function readableComparison(value: string) {
		if (!service?.comparison) return value;
		const labels = new SvelteMap<string, string>();
		for (const version of [service.comparison.right, service.comparison.left]) {
			for (const [index, c] of version.content.capabilities.entries()) {
				if (!labels.has(c.id))
					labels.set(
						c.id,
						`${index + 1}. ${service.catalog.resolve(c.capabilityId, c.revision)?.label ?? c.capabilityId}`
					);
			}
			for (const o of version.content.observations)
				if (!labels.has(o.id)) labels.set(o.id, o.label);
		}
		if (labels.has(value)) return labels.get(value)!;
		const separator = value.indexOf(' · ');
		if (separator > 0 && labels.has(value.slice(0, separator)))
			return labels.get(value.slice(0, separator))! + value.slice(separator);
		if (value.startsWith('[')) {
			try {
				const ids: unknown = JSON.parse(value);
				if (Array.isArray(ids) && ids.every((id) => typeof id === 'string'))
					return ids.map((id) => labels.get(id) ?? id).join(' → ');
			} catch {
				/* Non-JSON prose is rendered verbatim. */
			}
		}
		return value;
	}
</script>

<div class="mw" data-testid="method-workspace">
	{#if !service}<p role="alert">Method services are unavailable in this composition.</p>{:else}
		<div class="mw-workspace-heading">
			<div>
				<h2>Method workspace</h2>
				<p class="mw-muted">Author, validate and preserve a precise definition.</p>
			</div>
			<button
				onclick={() => {
					if (service.selectedVersion) services.evaluation?.configure(service.selectedVersion);
					view = view === 'evaluate' ? 'versions' : 'evaluate';
				}}>{view === 'evaluate' ? 'Return to Method authoring' : 'Evaluation inspector'}</button
			>
			<button
				class="mw-primary"
				disabled={busy || service.dirty || service.state === 'conflict'}
				onclick={() => (dialog = 'create')}>New Method</button
			>
		</div>
		<div class="mw-status" role="status" data-state={service.state}>
			<strong>{stateLabel}</strong>{#if service.message}<span>{service.message}</span
				>{/if}{#if service.state === 'failed'}<button
					disabled={busy}
					onclick={() => void service.retry()}>Retry</button
				>{/if}{#if service.state === 'conflict' || service.state === 'failed'}<button
					disabled={busy}
					onclick={() => void service.reload()}>Reload confirmed state</button
				>{/if}
		</div>
		{#if service.recovery}<div class="mw-recovery">
				<span>A recovery copy of your earlier draft is retained in this session.</span><button
					onclick={downloadRecovery}>Download recovery copy</button
				><button disabled={!service.detail?.draft || busy} onclick={() => service.restoreRecovery()}
					>Apply recovery to draft</button
				><small>Review against confirmed state before saving.</small>
			</div>{/if}
		{#if view === 'evaluate'}<EvaluationWorkspace />{:else}<div class="mw-layout">
				<aside class="mw-library" aria-label="Method library">
					<h3>Library <span class="mw-muted">{service.methods.length}</span></h3>
					<label for="method-search">Search Methods</label><input
						id="method-search"
						type="search"
						bind:value={search}
						maxlength="200"
						placeholder="Name or description"
					/>
					<label for="method-sort">Sort Methods</label><select id="method-sort" bind:value={sort}
						><option value="updated">Recently updated</option><option value="name">Name</option
						></select
					>
					{#if service.state === 'loading'}<p role="status">
							Loading Method records…
						</p>{:else if service.state === 'failed' && !service.methods.length}<p>
							Library unavailable. Retry to load records.
						</p>{:else if !service.methods.length}<p class="mw-empty-line">
							No Methods yet. Create your first definition.
						</p>{:else if !library.length}<p>No matching Methods.</p>{/if}
					<ul class="mw-library-list">
						{#each library as method (method.id)}<li>
								<button
									aria-current={service.detail?.method.id === method.id ? 'true' : undefined}
									disabled={busy || service.dirty || service.state === 'conflict'}
									onclick={() => void open(method.id)}
									><strong>{method.name || 'Untitled Method'}</strong><span
										>{method.hasDraft ? 'Working draft' : 'Immutable versions only'} · {method.versionCount
											? `latest v${method.versionCount}`
											: 'no versions'}</span
									></button
								>
							</li>{/each}
					</ul>
					<section class="mw-profile" aria-labelledby="profile-title">
						<h3 id="profile-title">Workspace Profile</h3>
						<p class="mw-muted">Default workspace · working context only</p>
						{#if service.profileState === 'loading'}<p>
								Loading profile…
							</p>{:else if service.profileState === 'failed'}<p class="mw-error">
								Profile unavailable.
							</p>
							<button onclick={() => void service.reload()}>Reload profile</button
							>{:else if service.profile?.methodVersionId}<p>
								{service.profileLabel ?? 'Selected Method Version'}
							</p>
							<details>
								<summary>Association identity</summary><small class="mw-mono"
									>{service.profile.methodVersionId}</small
								>
							</details>
							<p>Profile revision {service.profile.revision}</p>
							<button disabled={busy} onclick={() => void service.assign(null)}
								>Remove selection</button
							>{:else}<p>No Method Version selected.</p>{/if}<small
							>Select a version in history to associate it. Selection never starts a run.</small
						>
					</section>
				</aside>
				<section class="mw-main" aria-label="Method authoring and history" aria-busy={busy}>
					{#if service.detail}
						<header class="mw-detail-heading">
							<div>
								<h3>{service.detail.method.name || 'Untitled Method'}</h3>
								<small class="mw-mono">Lineage {service.detail.method.id}</small>
							</div>
							<span class="mw-badge">{service.detail.method.versionCount} immutable versions</span>
						</header>
						<div class="mw-view-buttons" role="group" aria-label="Method views">
							<button aria-pressed={view === 'draft'} onclick={() => (view = 'draft')}
								>Working draft</button
							><button aria-pressed={view === 'versions'} onclick={() => (view = 'versions')}
								>Version history</button
							><button aria-pressed={view === 'compare'} onclick={() => (view = 'compare')}
								>Compare versions</button
							>
						</div>
						{#if view === 'draft'}
							{#if service.content && service.detail.draft}
								<div class="mw-draft-bar">
									<span
										>Draft revision {service.detail.draft.revision} · {service.detail.draft
											.provenance.kind}{#if service.detail.draft.provenance.sourceVersionId}<br
											/><small class="mw-mono"
												>Source {service.detail.draft.provenance.sourceVersionId}</small
											>{/if}</span
									>
									<div class="mw-row-actions">
										<button
											disabled={busy || service.state === 'conflict'}
											onclick={() => void service.save()}>Save draft</button
										><button disabled={busy} onclick={() => void service.validate()}
											>Validate</button
										><button
											class="mw-primary"
											disabled={busy ||
												service.dirty ||
												service.state === 'conflict' ||
												service.state === 'failed'}
											onclick={async () => {
												if (await service.validate()) dialog = 'freeze';
											}}>Freeze version…</button
										>
									</div>
								</div>
								{#if service.validated}<p
										role="status"
										class:mw-error={service.diagnostics.length > 0}
									>
										{service.diagnostics.length
											? `${service.diagnostics.length} definition diagnostics. Review the fields below.`
											: 'Definition valid. Freeze a version to evaluate it.'}
									</p>{/if}
								<MethodEditor
									content={service.content}
									catalog={service.catalog}
									diagnostics={service.diagnostics}
									disabled={busy || service.state === 'failed' || service.state === 'conflict'}
									onChange={(c) => service.change(c)}
								/>
							{:else}<div class="mw-empty-panel">
									<h3>No working draft</h3>
									<p>The latest draft was frozen. Versions are immutable.</p>
									<p>
										Choose a version in history to create a revision in this lineage or clone into a
										new Method.
									</p>
									<button onclick={() => (view = 'versions')}>Open version history</button>
								</div>{/if}
						{:else if view === 'versions'}
							{#if !service.detail.versions.length}<div class="mw-empty-panel">
									<h3>No immutable versions yet</h3>
									<p>Save and validate a working draft, then freeze a version.</p>
								</div>{:else}
								<div class="mw-history">
									<ol aria-label="Version timeline">
										{#each service.detail.versions as version (version.id)}<li>
												<button
													aria-current={service.selectedVersion?.id === version.id
														? 'true'
														: undefined}
													onclick={() => service.selectVersion(version.id)}
													><strong>Version {version.number}</strong><span
														>{version.createdAt.slice(0, 10)}</span
													><small>{version.provenance.kind}</small></button
												>
											</li>{/each}
									</ol>
									<div>
										{#if service.selectedVersion}<div class="mw-version-bar">
												<strong>Immutable · v{service.selectedVersion.number}</strong>
												<div class="mw-row-actions">
													<button
														class="mw-primary"
														disabled={busy}
														onclick={() => {
															services.evaluation?.configure(service.selectedVersion!);
															view = 'evaluate';
														}}>Evaluate / Inspect</button
													>
													<button
														disabled={busy || !!service.detail.draft}
														onclick={async () => {
															if (
																service.selectedVersion &&
																(await service.revise(service.selectedVersion.id))
															)
																view = 'draft';
														}}>New revision</button
													><button
														disabled={busy || service.dirty}
														onclick={() => (dialog = 'clone')}>Clone Method…</button
													><button
														disabled={busy || service.profileState !== 'ready'}
														onclick={() => void service.assign(service.selectedVersion!.id)}
														>Use in workspace</button
													>
												</div>
											</div>
											<p class="mw-muted">
												Revision: same lineage. Clone: new lineage. Neither changes this version.{#if service.detail.draft}
													A working draft already exists; finish it before creating another
													revision.{/if}
											</p>
											<MethodSnapshot
												version={service.selectedVersion}
												catalog={service.catalog}
											/>{/if}
									</div>
								</div>
							{/if}
						{:else if service.detail.versions.length < 2}<div class="mw-empty-panel">
								<h3>Two versions are needed to compare</h3>
								<p>Create a revision from an existing version, edit its draft and freeze again.</p>
							</div>{:else}
							<div class="mw-compare-tools">
								<div class="mw-field">
									<label for="compare-left">Earlier version</label><select
										id="compare-left"
										bind:value={leftId}
										><option value="">Choose…</option
										>{#each service.detail.versions as v (v.id)}<option value={v.id}
												>v{v.number} · {v.content.name}</option
											>{/each}</select
									>
								</div>
								<div class="mw-field">
									<label for="compare-right">Later version</label><select
										id="compare-right"
										bind:value={rightId}
										><option value="">Choose…</option
										>{#each service.detail.versions as v (v.id)}<option value={v.id}
												>v{v.number} · {v.content.name}</option
											>{/each}</select
									>
								</div>
								<button
									disabled={busy || !leftId || !rightId || leftId === rightId}
									onclick={() => void service.compare(leftId, rightId)}>Compare</button
								>
							</div>
							{#if service.comparison}<section aria-label="Semantic version comparison">
									<h3>v{service.comparison.left.number} → v{service.comparison.right.number}</h3>
									<p class="mw-muted">
										{service.comparison.left.provenance.kind} → {service.comparison.right.provenance
											.kind} · {service.comparison.changes.length} semantic changes
									</p>
									<p class="mw-mono">
										{service.comparison.left.fingerprint.slice(7, 23)} → {service.comparison.right.fingerprint.slice(
											7,
											23
										)}
									</p>
									{#if !service.comparison.changes.length}<p>
											Canonical content is identical. Storage identity and provenance remain
											distinct.
										</p>{/if}
									<ul class="mw-changes">
										{#each service.comparison.changes as change, i (i)}<li>
												<h4>
													<span class="mw-badge">{change.kind}</span>
													{readableComparison(change.path)}
												</h4>
												<div>
													<p>
														<strong>Before</strong><span>{readableComparison(change.before)}</span>
													</p>
													<p>
														<strong>After</strong><span>{readableComparison(change.after)}</span>
													</p>
												</div>
											</li>{/each}
									</ul>
									<details>
										<summary>Comparison provenance</summary>
										<p>
											Earlier source: {service.comparison.left.provenance.sourceVersionId ??
												'Original'}
										</p>
										<p>
											Later source: {service.comparison.right.provenance.sourceVersionId ??
												'Original'}
										</p>
									</details>
								</section>{/if}
						{/if}
					{:else}<div class="mw-empty-panel">
							<span class="mw-eyebrow">RESEARCH / METHODS</span>
							<h3>A Method is a lineage.<br />A version preserves its definition.</h3>
							<p>
								Create a working draft or select a Method from the library. Compose reusable
								definitions, validate their structure and preserve an immutable snapshot.
							</p>
							<p class="mw-muted">
								Freeze a version to inspect deterministic calculations and rule states.
							</p>
						</div>{/if}
				</section>
			</div>
		{/if}
		{#if dialog}<MethodDialog
				mode={dialog}
				initialName={dialog === 'clone'
					? `${service.selectedVersion?.content.name ?? 'Method'} copy`
					: ''}
				{busy}
				onConfirm={(name) => void confirm(name)}
				onClose={() => (dialog = null)}
			/>{/if}
	{/if}
</div>
