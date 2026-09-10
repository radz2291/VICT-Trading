/**
 * Mobile browser proof (390×844): stacked market workspace, working
 * navigation, no horizontal overflow, truthful states, and an axe scan.
 */
import { expect, test } from '@playwright/test';
import { assertNoCriticalViolations, scanAccessibility } from './helpers.ts';

test.beforeEach(() => {
	test.skip(test.info().project.name !== 'mobile', 'mobile project only');
});

test.describe('Trading OS mobile (390×844)', () => {
	test('navigation works through the mobile menu and closes on navigate', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('nav[aria-label="Application"]')).toBeHidden();
		await page.getByRole('button', { name: 'Menu' }).click();
		await expect(page.locator('nav[aria-label="Application"]')).toBeVisible();
		await page.getByRole('link', { name: 'Markets' }).click();
		await expect(page).toHaveURL(/\/markets$/);
		// The mobile nav closes after navigating (VICT mobile-nav policy).
		await expect(page.locator('nav[aria-label="Application"]')).toBeHidden();
	});

	test('the Markets workspace stacks and stays usable without horizontal overflow', async ({
		page
	}) => {
		await page.goto('/markets');
		await expect(page.locator('.chart-panel__plot canvas').first()).toBeVisible({
			timeout: 15_000
		});
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, 'no horizontal page overflow').toBeLessThanOrEqual(0);
		// Watchlist remains inspectable (stacked below the chart).
		const watchlist = page.getByRole('region', { name: 'Instrument watchlist' });
		await expect(watchlist).toBeVisible();
		// OHLCV readout remains reachable.
		await expect(page.locator('.chart-panel__readout')).toBeVisible();
		await page.screenshot({ path: 'test-results/evidence/mobile-markets.png', fullPage: false });
		// Scroll to the watchlist for a second evidence frame.
		await watchlist.scrollIntoViewIfNeeded();
		await page.screenshot({
			path: 'test-results/evidence/mobile-markets-watchlist.png',
			fullPage: false
		});
	});

	test('mobile navigation renders the declared order', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Menu' }).click();
		const nav = page.locator('nav[aria-label="Application"]');
		const groupLabels = await nav.locator('.vict-nav-group-label').allTextContents();
		expect(groupLabels.map((label) => label.trim())).toEqual([
			'Research',
			'Practice',
			'Operate',
			'Review',
			'System'
		]);
	});

	test('no critical or serious axe violations on mobile', async ({ page }) => {
		for (const path of ['/', '/markets']) {
			await page.goto(path);
			await page.waitForTimeout(1_200);
			const result = await scanAccessibility(page);
			assertNoCriticalViolations(result);
		}
	});
});
