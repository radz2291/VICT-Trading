<script lang="ts">
	import { onMount } from 'svelte';
	let {
		mode,
		initialName,
		busy,
		onConfirm,
		onClose
	}: {
		mode: 'create' | 'freeze' | 'clone';
		initialName: string;
		busy: boolean;
		onConfirm: (name: string) => void;
		onClose: () => void;
	} = $props();
	let dialog: HTMLDialogElement;
	let name = $state('');
	const title = $derived(
		mode === 'create'
			? 'Create Method'
			: mode === 'clone'
				? 'Clone into a new Method'
				: 'Freeze immutable version'
	);
	onMount(() => {
		const opener = document.activeElement;
		name = initialName;
		dialog.showModal();
		return () => {
			dialog.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="mw-dialog"
	aria-labelledby="method-dialog-title"
	onkeydown={(event) => {
		if (event.key !== 'Tab') return;
		const controls = [
			...dialog.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
		];
		const first = controls[0],
			last = controls.at(-1);
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last?.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first?.focus();
		}
	}}
	oncancel={(e) => {
		e.preventDefault();
		if (!busy) onClose();
	}}
>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onConfirm(name);
		}}
	>
		<h2 id="method-dialog-title">{title}</h2>
		<p>
			{mode === 'freeze'
				? 'This saves an immutable snapshot of the validated, persisted draft and consumes that draft. To change it later, create a revision in the same lineage. Evaluation begins in T3.'
				: mode === 'clone'
					? 'A clone starts a new Method lineage with a working draft based on the selected immutable version. Its source provenance is retained.'
					: 'Start a named lineage with a working draft. You can save incomplete work, then validate and freeze an immutable version.'}
		</p>
		{#if mode !== 'freeze'}<label for="dialog-method-name">Method name</label><input
				id="dialog-method-name"
				bind:value={name}
				maxlength="120"
				required
				disabled={busy}
			/>{/if}
		<div class="mw-dialog-actions">
			<button type="button" onclick={onClose} disabled={busy}>Cancel</button><button
				class="mw-primary"
				type="submit"
				disabled={busy || (mode !== 'freeze' && !name.trim())}
				>{busy
					? 'Saving…'
					: mode === 'freeze'
						? 'Confirm freeze'
						: mode === 'clone'
							? 'Create clone'
							: 'Create Method'}</button
			>
		</div>
	</form>
</dialog>
