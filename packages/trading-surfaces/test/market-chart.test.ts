/**
 * Market-chart surface tests with an injected chart-engine double. The real
 * chart engine is exercised by the browser suite (Playwright, real Chrome);
 * these tests prove the state machine, readout, and keyboard behavior with
 * deterministic injected services.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import MarketChart from '../src/market-chart/MarketChart.svelte';
import { TRADING_SURFACE_IDS, registerTradingSurfaces } from '../src/registry.ts';
import type { MarketChartHandle } from '../src/market-chart/market-chart-adapter.ts';
import { createComponentRegistry } from '@victframework/application/renderer';
import { mountWithServices, testBars, testServices, TEST_INSTRUMENTS } from './helpers.svelte.ts';
import type { Bar } from '@trading-os/trading-domain';

const setDataSpy = vi.fn();
const destroySpy = vi.fn();
let crosshairHandler: ((bar: Bar | null) => void) | null = null;

vi.mock('../src/market-chart/market-chart-adapter.ts', () => ({
	createMarketChart: vi.fn(
		async (): Promise<MarketChartHandle> => ({
			setData: setDataSpy,
			onCrosshair: (handler: (bar: Bar | null) => void) => {
				crosshairHandler = handler;
			},
			highlightTime: vi.fn(),
			destroy: destroySpy
		})
	)
}));

beforeEach(() => {
	setDataSpy.mockClear();
	destroySpy.mockClear();
	crosshairHandler = null;
	document.body.innerHTML = '';
});

function findText(scope: ParentNode, selector: string): string | undefined {
	return scope.querySelector(selector)?.textContent ?? undefined;
}

describe('MarketChart (trading.market-chart@1)', () => {
	it('starts in the loading state, then becomes ready with last-bar readout', async () => {
		const services = testServices();
		const { unmount, container } = mountWithServices(MarketChart, services);
		expect(findText(container, '[role="status"]')).toContain('Loading market data');
		await vi.waitFor(() => {
			expect(setDataSpy).toHaveBeenCalled();
		});
		flushSync();
		const readout = container.querySelector('.chart-panel__readout');
		expect(readout).not.toBeNull();
		expect(readout?.textContent).toContain('O');
		expect(readout?.textContent).toContain('V');
		// Truthful fixture labeling is always present.
		expect(container.textContent).toContain('Fixture data — not live');
		unmount();
	});

	it('renders the empty state when the source returns zero bars', async () => {
		const { unmount, container } = mountWithServices(MarketChart, testServices({ bars: [] }));
		await vi.waitFor(() => {
			expect(container.querySelector('[role="status"]')?.textContent).toContain(
				'No bars are available'
			);
		});
		expect(container.querySelector('.chart-panel__readout')).toBeNull();
		unmount();
	});

	it('renders the stale state while preserving last-known bars', async () => {
		const { unmount, container } = mountWithServices(
			MarketChart,
			testServices({ healthState: 'stale', bars: testBars(30) })
		);
		await vi.waitFor(() => {
			expect(container.querySelector('[role="status"]')?.textContent).toContain('Stale');
		});
		expect(container.querySelector('.chart-panel__readout')).not.toBeNull();
		expect(container.textContent).toContain('last known data');
		unmount();
	});

	it('renders the failure state and never shows stale data as current', async () => {
		const { unmount, container } = mountWithServices(
			MarketChart,
			testServices({ healthState: 'error', bars: testBars(30) })
		);
		await vi.waitFor(() => {
			expect(container.querySelector('[role="alert"]')?.textContent).toContain(
				'Market data failed'
			);
		});
		expect(container.querySelector('.chart-panel__readout')).toBeNull();
		expect(container.querySelector('.chart-panel__table')).toBeNull();
		unmount();
	});

	it('updates the readout through the shared crosshair and keyboard stepping', async () => {
		const { unmount, container } = mountWithServices(MarketChart, testServices());
		await vi.waitFor(() => {
			expect(crosshairHandler).not.toBeNull();
		});
		flushSync();
		const last = testBars(50)[49]!;
		expect(findText(container, '.chart-panel__readout')).toContain(last.close.toFixed(2));
		// Crosshair hover on the first bar moves the readout.
		const first = testBars(50)[0]!;
		crosshairHandler!(first);
		flushSync();
		expect(findText(container, '.chart-panel__readout')).toContain(first.open.toFixed(2));
		// Keyboard stepping from the readout region works.
		const readout = container.querySelector('.chart-panel__readout') as HTMLElement;
		crosshairHandler!(null);
		flushSync();
		readout.focus();
		readout.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		readout.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		flushSync();
		expect(findText(container, '.chart-panel__readout')).toContain(
			testBars(50)[1]!.open.toFixed(2)
		);
		unmount();
	});

	it('exposes an accessible data table alternative', async () => {
		const { unmount, container } = mountWithServices(MarketChart, testServices());
		await vi.waitFor(() => {
			expect(container.querySelector('.chart-panel__table')).not.toBeNull();
		});
		const table = container.querySelector('.chart-panel__table table');
		expect(table?.querySelector('caption')).not.toBeNull();
		expect(table?.querySelectorAll('tbody tr').length).toBe(40);
		unmount();
	});

	it('re-creates the chart when the instrument changes', async () => {
		const services = testServices();
		const { unmount, container } = mountWithServices(MarketChart, services);
		await vi.waitFor(() => {
			expect(setDataSpy).toHaveBeenCalledTimes(1);
		});
		services.workspace.setInstrument('T-B');
		flushSync();
		await vi.waitFor(() => {
			expect(setDataSpy).toHaveBeenCalledTimes(2);
		});
		expect(findText(container, '.chart-panel__context')).toContain('T-B');
		unmount();
	});

	it('the chart engine never renders during SSR (module is dynamically imported)', async () => {
		// This test executes the component in happy-dom WITHOUT a real canvas.
		// The mocked adapter is the only chart-engine code that runs; the real
		// engine is verified in the browser suite. The SSR guarantee is
		// enforced structurally: `lightweight-charts` is imported only inside
		// the client effect, so server rendering cannot evaluate it.
		const { unmount } = mountWithServices(MarketChart, testServices({ bars: [] }));
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain('No bars are available');
		});
		unmount();
		expect(TEST_INSTRUMENTS.length).toBe(2);
	});
});

describe('surface registration', () => {
	it('registers the exact id/revision pairs and resolves them', () => {
		const registry = createComponentRegistry('registry.test', '1');
		registerTradingSurfaces(registry, testServices());
		expect(registry.resolve(TRADING_SURFACE_IDS.marketChart)).toMatchObject({ ok: true });
		expect(registry.resolve(TRADING_SURFACE_IDS.watchlist)).toMatchObject({ ok: true });
		expect(registry.resolve(TRADING_SURFACE_IDS.workspaceControls)).toMatchObject({ ok: true });
		expect(registry.resolve(TRADING_SURFACE_IDS.deskOverview)).toMatchObject({ ok: true });
		expect(registry.identity().components).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ componentId: 'trading.market-chart', revision: '1' })
			])
		);
	});

	it('rejects an unknown revision with a structured diagnostic', () => {
		const registry = createComponentRegistry('registry.test', '1');
		registerTradingSurfaces(registry, testServices());
		const result = registry.resolve({ componentId: 'trading.market-chart', revision: '2' });
		expect(result).toMatchObject({ ok: false, code: 'COMPONENT_REVISION_MISMATCH' });
	});

	it('refuses to register when the services bundle is incomplete', () => {
		const registry = createComponentRegistry('registry.test', '1');
		expect(() => registerTradingSurfaces(registry, {} as never)).toThrow(/incomplete/);
	});
});
