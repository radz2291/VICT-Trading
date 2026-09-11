<script lang="ts">
	import type { CapabilityCatalog, MethodVersion } from '@trading-os/trading-domain';
	let { version, catalog }: { version: MethodVersion; catalog: CapabilityCatalog } = $props();
	function displayValue(type: string | undefined, value: string | number | boolean) {
		if (type === 'context') {
			const context = version.content.observations.find((o) => o.id === value);
			if (context) return `${context.label} · ${context.instrument} · ${context.timeframe}`;
		}
		if (type === 'instance') {
			const index = version.content.capabilities.findIndex((c) => c.id === value);
			const instance = version.content.capabilities[index];
			if (instance)
				return `${index + 1}. ${catalog.resolve(instance.capabilityId, instance.revision)?.label ?? instance.capabilityId}`;
		}
		return String(value);
	}
</script>

<article class="mw-snapshot" aria-label="Immutable version content">
	<h3>{version.content.name}</h3>
	<p>{version.content.description || 'No description.'}</p>
	<dl class="mw-provenance">
		<div>
			<dt>Identity</dt>
			<dd class="mw-mono">{version.id}</dd>
		</div>
		<div>
			<dt>Fingerprint · SHA-256</dt>
			<dd class="mw-mono">{version.fingerprint.slice(7)}</dd>
		</div>
		<div>
			<dt>Created</dt>
			<dd>{version.createdAt}</dd>
		</div>
		<div>
			<dt>Provenance</dt>
			<dd>
				{version.provenance.kind}{#if version.provenance.sourceVersionId}
					· source <span class="mw-mono">{version.provenance.sourceVersionId}</span><br />source
					lineage <span class="mw-mono">{version.provenance.sourceMethodId}</span><br />source
					fingerprint <span class="mw-mono">{version.provenance.sourceFingerprint}</span>{/if}
			</dd>
		</div>
	</dl>
	<h4>Observation requirements</h4>
	<ul>
		{#each version.content.observations as o (o.id)}<li>
				{o.label} · {o.instrument} · {o.timeframe} · {o.dataType}
			</li>{/each}
	</ul>
	<h4>
		Capability composition · {version.content.rulePolicy === 'all'
			? 'all rules required'
			: 'any rule sufficient'}
	</h4>
	<ol class="mw-snapshot-capabilities">
		{#each version.content.capabilities as c (c.id)}{@const d = catalog.resolve(
				c.capabilityId,
				c.revision
			)}
			<li>
				<strong>{d?.label ?? c.capabilityId}</strong>
				<span class="mw-badge">{d?.category ?? 'unsupported'} · rev {c.revision}</span>{#if !d}<p
						class="mw-error"
					>
						Unsupported capability revision — retained immutable content.
					</p>{/if}
				<dl>
					{#each Object.entries(c.config) as [key, value] (key)}<div>
							<dt>{d?.fields.find((f) => f.key === key)?.label ?? key}</dt>
							<dd>{displayValue(d?.fields.find((f) => f.key === key)?.type, value)}</dd>
						</div>{/each}
				</dl>
			</li>{/each}
	</ol>
	<details>
		<summary>Canonical definition · read only</summary>
		<pre>{version.canonical}</pre>
	</details>
</article>
