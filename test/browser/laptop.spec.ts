/**
 * Laptop browser proof (1024×768): the compact desktop arrangement with the
 * watchlist beside the chart and no horizontal overflow.
 */
import { expect, test } from '@playwright/test';

test.beforeEach(() => {
	test.skip(test.info().project.name !== 'laptop', 'laptop project only');
});

test.describe('Trading OS laptop (1024×768)', () => {
	test('markets keeps the two-column workspace without horizontal overflow', async ({ page }) => {
		await page.goto('/markets');
		// Deterministic default arrangement (state may persist from other runs).
		const shell = page.locator('.tos-shell');
		if ((await shell.getAttribute('data-tos-layout')) !== 'balanced') {
			await page.locator('.controls__seg').filter({ hasText: 'Balanced' }).click();
			await page.waitForTimeout(800);
		}
		await expect(page.locator('.chart-panel__plot canvas').first()).toBeVisible({
			timeout: 15_000
		});
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
		const watchlist = page.getByRole('region', { name: 'Instrument watchlist' });
		await expect(watchlist).toBeVisible();
		const box = await watchlist.boundingBox();
		const chartBox = await page.locator('.chart-panel').boundingBox();
		expect(box).not.toBeNull();
		expect(chartBox).not.toBeNull();
		// Side-by-side arrangement: the watchlist sits to the right of the chart.
		expect(box!.x).toBeGreaterThan(chartBox!.x + chartBox!.width - 10);
		await page.screenshot({ path: 'test-results/t3/evidence/laptop-markets.png', fullPage: false });
	});
});
