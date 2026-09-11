import { describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import MethodsWorkspace from '../src/methods/MethodsWorkspace.svelte';
import MethodEditor from '../src/methods/MethodEditor.svelte';
import { mountWithServices, testServices } from './helpers.svelte.ts';
import { emptyMethodContent, type CapabilityCatalog } from '@trading-os/trading-domain';
const catalog: CapabilityCatalog = { definitions: [], resolve: () => undefined };
describe('generic authoring surface', () => {
	it('fails visibly if its service is not registered', () => {
		const mounted = mountWithServices(MethodsWorkspace, testServices());
		expect(mounted.container.textContent).toContain('Method services are unavailable');
		mounted.unmount();
	});
	it('shows incomplete and unsupported capability states with field relationships', () => {
		const content = {
			...emptyMethodContent(),
			capabilities: [
				{
					id: 'unknown',
					capabilityId: 'extension.new',
					revision: '99',
					config: { value: 'retained' }
				}
			]
		};
		const mounted = mountWithServices(MethodEditor, testServices(), {
			content,
			catalog,
			disabled: false,
			onChange: () => {},
			diagnostics: [{ code: 'REQUIRED', path: 'name', message: 'Name this Method.' }]
		});
		expect(mounted.container.textContent).toContain('Unsupported capability revision');
		expect(mounted.container.textContent).toContain('retained');
		expect(mounted.container.querySelector('#method-name')?.getAttribute('aria-describedby')).toBe(
			'method-name-error'
		);
		expect(mounted.container.querySelector('#method-name')?.getAttribute('aria-invalid')).toBe(
			'true'
		);
		mounted.unmount();
	});
	it('emits structured changes, keeps immutable input intact, and supports keyboard-native controls', () => {
		let received = emptyMethodContent();
		const input = emptyMethodContent('Study');
		const mounted = mountWithServices(MethodEditor, testServices(), {
			content: input,
			catalog,
			disabled: false,
			diagnostics: [],
			onChange: (value: typeof input) => {
				received = value;
			}
		});
		const name = mounted.container.querySelector<HTMLInputElement>('#method-name')!;
		name.value = 'Changed';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		expect(received.name).toBe('Changed');
		expect(input.name).toBe('Study');
		const add = [...mounted.container.querySelectorAll<HTMLButtonElement>('button')].find(
			(b) => b.textContent === 'Add context'
		)!;
		add.click();
		expect(received.observations).toHaveLength(1);
		mounted.unmount();
	});
});
