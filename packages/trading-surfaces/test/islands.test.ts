import { beforeEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import Watchlist from '../src/watchlist/Watchlist.svelte';
import WorkspaceControls from '../src/workspace-controls/WorkspaceControls.svelte';
import DeskOverview from '../src/desk/DeskOverview.svelte';
import { mountWithServices, testServices, testWorkspace } from './helpers.svelte.ts';

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('Watchlist (trading.watchlist@1)', () => {
	it('lists every instrument with truthful fixture labeling', () => {
		const services = testServices();
		const { unmount, container } = mountWithServices(Watchlist, services);
		const text = container.textContent ?? '';
		expect(text).toContain('T-A');
		expect(text).toContain('T-B');
		expect(text).toContain('Test Alpha');
		expect(text).toContain('Fixture data — not live');
		expect(container.querySelectorAll('button.watchlist__row').length).toBe(2);
		unmount();
	});

	it('selecting an instrument updates the workspace (persisted via service)', () => {
		const services = testServices();
		const { unmount, container } = mountWithServices(Watchlist, services);
		const second = container.querySelectorAll<HTMLElement>('button.watchlist__row')[1]!;
		second.click();
		flushSync();
		expect(services.workspace.state.instrumentId).toBe('T-B');
		expect(second.getAttribute('aria-current')).toBe('true');
		unmount();
	});
});

describe('WorkspaceControls (trading.workspace-controls@1)', () => {
	it('renders instrument, timeframe, layout, and watchlist controls bound to the workspace', () => {
		const services = testServices();
		const { unmount, container } = mountWithServices(WorkspaceControls, services);
		expect(container.querySelector<HTMLSelectElement>('#tos-instrument')?.value).toBe('T-A');
		const radios = container.querySelectorAll<HTMLInputElement>('input[name="tos-timeframe"]');
		expect(radios.length).toBe(2);
		expect(radios[0]!.checked).toBe(true);
		unmount();
	});

	it('switching timeframe and layout updates the workspace', () => {
		const services = testServices();
		const { unmount, container } = mountWithServices(WorkspaceControls, services);
		const dayRadio = container.querySelectorAll<HTMLInputElement>(
			'input[name="tos-timeframe"]'
		)[1]!;
		dayRadio.checked = true;
		dayRadio.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(services.workspace.state.timeframeId).toBe('1D');
		const inspectRadio = container.querySelectorAll<HTMLInputElement>(
			'input[name="tos-layout"]'
		)[2]!;
		inspectRadio.checked = true;
		inspectRadio.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(services.workspace.state.layoutPreset).toBe('inspect');
		const toggle = container.querySelector<HTMLInputElement>('.controls__toggle input')!;
		toggle.checked = false;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(services.workspace.state.watchlistVisible).toBe(false);
		unmount();
	});
});

describe('DeskOverview (trading.desk-overview@1)', () => {
	it('shows only truthful T1 facts and no fake metrics', () => {
		const { unmount, container } = mountWithServices(DeskOverview, testServices());
		const text = container.textContent ?? '';
		expect(text).toContain('No active run');
		expect(text).toContain('No background operations');
		expect(text).toContain('Fixture data — not live');
		expect(text).toContain('T-A');
		// No invented analytics vocabulary anywhere on the Desk.
		expect(text).not.toMatch(/win rate|p&l|profit|signal|score|equity/i);
		unmount();
	});

	it('reports background operations truthfully when they exist', () => {
		const services = {
			marketData: testServices().marketData,
			workspace: testWorkspace(),
			backgroundOperations: {
				operations: [{ id: 'op-1', label: 'Example operation', state: 'running' as const }]
			}
		};
		const { unmount, container } = mountWithServices(DeskOverview, services);
		expect(container.textContent).toContain('1 active');
		unmount();
	});
});
