/**
 * Browser proof of persistence truth (closure remediation of audit finding
 * F-4): the context strip must truthfully expose the Workspace Instance
 * save channel — saving → saved on success, an explicit failed state when
 * saves cannot reach the server (with automatic recovery), and a pagehide
 * flush that closes the reload-inside-the-debounce-window loss gap.
 *
 * Every step toggles to the layout that is NOT currently active: clicking
 * an already-selected radio fires no `change` event, so no save would run.
 *
 * Screenshots are written to gitignored `test-results/t3/evidence/` — a test
 * run never mutates committed evidence. The closure snapshots in
 * `docs/evidence/t1-closure/` were captured by this suite at closure time
 * and committed once.
 *
 * Runs only on the desktop project (the strip states are viewport-
 * independent).
 */
import { expect, test, type Page } from '@playwright/test';
import { assertNoCriticalViolations, scanAccessibility } from './helpers.ts';

async function openMarkets(page: Page): Promise<void> {
	await page.goto('/markets');
	await expect(page.locator('.chart-panel__plot canvas').first()).toBeVisible({
		timeout: 15_000
	});
}

/**
 * Switch to the layout preset that is not currently active and wait for
 * the shell attribute to reflect it. Returns the preset that became active.
 */
async function toggleLayout(page: Page): Promise<'balanced' | 'inspect'> {
	const current = await page.locator('.tos-shell').getAttribute('data-tos-layout');
	const target = current === 'inspect' ? 'balanced' : 'inspect';
	await page
		.locator('.controls__seg')
		.filter({ hasText: target === 'inspect' ? 'Inspect' : 'Balanced' })
		.click();
	await expect(page.locator('.tos-shell')).toHaveAttribute('data-tos-layout', target);
	return target;
}

test.describe('persistence truth (save channel)', () => {
	test.beforeEach(() => {
		test.skip(test.info().project.name !== 'desktop', 'desktop project only');
	});

	test('a workspace change reports saving, then Workspace saved', async ({ page }) => {
		await openMarkets(page);
		const strip = page.locator('[data-tos-save]');
		// Two genuine changes, each cycling the channel truthfully.
		await toggleLayout(page);
		await expect(strip).toHaveAttribute('data-tos-save', 'saved', { timeout: 10_000 });
		await expect(strip).toHaveText(/Workspace saved/);
		await toggleLayout(page);
		await expect(strip).toHaveAttribute('data-tos-save', 'saved', { timeout: 10_000 });
		await page.screenshot({ path: 'test-results/t3/evidence/desktop-markets-saved.png' });
	});

	test('unreachable saves turn the strip truthfully negative — then recover', async ({ page }) => {
		await openMarkets(page);
		// Sever the save channel after the page has loaded.
		await page.route('**/api/act', (route) => route.abort('failed'));
		await toggleLayout(page);
		// Saving → retried → failed (3 attempts, bounded backoff).
		const strip = page.locator('[data-tos-save]');
		await expect(strip).toHaveAttribute('data-tos-save', 'failed', { timeout: 15_000 });
		await expect(strip).toHaveText(/Save failed — not persisted/);
		await page.screenshot({ path: 'test-results/t3/evidence/desktop-markets-save-failed.png' });
		// Recovery: a working server plus a genuine change re-arms the channel.
		await page.unroute('**/api/act');
		await toggleLayout(page);
		await expect(strip).toHaveAttribute('data-tos-save', 'saved', { timeout: 15_000 });
	});

	test('a change flushed at pagehide persists across a reload', async ({ page }) => {
		await openMarkets(page);
		await toggleLayout(page);
		await expect(page.locator('[data-tos-save]')).toHaveAttribute('data-tos-save', 'saved', {
			timeout: 10_000
		});
		// Change and raise pagehide well inside the 300 ms debounce window:
		// the flush must persist the change immediately (unit tests prove the
		// keepalive request itself; here we prove the visible end-to-end
		// truth — flushed state survives a full reload).
		const target = await toggleLayout(page);
		await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
		await expect(page.locator('[data-tos-save]')).toHaveAttribute('data-tos-save', 'saved', {
			timeout: 10_000
		});
		await page.reload();
		await expect(page.locator('.tos-shell')).toHaveAttribute('data-tos-layout', target, {
			timeout: 15_000
		});
	});

	test('the save indicator holds no accessibility violation', async ({ page }) => {
		await openMarkets(page);
		await toggleLayout(page);
		const strip = page.locator('[data-tos-save]');
		await expect(strip).toHaveAttribute('data-tos-save', 'saved', { timeout: 10_000 });
		assertNoCriticalViolations(await scanAccessibility(page));
	});

	test('closure evidence: shell chrome after remediation (Desk, platform-aware shortcut)', async ({
		page
	}) => {
		await page.goto('/');
		await expect(page.locator('.tos-strip')).toBeVisible();
		// F-5: the shortcut label matches the running platform (Windows/Linux:
		// Ctrl K — never the macOS symbol). Functional Ctrl+K is proven by the
		// desktop suite.
		await expect(page.locator('.tos-strip__palette')).toHaveText('Ctrl K');
		await page.screenshot({ path: 'test-results/t3/evidence/desktop-desk.png' });
	});
});
