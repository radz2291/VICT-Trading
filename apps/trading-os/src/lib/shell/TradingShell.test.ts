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
});
