<script lang="ts">
	import type {
		CapabilityCatalog,
		Diagnostic,
		MethodContent,
		Scalar
	} from '@trading-os/trading-domain';
	import CapabilityFields from './CapabilityFields.svelte';
	let {
		content,
		catalog,
		diagnostics,
		disabled,
		onChange
	}: {
		content: MethodContent;
		catalog: CapabilityCatalog;
		diagnostics: readonly Diagnostic[];
		disabled: boolean;
		onChange: (content: MethodContent) => void;
	} = $props();
	let capability = $state('');
	const issue = (path: string) =>
		diagnostics
			.filter((d) => d.path === path)
			.map((d) => d.message)
			.join(' ');
	function addContext() {
		onChange({
			...content,
			observations: [
				...content.observations,
				{
					id: `ctx-${crypto.randomUUID()}`,
					label: '',
					instrument: '',
					timeframe: '',
					dataType: 'bars'
				}
			]
		});
	}
	function contextField(index: number, field: 'label' | 'instrument' | 'timeframe', value: string) {
		onChange({
			...content,
			observations: content.observations.map((o, i) => (i === index ? { ...o, [field]: value } : o))
		});
	}
	function addCapability() {
		const d = catalog.definitions.find((d) => `${d.id}@${d.revision}` === capability);
		if (!d) return;
		const config: Record<string, Scalar> = {};
		for (const f of d.fields)
			config[f.key] =
				f.type === 'context'
					? (content.observations[0]?.id ?? '')
					: f.type === 'instance'
						? (content.capabilities.find(
								(c) => catalog.resolve(c.capabilityId, c.revision)?.output === f.output
							)?.id ?? '')
						: f.default;
		onChange({
			...content,
			capabilities: [
				...content.capabilities,
				{
					id: `cap-${crypto.randomUUID()}`,
					capabilityId: d.id,
					revision: d.revision,
					config
				}
			]
		});
	}
	function configure(index: number, key: string, value: Scalar) {
		onChange({
			...content,
			capabilities: content.capabilities.map((c, i) =>
				i === index ? { ...c, config: { ...c.config, [key]: value } } : c
			)
		});
	}
	function move(index: number, delta: number) {
		const capabilities = [...content.capabilities];
		[capabilities[index], capabilities[index + delta]] = [
			capabilities[index + delta]!,
			capabilities[index]!
		];
		onChange({ ...content, capabilities });
	}
</script>

<fieldset class="mw-editor" {disabled}>
	<legend class="visually-hidden">Working draft editor</legend>
	<div class="mw-metadata">
		<div class="mw-field">
			<label for="method-name">Method name</label><input
				id="method-name"
				maxlength="120"
				value={content.name}
				aria-invalid={!!issue('name')}
				aria-describedby="method-name-error"
				oninput={(e) => onChange({ ...content, name: e.currentTarget.value })}
			/><span class="mw-error" id="method-name-error">{issue('name')}</span>
		</div>
		<div class="mw-field">
			<label for="method-description">Description</label><textarea
				id="method-description"
				rows="2"
				maxlength="4000"
				value={content.description}
				oninput={(e) => onChange({ ...content, description: e.currentTarget.value })}
			></textarea>
		</div>
	</div>
	<section aria-labelledby="contexts-heading" class="mw-section">
		<div class="mw-section-heading">
			<h3 id="contexts-heading">Observation requirements</h3>
			<button onclick={addContext} disabled={content.observations.length >= 32}>Add context</button>
		</div>
		<p class="mw-muted">
			Declare what the Method needs to observe. These requirements belong to its version,
			independently of your chart layout.
		</p>
		<span class="mw-error">{issue('observations')}</span>
		{#if !content.observations.length}<p class="mw-empty-line">No observation contexts yet.</p>{/if}
		{#each content.observations as o, index (`${o.id}-${index}`)}
			<div class="mw-context-row">
				{#each ['label', 'instrument', 'timeframe'] as field (field)}
					{@const key = field as 'label' | 'instrument' | 'timeframe'}
					{@const controlId = `${o.id}-${key}`}
					<div class="mw-field">
						<label for={controlId}
							>{key === 'label'
								? 'Context label'
								: key === 'instrument'
									? 'Instrument'
									: 'Timeframe'}</label
						><input
							id={controlId}
							maxlength={key === 'label' ? 100 : key === 'instrument' ? 80 : 30}
							value={o[key]}
							aria-invalid={!!issue(`observations.${index}.${key}`)}
							aria-describedby={`${controlId}-error`}
							oninput={(e) => contextField(index, key, e.currentTarget.value)}
						/><span class="mw-error" id={`${controlId}-error`}
							>{issue(`observations.${index}.${key}`)}</span
						>
					</div>
				{/each}
				<button
					class="mw-quiet"
					aria-label={`Remove context ${index + 1}`}
					onclick={() =>
						onChange({
							...content,
							observations: content.observations.filter((_, i) => i !== index)
						})}>Remove</button
				>
			</div>
		{/each}
	</section>
	<section aria-labelledby="composition-heading" class="mw-section">
		<div class="mw-section-heading">
			<h3 id="composition-heading">Capability composition</h3>
			<span class="mw-muted">{content.capabilities.length} instances</span>
		</div>
		<div class="mw-compose-tools">
			<div class="mw-field">
				<label for="capability-picker">Add capability definition</label><select
					id="capability-picker"
					bind:value={capability}
					><option value="">Choose a definition…</option
					>{#each catalog.definitions as d (`${d.id}@${d.revision}`)}<option
							value={`${d.id}@${d.revision}`}>{d.category} · {d.label} · rev {d.revision}</option
						>{/each}</select
				>
			</div>
			<button disabled={!capability || content.capabilities.length >= 64} onclick={addCapability}
				>Add capability</button
			>
			<div class="mw-field">
				<label for="rule-policy">Combine structured rules</label><select
					id="rule-policy"
					value={content.rulePolicy}
					onchange={(e) =>
						onChange({ ...content, rulePolicy: e.currentTarget.value as 'all' | 'any' })}
					><option value="all">All rules required</option><option value="any"
						>Any rule sufficient</option
					></select
				>
			</div>
		</div>
		<p class="mw-muted">
			Analysis precedes its dependent rules. Judgment questions, risk requests and execution
			assumptions remain distinct.
		</p>
		<span class="mw-error">{issue('capabilities')}</span>
		{#if !content.capabilities.length}<p class="mw-empty-line">
				No capabilities yet. Add analysis and a compatible rule to start composing.
			</p>{/if}
		{#each content.capabilities as c, index (`${c.id}-${index}`)}
			{@const definition = catalog.resolve(c.capabilityId, c.revision)}
			<section
				class="mw-capability"
				aria-label={`Capability ${index + 1}: ${definition?.label ?? c.capabilityId}`}
			>
				<div class="mw-cap-header">
					<span class="mw-index">{String(index + 1).padStart(2, '0')}</span>
					<h4>{definition?.label ?? c.capabilityId}</h4>
					<span class="mw-badge">{definition?.category ?? 'unsupported'} · rev {c.revision}</span>
					<div class="mw-row-actions">
						<button
							aria-label={`Move capability ${index + 1} up`}
							disabled={index === 0}
							onclick={() => move(index, -1)}>↑</button
						><button
							aria-label={`Move capability ${index + 1} down`}
							disabled={index === content.capabilities.length - 1}
							onclick={() => move(index, 1)}>↓</button
						><button
							aria-label={`Remove capability ${index + 1}`}
							onclick={() =>
								onChange({
									...content,
									capabilities: content.capabilities.filter((_, i) => i !== index)
								})}>Remove</button
						>
					</div>
				</div>
				<p class="mw-muted">
					{definition?.description ??
						'Unsupported capability revision. Content is retained; freezing is blocked.'}
				</p>
				<span class="mw-error">{issue(`capabilities.${index}`)}</span>
				{#if definition}<CapabilityFields
						{definition}
						instance={c}
						{index}
						{content}
						{catalog}
						{diagnostics}
						onChange={(key, value) => configure(index, key, value)}
					/>{:else}<pre>{JSON.stringify(c.config, null, 2)}</pre>{/if}
			</section>
		{/each}
	</section>
</fieldset>
