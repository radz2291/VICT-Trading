import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { scanAccessibility, assertNoCriticalViolations } from './helpers';
import {
	breakoutFixture,
	reversionFixture
} from '../../packages/trading-capabilities/test/fixtures';
import type { MethodContent, MethodDetail, MethodCommand } from '@trading-os/trading-domain';

async function action(request: APIRequestContext, command: MethodCommand): Promise<MethodDetail> {
	const actionId =
		(
			{
				create: 'act.methodCreate',
				save: 'act.methodSave',
				freeze: 'act.methodFreeze',
				revise: 'act.methodRevise',
				clone: 'act.methodClone',
				assign: 'act.methodAssign'
			} as Record<string, string>
		)[command.op] ?? 'act.methodRead';
	const result = await (
		await request.post('/api/act', { data: { actionId, input: command } })
	).json();
	expect(result.ok, JSON.stringify(result)).toBe(true);
	return result.value.detail;
}
async function seed(request: APIRequestContext, content: MethodContent, freeze = false) {
	const created = await action(request, {
		op: 'create',
		requestId: randomUUID(),
		name: content.name
	});
	const saved = await action(request, {
		op: 'save',
		requestId: randomUUID(),
		methodId: created.method.id,
		expectedRevision: created.draft!.revision,
		content
	});
	return freeze
		? action(request, {
				op: 'freeze',
				requestId: randomUUID(),
				methodId: saved.method.id,
				expectedRevision: saved.draft!.revision
			})
		: saved;
}
async function open(page: Page, name: string) {
	await page.goto('/research/methods');
	await expect(page.getByLabel('Search Methods')).toBeVisible();
	await page.getByLabel('Search Methods').fill(name);
	await page.locator('.mw-library-list button').filter({ hasText: name }).click();
	await expect(page.locator('.mw-detail-heading h3')).toHaveText(name);
}
async function screenshot(page: Page, name: string, project: string) {
	mkdirSync('test-results/evidence/t2', { recursive: true });
	await page.screenshot({ path: `test-results/evidence/t2/${project}-${name}.png` });
}
async function noOverflow(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(await page.locator('.tos-host').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
		true
	);
}
test.beforeEach(async ({ page }, info) => {
	if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
});

test('Method library honest empty, loading and unavailable states', async ({ page }, info) => {
	let release!: () => void;
	const gate = new Promise<void>((r) => {
		release = r;
	});
	await page.route('**/api/act', async (route) => {
		const op = route.request().postDataJSON()?.input?.op;
		if (op === 'list') {
			await gate;
			await route.fulfill({ json: { ok: true, value: { kind: 'library', methods: [] } } });
		} else if (op === 'profile')
			await route.fulfill({ json: { ok: true, value: { kind: 'profile', profile: null } } });
		else await route.continue();
	});
	await page.goto('/research/methods');
	await expect(page.getByText('Loading Method records…')).toBeVisible();
	release();
	await expect(
		page.getByText('No Methods yet. Create your first definition.', { exact: true })
	).toBeVisible();
	assertNoCriticalViolations(await scanAccessibility(page));
	await noOverflow(page);
	await screenshot(page, 'library-empty', info.project.name);
	await page.unrouteAll({ behavior: 'wait' });
	await page.route('**/api/act', (route) =>
		route.fulfill({ json: { ok: true, value: { kind: 'library', methods: [{}] } } })
	);
	await page.reload();
	await expect(page.getByText('Library unavailable. Retry to load records.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('create, configure, validate, save, freeze, revise, compare, clone and associate', async ({
	page
}, info) => {
	const name = `Range study ${info.project.name} ${randomUUID().slice(0, 6)}`;
	await page.goto('/research/methods');
	await expect(page.getByRole('button', { name: 'New Method', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'New Method', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByLabel('Method name', { exact: true }).fill(name);
	await page.getByRole('button', { name: 'Create Method', exact: true }).click();
	await expect(page.getByLabel('Method name', { exact: true })).toHaveValue(name);
	await page.getByRole('button', { name: 'Validate', exact: true }).click();
	await expect(
		page.getByText('Add at least one observation context.', { exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Add context', exact: true }).click();
	await page.getByLabel('Context label', { exact: true }).fill('Directional context');
	await page.getByLabel('Instrument', { exact: true }).fill('EXAMPLE-A');
	await page.getByLabel('Timeframe', { exact: true }).fill('1W');
	await page.getByRole('button', { name: 'Add context', exact: true }).click();
	await page.getByLabel('Context label', { exact: true }).nth(1).fill('Entry context');
	await page.getByLabel('Instrument', { exact: true }).nth(1).fill('EXAMPLE-A');
	await page.getByLabel('Timeframe', { exact: true }).nth(1).fill('15m');
	for (const definition of ['analysis.range@1', 'rule.range-relation@1', 'rule.session-window@1']) {
		await page.getByLabel('Add capability definition').selectOption(definition);
		await page.getByRole('button', { name: 'Add capability', exact: true }).click();
	}
	await page.getByLabel('Lookback bars').fill('26');
	const contexts = page.getByLabel('Observation context', { exact: true });
	await contexts.nth(1).selectOption({ label: 'Entry context · 15m' });
	await contexts.nth(2).selectOption({ label: 'Entry context · 15m' });
	await page.getByLabel('UTC window').selectOption('08:00–16:00');
	await page
		.getByLabel('Description', { exact: true })
		.fill('A structural authoring study. This definition has not been evaluated.');
	await expect(page.locator('.mw-status')).toContainText('Unsaved draft');
	await expect(page.getByRole('button', { name: 'Freeze version…' })).toBeDisabled();
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Saved');
	await page.getByRole('button', { name: 'Validate', exact: true }).click();
	await expect(
		page.getByText('Definition valid. Evaluation begins in T3.', { exact: true })
	).toBeVisible();
	await page.locator('.mw-detail-heading').scrollIntoViewIfNeeded();
	await screenshot(page, 'editor', info.project.name);
	await page.locator('#composition-heading').scrollIntoViewIfNeeded();
	await screenshot(page, 'composition', info.project.name);
	assertNoCriticalViolations(await scanAccessibility(page));
	await noOverflow(page);
	await page.getByRole('button', { name: 'Freeze version…' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	assertNoCriticalViolations(await scanAccessibility(page));
	await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(page.getByRole('button', { name: 'Confirm freeze' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Freeze version…' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('button', { name: 'Confirm freeze' }).click();
	await expect(page.getByText('Immutable · v1', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Method name', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
	await page.locator('.mw-detail-heading').scrollIntoViewIfNeeded();
	await screenshot(page, 'history', info.project.name);
	assertNoCriticalViolations(await scanAccessibility(page));
	await page.getByRole('button', { name: 'Use in workspace', exact: true }).click();
	await expect(page.locator('.mw-profile')).toContainText('Profile revision');
	await expect(
		page.locator('.tos-strip__item--status').filter({ hasText: 'Activity:' })
	).toContainText('No active run');
	await page.getByRole('button', { name: 'New revision', exact: true }).click();
	await page.getByLabel('Lookback bars').fill('40');
	await page
		.getByLabel('Description', { exact: true })
		.fill('Revised authored observation horizon.');
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Saved');
	await page.getByRole('button', { name: 'Freeze version…' }).click();
	await page.getByRole('button', { name: 'Confirm freeze' }).click();
	await expect(page.getByText('Immutable · v2', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
	await page.getByLabel('Earlier version').selectOption({ label: `v1 · ${name}` });
	await page.getByLabel('Later version').selectOption({ label: `v2 · ${name}` });
	await page.getByRole('button', { name: 'Compare', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Semantic version comparison' })).toContainText(
		'lookback'
	);
	await expect(page.locator('.mw-changes')).toContainText('26');
	await expect(page.locator('.mw-changes')).toContainText('40');
	await page.locator('.mw-detail-heading').scrollIntoViewIfNeeded();
	await screenshot(page, 'comparison', info.project.name);
	assertNoCriticalViolations(await scanAccessibility(page));
	await noOverflow(page);
	await page.getByRole('button', { name: 'Version history', exact: true }).click();
	await page.getByRole('button', { name: 'Clone Method…' }).click();
	await page.getByLabel('Method name', { exact: true }).fill(`${name} clone`);
	await page.getByRole('button', { name: 'Create clone', exact: true }).click();
	await expect(page.getByLabel('Method name', { exact: true })).toHaveValue(`${name} clone`);
	await expect(page.locator('.mw-draft-bar')).toContainText('clone');
	await page.reload();
	await page.getByLabel('Search Methods').fill(`${name} clone`);
	await page
		.locator('.mw-library-list button')
		.filter({ hasText: `${name} clone` })
		.click();
	await expect(page.getByLabel('Lookback bars')).toHaveValue('40');
	await expect(page.locator('.mw-profile')).toContainText('Profile revision');
	await page.getByRole('button', { name: 'Remove selection' }).click();
	await expect(page.locator('.mw-profile')).toContainText('No Method Version selected.');
});

test('save failure, exact retry and conflict recovery preserve authored content', async ({
	page,
	request
}, info) => {
	const name = `Recovery ${info.project.name} ${randomUUID().slice(0, 6)}`;
	const d = await seed(request, { ...reversionFixture, name });
	await open(page, name);
	const requests: unknown[] = [];
	await page.route('**/api/act', async (route) => {
		const body = route.request().postDataJSON();
		if (body?.input?.op === 'save') {
			requests.push(body.input);
			await route.fulfill({ status: 503, json: { ok: false, code: 'PERSISTENCE_FAILED' } });
		} else await route.continue();
	});
	await page.getByLabel('Description', { exact: true }).fill('Keep my pending work');
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Failed — persistence not confirmed');
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Keep my pending work');
	await page.locator('.mw-status').scrollIntoViewIfNeeded();
	await screenshot(page, 'failure', info.project.name);
	assertNoCriticalViolations(await scanAccessibility(page));
	await page.unrouteAll({ behavior: 'wait' });
	await page.route('**/api/act', async (route) => {
		const body = route.request().postDataJSON();
		if (body?.input?.op === 'save') requests.push(body.input);
		await route.continue();
	});
	await page.getByRole('button', { name: 'Retry', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Saved');
	expect(requests[0]).toEqual(requests[1]);
	const newer = await action(request, { op: 'get', methodId: d.method.id });
	await action(request, {
		op: 'save',
		requestId: randomUUID(),
		methodId: d.method.id,
		expectedRevision: newer.draft!.revision,
		content: { ...newer.draft!.content, description: 'Other tab saved this' }
	});
	await page.getByLabel('Description', { exact: true }).fill('My conflicted text');
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Conflict — changes not applied');
	await page.locator('.mw-status').scrollIntoViewIfNeeded();
	await screenshot(page, 'conflict', info.project.name);
	await page.getByRole('button', { name: 'Reload confirmed state' }).click();
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Other tab saved this');
	await page.getByRole('button', { name: 'Apply recovery to draft' }).click();
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue('My conflicted text');
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Saved');
	await noOverflow(page);
});

test('unsupported revisions remain inspectable and block version creation', async ({
	page,
	request
}, info) => {
	const name = `Unsupported ${info.project.name} ${randomUUID().slice(0, 6)}`;
	await seed(request, {
		...reversionFixture,
		name,
		capabilities: [
			{ ...reversionFixture.capabilities[0]!, revision: '99' },
			reversionFixture.capabilities[1]!
		]
	});
	await open(page, name);
	await expect(
		page.getByText('Unsupported capability revision. Content is retained; freezing is blocked.', {
			exact: true
		})
	).toBeVisible();
	await page.getByRole('button', { name: 'Freeze version…' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(
		page.getByText(
			'This exact capability revision is unavailable. Retained for recovery; version creation is blocked.',
			{ exact: true }
		)
	).toBeVisible();
	assertNoCriticalViolations(await scanAccessibility(page));
	await noOverflow(page);
});

test('populated library and mean-shaped definition are readable at every viewport', async ({
	page,
	request
}, info) => {
	const suffix = randomUUID().slice(0, 6);
	const a = { ...breakoutFixture, name: `Multi-context range ${suffix}` };
	const b = { ...reversionFixture, name: `Mean reversion study ${suffix}` };
	await seed(request, a, true);
	await seed(request, b);
	await page.goto('/research/methods');
	await page.getByLabel('Search Methods').fill(suffix);
	await expect(page.locator('.mw-library-list li')).toHaveCount(2);
	await screenshot(page, 'library', info.project.name);
	await page.getByLabel('Sort Methods').selectOption('name');
	await page.locator('.mw-library-list button').filter({ hasText: b.name }).click();
	await expect(page.getByLabel('Distance (%)')).toHaveValue('2');
	await page.getByRole('button', { name: 'Move capability 2 up' }).click();
	await page.getByRole('button', { name: 'Validate', exact: true }).click();
	await expect(
		page.getByText(
			'Choose a compatible earlier analysis instance. Move its definition before this rule.',
			{ exact: true }
		)
	).toBeVisible();
	await page.getByRole('button', { name: 'Move capability 1 down' }).click();
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect(page.locator('.mw-status')).toContainText('Saved');
	await noOverflow(page);
	await page.getByLabel('Lookback bars').focus();
	await expect(page.getByLabel('Lookback bars')).toBeFocused();
	expect(
		await page.getByLabel('Lookback bars').evaluate((el) => getComputedStyle(el).outlineStyle)
	).not.toBe('none');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	assertNoCriticalViolations(await scanAccessibility(page));
	await page.locator('.mw-detail-heading').scrollIntoViewIfNeeded();
	await screenshot(page, 'mean-editor', info.project.name);
});

test('HTTP boundaries reject malformed, mismatched and future input without leakage', async ({
	request
}) => {
	for (const data of [
		null,
		[],
		{ actionId: 'act.methodCreate', input: { op: 'list' } },
		{
			actionId: 'act.methodRead',
			input: {
				op: 'validate',
				content: { ...breakoutFixture, schema: 'trading.method-content@99' }
			}
		}
	]) {
		const response = await request.post('/api/act', { data });
		const text = await response.text();
		expect(JSON.parse(text).ok).toBe(false);
		expect(text).not.toMatch(/C:\\|sqlite|SELECT|node_modules|stack/);
	}
	const denied = await request.post('/api/act', {
		headers: { origin: 'https://untrusted.example' },
		data: { actionId: 'act.methodRead', input: { op: 'list' } }
	});
	expect(denied.status()).toBe(403);
});
