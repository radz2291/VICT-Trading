import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { scanAccessibility, assertNoCriticalViolations } from './helpers';
import {
	reversionFixture,
	breakoutFixture
} from '../../packages/trading-capabilities/test/fixtures';
import type { MethodContent, StoredSeries } from '@trading-os/trading-domain';
const evidence = 'test-results/t3/evidence/t3';
async function act(api: APIRequestContext, actionId: string, input: unknown) {
	const r = await (await api.post('/api/act', { data: { actionId, input } })).json();
	expect(r.ok, JSON.stringify(r)).toBe(true);
	return r.value;
}
async function freeze(api: APIRequestContext, base: MethodContent, name: string) {
	let d = (await act(api, 'act.methodCreate', { op: 'create', requestId: randomUUID(), name }))
		.detail;
	d = (
		await act(api, 'act.methodSave', {
			op: 'save',
			requestId: randomUUID(),
			methodId: d.method.id,
			expectedRevision: d.draft.revision,
			content: { ...base, name }
		})
	).detail;
	return (
		await act(api, 'act.methodFreeze', {
			op: 'freeze',
			requestId: randomUUID(),
			methodId: d.method.id,
			expectedRevision: d.draft.revision
		})
	).detail.versions[0];
}
async function open(page: Page, name: string) {
	await page.goto('/research/methods');
	await page.getByLabel('Search Methods').fill(name);
	await page.locator('.mw-library-list button').filter({ hasText: name }).click();
	await page.getByRole('button', { name: 'Evaluate / Inspect', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Deterministic evaluation', exact: true })
	).toBeVisible();
}
async function shot(page: Page, name: string, project: string) {
	mkdirSync(evidence, { recursive: true });
	const target =
		name === 'configuration'
			? '.ev-config'
			: name === 'completed'
				? '.ev-results'
				: name === 'timestamp' || name === 'unavailable'
					? '[aria-label="Timestamp inspection"]'
					: name === 'failed'
						? '.ev-status'
						: null;
	if (target) await page.locator(target).evaluate((el) => el.scrollIntoView({ block: 'start' }));
	await page.screenshot({ scale: 'css', path: `${evidence}/${project}-${name}.png` });
}
async function audit(page: Page, name: string, project: string) {
	const result = await scanAccessibility(page);
	mkdirSync(evidence, { recursive: true });
	writeFileSync(
		`${evidence}/${project}-${name}-axe.json`,
		JSON.stringify(result.violations, null, 2)
	);
	assertNoCriticalViolations(result);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const controls = await page.locator('button,input,select,summary').evaluateAll((elements) =>
		elements
			.filter((el) => {
				const r = el.getBoundingClientRect(),
					s = getComputedStyle(el);
				return (
					r.width > 0 &&
					r.height > 0 &&
					s.visibility !== 'hidden' &&
					r.bottom > 0 &&
					r.top < innerHeight
				);
			})
			.map((el) => ({
				label: el.getAttribute('aria-label') || el.textContent?.slice(0, 70) || el.id,
				left: el.getBoundingClientRect().left,
				right: el.getBoundingClientRect().right
			}))
			.filter((r) => r.left < -0.5 || r.right > innerWidth + 0.5)
	);
	expect(controls).toEqual([]);
	const box = await page
		.getByRole('button', { name: 'Open command palette (Control K)' })
		.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	expect(box!.y).toBeGreaterThanOrEqual(0);
	expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}
test.beforeEach(async ({ page }, info) => {
	if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
});
test('T3 catalog, governed fixture install and health', async ({ page }, info) => {
	await page.goto('/markets');
	await expect(page.getByRole('heading', { name: 'Market data library' })).toBeVisible();
	await page.getByRole('button', { name: 'Install deterministic fixture', exact: true }).click();
	await expect(page.getByText(/Installation confirmed ·/)).toBeVisible();
	await expect(page.locator('.ev-series')).toHaveCount(5);
	await expect(page.getByText('3 missing bars', { exact: true })).toBeVisible();
	await shot(page, 'catalog', info.project.name);
	await audit(page, 'catalog', info.project.name);
	await page
		.locator('.ev-series')
		.first()
		.getByRole('button', { name: 'Inspect stored bars' })
		.click();
	await expect(page.locator('.ev-chart canvas').first()).toBeVisible();
});
test('T3 prerequisite, evaluation, timestamp inspection, reload and deterministic rerun', async ({
	page,
	request
}, info) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'warning' && /hydration/i.test(m.text())) errors.push(m.text());
	});
	await page.goto('/research/methods');
	await page.getByRole('button', { name: 'Evaluation inspector', exact: true }).click();
	await expect(page.getByText('Start with a frozen Method Version', { exact: true })).toBeVisible();
	await audit(page, 'prerequisite', info.project.name);
	await act(request, 'act.fixtureInstall', {
		op: 'install',
		requestId: randomUUID(),
		fixtureRevision: '1'
	});
	const name = `T3 mean study ${info.project.name}`,
		v = await freeze(request, reversionFixture, name);
	await open(page, name);
	const series = (await act(request, 'act.dataRead', { op: 'catalog' })).series as StoredSeries[];
	const daily = series.find((s) => s.instrument === 'EXAMPLE-B')!;
	await page.locator('#binding-daily').selectOption(daily.id);
	await page.getByRole('button', { name: 'Use last 96 intervals' }).click();
	await page.getByRole('checkbox', { name: /Use calculation revision/ }).check();
	await page.locator('.ev-config').scrollIntoViewIfNeeded();
	await shot(page, 'configuration', info.project.name);
	await audit(page, 'configuration', info.project.name);
	await page.getByRole('button', { name: 'Start deterministic evaluation', exact: true }).click();
	await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'succeeded');
	await expect(page.getByRole('region', { name: 'Completed evaluation' })).toBeVisible();
	await page.getByRole('region', { name: 'Completed evaluation' }).scrollIntoViewIfNeeded();
	await shot(page, 'completed', info.project.name);
	await audit(page, 'completed', info.project.name);
	await page.getByLabel('Inspect timestamp (UTC close)').selectOption('40');
	await expect(page.getByRole('region', { name: 'Timestamp inspection' })).toContainText(
		'Mean reference'
	);
	await page.getByRole('region', { name: 'Timestamp inspection' }).scrollIntoViewIfNeeded();
	await shot(page, 'timestamp', info.project.name);
	await page.getByRole('button', { name: 'Show driver chart for this result' }).click();
	await expect(page.locator('.stored-chart canvas').first()).toBeVisible();
	await page.getByLabel('Inspect timestamp (UTC close)').selectOption('42');
	const runs = (await act(request, 'act.dataRead', { op: 'runs', methodVersionId: v.id })).runs;
	const first = await act(request, 'act.dataRead', { op: 'get', runId: runs[0].id });
	expect(first.result.content.counts.true).toBeGreaterThan(0);
	expect(first.result.content.counts.false).toBeGreaterThan(0);
	await page.reload();
	await page.getByRole('button', { name: 'Evaluation inspector', exact: true }).click();
	await page
		.getByRole('region', { name: 'Saved evaluations' })
		.getByRole('button')
		.filter({ hasText: name })
		.first()
		.click();
	await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'succeeded');
	await expect(page.getByRole('region', { name: 'Completed evaluation' })).toContainText(name);
	await open(page, name);
	await page.locator('#binding-daily').selectOption(daily.id);
	await page.getByRole('button', { name: 'Use last 96 intervals' }).click();
	await page.getByRole('checkbox', { name: /Use calculation revision/ }).check();
	await page.getByRole('button', { name: 'Start deterministic evaluation', exact: true }).click();
	await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'succeeded');
	const latest = (await act(request, 'act.dataRead', { op: 'runs', methodVersionId: v.id }))
		.runs[0];
	expect(latest.id).not.toBe(first.run.id);
	expect(latest.resultFingerprint).toBe(first.run.resultFingerprint);
	expect(
		(await act(request, 'act.dataRead', { op: 'get', runId: latest.id })).result.canonical
	).toBe(first.result.canonical);
	expect(errors).toEqual([]);
});
test('T3 warm-up and real bounded evaluation failure never show stale results', async ({
	page,
	request
}, info) => {
	await act(request, 'act.fixtureInstall', {
		op: 'install',
		requestId: randomUUID(),
		fixtureRevision: '1'
	});
	const name = `T3 range study ${info.project.name}`;
	await freeze(request, breakoutFixture, name);
	const series = (await act(request, 'act.dataRead', { op: 'catalog' })).series as StoredSeries[];
	await open(page, name);
	const week = series.find((s) => s.timeframe === '1W')!,
		lower = series.find((s) => s.timeframe === '15m' && s.health.state === 'ready')!;
	await page.locator('#binding-macro').selectOption(week.id);
	await page.locator('#binding-entry').selectOption(lower.id);
	await page.getByLabel('Driver timeline').selectOption('entry');
	await page.getByLabel('From UTC (inclusive)').fill('2025-01-06T00:15');
	await page.getByLabel('Until UTC (exclusive)').fill('2025-01-07T00:15');
	await page.getByRole('checkbox', { name: /Use calculation revision/ }).check();
	await page.getByRole('button', { name: 'Start deterministic evaluation', exact: true }).click();
	await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'succeeded');
	await expect(page.getByRole('region', { name: 'Timestamp inspection' })).toContainText(
		'No current closed bar'
	);
	await page.getByRole('region', { name: 'Timestamp inspection' }).scrollIntoViewIfNeeded();
	await shot(page, 'unavailable', info.project.name);
	await audit(page, 'unavailable', info.project.name);
	const gapped = series.find((s) => s.health.state === 'gaps')!,
		gap = gapped.health.gaps[0]!;
	await page.locator('#binding-entry').selectOption(gapped.id);
	await page
		.getByLabel('From UTC (inclusive)')
		.fill(new Date(gap.start + gapped.durationMs).toISOString().slice(0, 16));
	await page
		.getByLabel('Until UTC (exclusive)')
		.fill(new Date(gap.end + 2 * gapped.durationMs).toISOString().slice(0, 16));
	await page.getByRole('button', { name: 'Start deterministic evaluation', exact: true }).click();
	await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'succeeded');
	await expect(page.getByRole('region', { name: 'Timestamp inspection' })).toContainText(
		'Gaps are never filled'
	);
	await page.locator('#binding-entry').selectOption(lower.id);
	await page.getByLabel('Driver timeline').selectOption('macro');
	await page.getByLabel('From UTC (inclusive)').fill('2025-01-06T00:00');
	await page.getByLabel('Until UTC (exclusive)').fill('2025-06-30T00:00');
	await page.getByRole('button', { name: 'Start deterministic evaluation', exact: true }).click();
	await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'failed');
	await expect(page.locator('.ev-status')).toContainText('shorter range');
	await expect(page.getByRole('region', { name: 'Completed evaluation' })).toHaveCount(0);
	await page.locator('.ev-status').scrollIntoViewIfNeeded();
	await shot(page, 'failed', info.project.name);
	await audit(page, 'failed', info.project.name);
});
test('T3 keyboard focus, modal Escape, reduced motion and mobile Ctrl K geometry', async ({
	page
}, info) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/research/methods');
	const palette = page.getByRole('button', { name: 'Open command palette (Control K)' });
	await palette.focus();
	expect(await palette.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(palette).toBeFocused();
	await page.getByRole('button', { name: 'New Method', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'New Method', exact: true })).toBeFocused();
	await page.getByRole('button', { name: 'Evaluation inspector', exact: true }).focus();
	await page.keyboard.press('Enter');
	await audit(page, 'keyboard', info.project.name);
});
