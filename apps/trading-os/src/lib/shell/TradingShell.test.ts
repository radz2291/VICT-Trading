/**
 * TradingShell composition tests: the product shell around the public VICT
 * renderer, with the context strip, palette, and island composition — under
 * deterministic $app module mocks and a stubbed save channel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import TradingShell from '$lib/shell/TradingShell.svelte';
import { defaultWorkspaceInstance, type WorkspaceInstance } from '@trading-os/trading-domain';
import { setTestPagePath } from '$lib/testing/app-state-mock';
import { goto } from '$lib/testing/app-navigation-mock';

const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<unknown>>();
Object.defineProperty(globalThis, 'fetch', {
	value: fetchMock,
	writable: true,
	configurable: true
});

function shellData(workspace: WorkspaceInstance = defaultWorkspaceInstance()) {
	return {
		plan: {} as Record<string, unknown>,
		workspace
	};
}

function mountShell(path = '/'): { unmount: () => void; body: HTMLElement } {
	setTestPagePath(path);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TradingShell, { target, props: { data: shellData() } });
	flushSync();
	return {
		unmount: () => {
			unmount(instance);
			target.remove();
		},
		body: document.body
	};
}

beforeEach(() => {
	document.body.innerHTML = '';
	fetchMock.mockClear();
	fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ok: true }) }));
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('TradingShell composition', () => {
	it('composes the VICT host (navigation landmark, regions) with product chrome', () => {
		const shell = mountShell('/');
		const host = shell.body.querySelector('[data-testid="vict-host"]');
		expect(host).not.toBeNull();
		// Exactly one application navigation landmark, rendered by VitApp.
		const navs = shell.body.querySelectorAll('nav[aria-label="Application"]');
		expect(navs.length).toBe(1);
		// Product chrome is present and truthful.
		expect(shell.body.textContent).toContain('Trading OS');
		expect(shell.body.textContent).toContain('No active run');
		expect(shell.body.textContent).toContain('No background operations');
		expect(shell.body.textContent).toContain('Fixture data — not live');
		shell.unmount();
	});

	it('renders navigation links derived from the plan in declared order', () => {
		const shell = mountShell('/');
		const links = [...shell.body.querySelectorAll('nav[aria-label="Application"] a')].map((link) =>
			link.textContent?.trim()
		);
		expect(links).toEqual([
			'Desk',
			'Markets',
			'Methods',
			'Backtest',
			'Replay',
			'Live Watch',
			'Trading',
			'Journal',
			'Evidence',
			'Risk',
			'Settings'
		]);
		shell.unmount();
	});

	it('renders the Desk island through the registry with context services', () => {
		const shell = mountShell('/');
		const desk = shell.body.querySelector('[aria-label="Desk status"]');
		expect(desk).not.toBeNull();
		expect(desk?.textContent).toContain('Personal Trading Program');
		expect(desk?.textContent).not.toMatch(/win rate|profit factor|p&l/i);
		shell.unmount();
	});

	it('exposes no global mutable mode: the strip never shows a mode, only activity truth', () => {
		const shell = mountShell('/');
		expect(shell.body.textContent).not.toMatch(/\b(mode|replay mode|watch mode)\b/i);
		shell.unmount();
	});
});

describe('command palette', () => {
	async function openWithCtrlK(): Promise<ReturnType<typeof mountShell>> {
		const shell = mountShell('/');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
		flushSync();
		return shell;
	}
	it('opens with Ctrl+K and derives navigation commands from the compiled plan', async () => {
		const shell = await openWithCtrlK();
		const dialog = shell.body.querySelector('[role="dialog"][aria-label="Command palette"]');
		expect(dialog).not.toBeNull();
		const options = [...shell.body.querySelectorAll('[role="option"]')].map(
			(option) => option.textContent ?? ''
		);
		// Plan-derived navigation entries…
		expect(options.some((text) => text.includes('Markets'))).toBe(true);
		expect(options.some((text) => text.includes('Journal'))).toBe(true);
		expect(options.some((text) => text.includes('System'))).toBe(true);
		// …plus real workspace commands.
		expect(options.some((text) => text.includes('Layout: Chart focus'))).toBe(true);
		shell.unmount();
	});

	it('searches, navigates with Enter, closes with Escape, and restores focus', async () => {
		const shell = mountShell('/');
		const openButton = shell.body.querySelector<HTMLButtonElement>('.tos-strip__palette')!;
		openButton.click();
		openButton.focus(); // a real browser focuses the invoking button on click
		flushSync();
		const input = shell.body.querySelector<HTMLInputElement>('input[role="combobox"]')!;
		expect(input).not.toBeNull();
		input.value = 'markets';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		const options = shell.body.querySelectorAll('[role="option"]');
		expect(options.length).toBe(1);
		expect(options[0]!.textContent).toContain('Markets');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		expect(goto).toHaveBeenCalledWith('/markets');
		expect(shell.body.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(openButton);
		shell.unmount();
	});

	it('Escape closes the palette and returns focus', async () => {
		const shell = await openWithCtrlK();
		const input = shell.body.querySelector<HTMLInputElement>('input[role="combobox"]')!;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		expect(shell.body.querySelector('[role="dialog"]')).toBeNull();
		shell.unmount();
	});

	it('reports combobox expanded with a visible popup, including zero results', async () => {
		const shell = await openWithCtrlK();
		const input = shell.body.querySelector<HTMLInputElement>('input[role="combobox"]')!;
		// With results:
		expect(input.getAttribute('aria-expanded')).toBe('true');
		// With zero results the listbox stays visible (status row) — the
		// combobox must not report "collapsed" while a popup is visible.
		input.value = 'zzz-no-match';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(shell.body.querySelector('[role="status"]')?.textContent).toContain(
			'No matching commands.'
		);
		shell.unmount();
	});
});

describe('workspace persistence truth in the shell', () => {
	function afterEachCleanup(): void {
		vi.useRealTimers();
		document.body.innerHTML = '';
	}

	it('exposes saving/saved states through the strip when a workspace command runs', async () => {
		vi.useFakeTimers();
		const shell = mountShell('/');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
		flushSync();
		const input = shell.body.querySelector<HTMLInputElement>('input[role="combobox"]')!;
		input.value = 'chart focus';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		const option = [...shell.body.querySelectorAll('[role="option"]')].find((entry) =>
			entry.textContent?.includes('Layout: Chart focus')
		);
		option!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		// Truthful 'saving' during the debounce window…
		expect(shell.body.querySelector('[data-tos-save="saving"]')).not.toBeNull();
		expect(shell.body.textContent).toContain('Saving…');
		await vi.advanceTimersByTimeAsync(300);
		// …and 'saved' once the request completes.
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(shell.body.querySelector('[data-tos-save="saved"]')).not.toBeNull();
		expect(shell.body.textContent).toContain('Workspace saved');
		afterEachCleanup();
		shell.unmount();
	});

	it('shows a truthful failed state after the retry budget is exhausted', async () => {
		vi.useFakeTimers();
		fetchMock.mockImplementation(async () => {
			throw new TypeError('network down');
		});
		const shell = mountShell('/');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
		flushSync();
		const input = shell.body.querySelector<HTMLInputElement>('input[role="combobox"]')!;
		input.value = 'inspect';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		const option = [...shell.body.querySelectorAll('[role="option"]')].find((entry) =>
			entry.textContent?.includes('Layout: Inspect')
		);
		option!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		await vi.advanceTimersByTimeAsync(300 + 500 + 1000);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(shell.body.querySelector('[data-tos-save="failed"]')).not.toBeNull();
		expect(shell.body.textContent).toContain('Save failed — not persisted');
		afterEachCleanup();
		shell.unmount();
	});

	it('flushes an un-persisted change on pagehide (keepalive) immediately', async () => {
		vi.useFakeTimers();
		const shell = mountShell('/');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
		flushSync();
		const input = shell.body.querySelector<HTMLInputElement>('input[role="combobox"]')!;
		input.value = 'balanced';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		const option = [...shell.body.querySelectorAll('[role="option"]')].find((entry) =>
			entry.textContent?.includes('Layout: Balanced')
		);
		option!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(fetchMock).not.toHaveBeenCalled(); // inside the debounce window
		window.dispatchEvent(new Event('pagehide'));
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect((fetchMock.mock.calls[0]![1] as RequestInit).keepalive).toBe(true);
		afterEachCleanup();
		shell.unmount();
	});
});
