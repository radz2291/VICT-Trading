import { it, expect } from 'vitest';
import DataCatalog from '../src/evaluation/DataCatalog.svelte';
import EvaluationWorkspace from '../src/evaluation/EvaluationWorkspace.svelte';
import { mountWithServices, testServices } from './helpers.svelte.ts';
it('data and evaluation fail visibly without registered services', () => {
	for (const component of [DataCatalog, EvaluationWorkspace]) {
		const mounted = mountWithServices(component, testServices());
		expect(mounted.container.querySelector('[role="alert"]')?.textContent).toContain(
			'services are unavailable'
		);
		expect(mounted.container.textContent).toContain('Deterministic fixture data');
		mounted.unmount();
	}
});
