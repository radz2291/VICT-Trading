/**
 * Desktop browser proof for the running Trading OS application
 * (1440×900): navigation order, Desk truthfulness, the Markets workspace
 * (real chart engine, crosshair readout, persisted layout), the command
 * palette, reload continuity, and an axe accessibility scan.
 *
 * Screenshots are written to gitignored `test-results/t3/evidence/`: a test
 * run must never mutate committed evidence (the historical snapshots in
 * `docs/evidence/t1/` are byte-frozen).
 */
import { expect, test, type Page } from '@playwright/test';
import { assertNoCriticalViolations, scanAccessibility } from './helpers.ts';

async function noHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow, 'no horizontal page overflow').toBeLessThanOrEqual(0);
}

async function openCommandPalette(page: Page): Promise<void> {
	// Hydration may still be attaching the key handler right after a goto; the
	// palette must still open — retry the shortcut until the dialog appears.
	const dialog = page.getByRole('dialog', { name: 'Command palette' });
	for (let attempt = 0; attempt < 10; attempt += 1) {
		await page.keyboard.press('ControlOrMeta+k');
		try {
			await expect(dialog).toBeVisible({ timeout: 1_000 });
			return;
		} catch {
			await page.waitForTimeout(400);
		}
	}
	await expect(dialog, 'command palette must open via Ctrl+K').toBeVisible();
}

test.describe('Trading OS desktop (1440×900)', () => {
	test.beforeEach(() => {
		test.skip(test.info().project.name !== 'desktop', 'desktop project only');
	});

	test('navigation groups render in the declared order', async ({ page }) => {
		await page.goto('/');
		const nav = page.locator('nav[aria-label="Application"]');
		await expect(nav).toBeVisible();
		const labels = await nav.locator('a').allTextContents();
		expect(labels.map((label) => label.trim())).toEqual([
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
		const groupLabels = await nav.locator('.vict-nav-group-label').allTextContents();
		expect(groupLabels.map((label) => label.trim())).toEqual([
			'Research',
			'Practice',
			'Operate',
			'Review',
			'System'
		]);
	});

	test('the Desk shows only truthful T1 state', async ({ page }) => {
		await page.goto('/');
		const strip = page.locator('.tos-strip');
		await expect(strip).toContainText('Trading OS');
		await expect(strip).toContainText('No active run');
		await expect(strip).toContainText('No background operations');
		await expect(strip).toContainText('Fixture data — not live');
		const desk = page.getByRole('region', { name: 'Desk status' });
		await expect(desk).toContainText('Personal Trading Program');
		const body = await page.locator('body').innerText();
		expect(body).not.toMatch(/win rate|profit factor|p&l|equity curve|signal/i);
		await noHorizontalOverflow(page);
		await page.screenshot({ path: 'test-results/t3/evidence/desktop-desk.png', fullPage: false });
	});

	test('"Open Markets" navigates through the declared action', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Open Markets' }).click();
		await expect(page).toHaveURL(/\/markets$/);
	});

	test('the Markets workspace renders the real chart with candles, volume, and OHLCV readout', async ({
		page
	}) => {
		await page.goto('/markets');
		// Deterministic default arrangement for this proof (resets state left
		// by earlier runs of the suite on the shared preview database).
		const shell = page.locator('.tos-shell');
		if ((await shell.getAttribute('data-tos-layout')) !== 'balanced') {
			await page.locator('.controls__seg').filter({ hasText: 'Balanced' }).click();
			await page.waitForTimeout(800);
		}
		const plot = page.locator('.chart-panel__plot');
		await expect(plot).toBeVisible();
		await expect(plot.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
		// The chart engine draws candles and volume (two canvases in panes).
		await expect(plot.locator('canvas').nth(1)).toBeVisible();
		const readout = page.locator('.chart-panel__readout');
		await expect(readout).toBeVisible();
		const readoutText = (await readout.textContent()) ?? '';
		expect(readoutText).toMatch(/O[0-9]/);
		expect(readoutText).toMatch(/V[0-9]/);
		await expect(page.locator('.chart-panel')).toContainText('Fixture data — not live');
		await noHorizontalOverflow(page);
		// Watchlist with fixture instruments (scoped: the instrument <select>
		// also exposes list options).
		const watchlist = page.getByRole('region', { name: 'Instrument watchlist' });
		await expect(watchlist).toBeVisible();
		await expect(watchlist.getByRole('button', { name: /FXT-A/ })).toBeVisible();
		await expect(watchlist.getByRole('button', { name: /FXT-F/ })).toBeVisible();
		await page.screenshot({
			path: 'test-results/t3/evidence/desktop-markets.png',
			fullPage: false
		});
	});

	test('layout presets genuinely persist across a full reload', async ({ page }) => {
		await page.goto('/markets');
		await expect(page.locator('.chart-panel__plot canvas').first()).toBeVisible({
			timeout: 15_000
		});
		// Reset to the default layout first so the run is deterministic.
		await page.locator('.controls__seg').filter({ hasText: 'Balanced' }).click();
		await page.waitForTimeout(800);
		// Switch to the Inspect layout through the real controls (label click,
		// exactly like a trader with a mouse or keyboard would).
		await page.locator('.controls__seg').filter({ hasText: 'Inspect' }).click();
		await expect(page.locator('.tos-shell')).toHaveAttribute('data-tos-layout', 'inspect');
		// Wait for the debounced save to reach the server.
		await page.waitForTimeout(800);
		// Full reload: the workspace restores from SQLite.
		await page.reload();
		await expect(page.locator('.tos-shell')).toHaveAttribute('data-tos-layout', 'inspect', {
			timeout: 15_000
		});
		// Also verify the persisted instrument selection (watchlist option).
		await page
			.getByRole('region', { name: 'Instrument watchlist' })
			.getByRole('button', { name: /FXT-C/ })
			.click();
		await page.waitForTimeout(800);
		await page.reload();
		await expect(page.locator('.chart-panel__context')).toContainText('FXT-C', {
			timeout: 15_000
		});
		await page.screenshot({
			path: 'test-results/t3/evidence/desktop-markets-inspect.png',
			fullPage: false
		});
	});

	test('the command palette derives navigation from the plan and navigates', async ({ page }) => {
		await page.goto('/');
		// Focus the opener first so focus restoration is observable.
		await page.locator('.tos-strip__palette').focus();
		await openCommandPalette(page);
		const dialog = page.getByRole('dialog', { name: 'Command palette' });
		await expect(dialog.getByRole('option')).toHaveCount(15); // 11 nav + 3 layout + 1 watchlist
		await page.keyboard.type('evidence');
		await expect(dialog.getByRole('option')).toHaveCount(1);
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/review\/evidence$/);
		// The palette is closed; focus returns to the document body (SvelteKit's
		// post-navigation focus policy) — no trapped or lost focus.
		await expect(dialog).toBeHidden();
		const focusOnBody = await page.evaluate(() => document.activeElement === document.body);
		expect(focusOnBody, 'no trapped focus after palette navigation').toBe(true);
	});

	test('Escape closes the palette and focus returns to the opener', async ({ page }) => {
		await page.goto('/');
		await page.locator('.tos-strip__palette').click();
		const dialog = page.getByRole('dialog', { name: 'Command palette' });
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(page.locator('.tos-strip__palette')).toBeFocused();
	});

	test('no critical or serious axe violations on Desk and Markets', async ({ page }) => {
		for (const path of ['/', '/markets']) {
			await page.goto(path);
			await page.waitForTimeout(1_500);
			const result = await scanAccessibility(page);
			assertNoCriticalViolations(result);
		}
	});

	test('keyboard navigation reaches the chart inspection readout', async ({ page }) => {
		await page.goto('/markets');
		const readout = page.locator('.chart-panel__readout');
		await expect(readout).toBeVisible({ timeout: 15_000 });
		await readout.focus();
		const before = (await readout.textContent()) ?? '';
		await readout.press('Home');
		await readout.press('ArrowRight');
		const after = (await readout.textContent()) ?? '';
		expect(after).not.toBe(before);
		expect(after).toMatch(/O[0-9]/);
	});
});
