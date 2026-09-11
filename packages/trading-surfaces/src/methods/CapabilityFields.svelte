<script lang="ts">
	import type {
		CapabilityCatalog,
		CapabilityDefinition,
		CapabilityInstance,
		Diagnostic,
		MethodContent,
		Scalar
	} from '@trading-os/trading-domain';
	let {
		definition,
		instance,
		index,
		content,
		catalog,
		diagnostics,
		onChange
	}: {
		definition: CapabilityDefinition;
		instance: CapabilityInstance;
		index: number;
		content: MethodContent;
		catalog: CapabilityCatalog;
		diagnostics: readonly Diagnostic[];
		onChange: (key: string, value: Scalar) => void;
	} = $props();
</script>

<div class="mw-fields">
	{#each definition.fields as field (field.key)}
		{@const controlId = `cap-${instance.id}-${field.key}`}
		{@const errors = diagnostics.filter(
			(d) => d.path === `capabilities.${index}.config.${field.key}`
		)}
		<div class="mw-field">
			<label for={controlId}>{field.label}</label>
			{#if field.type === 'enum' || field.type === 'context' || field.type === 'instance'}
				<select
					id={controlId}
					value={String(instance.config[field.key] ?? '')}
					aria-invalid={errors.length > 0}
					aria-describedby={`${controlId}-help ${controlId}-error`}
					onchange={(e) => onChange(field.key, e.currentTarget.value)}
				>
					<option value="">Choose…</option>
					{#if field.type === 'enum'}
						{#each field.options as option (option)}<option value={option}>{option}</option>{/each}
					{:else if field.type === 'context'}
						{#each content.observations as o, i (`${o.id}-${i}`)}<option value={o.id}
								>{o.label || o.id} · {o.timeframe || 'timeframe unset'}</option
							>{/each}
					{:else}
						{#each content.capabilities
							.slice(0, index)
							.filter((c) => catalog.resolve(c.capabilityId, c.revision)?.output === field.output) as c (c.id)}<option
								value={c.id}>{catalog.resolve(c.capabilityId, c.revision)?.label} · {c.id}</option
							>{/each}
					{/if}
				</select>
			{:else if field.type === 'number'}
				<input
					id={controlId}
					type="number"
					value={instance.config[field.key]}
					min={field.min}
					max={field.max}
					step={field.integer ? 1 : 'any'}
					aria-invalid={errors.length > 0}
					aria-describedby={`${controlId}-help ${controlId}-error`}
					oninput={(e) =>
						onChange(field.key, e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)}
				/>
			{:else if field.type === 'boolean'}
				<input
					id={controlId}
					type="checkbox"
					checked={instance.config[field.key] === true}
					aria-describedby={`${controlId}-help ${controlId}-error`}
					onchange={(e) => onChange(field.key, e.currentTarget.checked)}
				/>
			{:else}
				<textarea
					id={controlId}
					rows="2"
					maxlength={field.maxLength}
					value={String(instance.config[field.key] ?? '')}
					aria-invalid={errors.length > 0}
					aria-describedby={`${controlId}-help ${controlId}-error`}
					oninput={(e) => onChange(field.key, e.currentTarget.value)}
				></textarea>
			{/if}
			<small id={`${controlId}-help`}>{field.description}</small>
			<span class="mw-error" id={`${controlId}-error`}
				>{errors.map((d) => d.message).join(' ')}</span
			>
		</div>
	{/each}
</div>
