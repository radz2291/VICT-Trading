import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { reversionFixture } from '../../packages/trading-capabilities/test/fixtures';
import type { MethodDetail } from '@trading-os/trading-domain';

test('production process restart restores draft, immutable version and workspace selection', async ({
	page,
	playwright
}, info) => {
	const directory = mkdtempSync(join(tmpdir(), 'tos-t2-browser-restart-'));
	const reservation = createServer();
	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	const address = reservation.address();
	if (!address || typeof address === 'string') throw new Error('No test port');
	const port = address.port;
	await new Promise<void>((r) => reservation.close(() => r()));
	const baseURL = `http://127.0.0.1:${port}`;
	let child: ChildProcess | null = null;
	async function start() {
		child = spawn(process.execPath, [resolve('apps/trading-os/build/index.js')], {
			windowsHide: true,
			stdio: 'pipe',
			env: {
				...process.env,
				HOST: '127.0.0.1',
				PORT: String(port),
				ORIGIN: baseURL,
				TRADING_OS_DB_PATH: join(directory, 'state.sqlite')
			}
		});
		let logs = '';
		child.stderr?.on('data', (b) => {
			logs += String(b);
		});
		await expect
			.poll(async () => {
				if (child?.exitCode !== null) throw new Error(`Production process exited: ${logs}`);
				try {
					return (await fetch(baseURL, { signal: AbortSignal.timeout(1000) })).ok;
				} catch {
					return false;
				}
			})
			.toBe(true);
	}
	async function stop() {
		if (child && child.exitCode === null) {
			const exited = once(child, 'exit');
			child.kill();
			await exited;
		}
		child = null;
	}
	const api = await playwright.request.newContext({ baseURL });
	async function command(actionId: string, input: Record<string, unknown>) {
		const response = await api.post('/api/act', { data: { actionId, input } });
		const body = await response.json();
		expect(body.ok).toBe(true);
		return body.value;
	}
	try {
		await start();
		const created: MethodDetail = (
			await command('act.methodCreate', {
				op: 'create',
				requestId: randomUUID(),
				name: reversionFixture.name
			})
		).detail;
		await command('act.methodSave', {
			op: 'save',
			requestId: randomUUID(),
			methodId: created.method.id,
			expectedRevision: 1,
			content: reversionFixture
		});
		const frozen: MethodDetail = (
			await command('act.methodFreeze', {
				op: 'freeze',
				requestId: randomUUID(),
				methodId: created.method.id,
				expectedRevision: 2
			})
		).detail;
		const version = frozen.versions[0]!;
		await command('act.methodAssign', {
			op: 'assign',
			requestId: randomUUID(),
			workspaceId: 'default',
			expectedRevision: 0,
			versionId: version.id
		});
		const revised: MethodDetail = (
			await command('act.methodRevise', {
				op: 'revise',
				requestId: randomUUID(),
				versionId: version.id
			})
		).detail;
		const saved = await command('act.methodSave', {
			op: 'save',
			requestId: randomUUID(),
			methodId: created.method.id,
			expectedRevision: revised.draft!.revision,
			content: {
				...reversionFixture,
				description: 'Persisted across a real production process restart.'
			}
		});
		await stop();
		await start();
		expect(await command('act.methodRead', { op: 'get', methodId: created.method.id })).toEqual(
			saved
		);
		expect(
			await command('act.methodRead', { op: 'profile', workspaceId: 'default' })
		).toMatchObject({ profile: { revision: 1, methodVersionId: version.id } });
		if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${baseURL}/research/methods`);
		await page
			.locator('.mw-library-list button')
			.filter({ hasText: reversionFixture.name })
			.click();
		await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
			'Persisted across a real production process restart.'
		);
		await expect(page.locator('.mw-profile')).toContainText(version.id);
		await expect(
			page.locator('.tos-strip__item--status').filter({ hasText: 'Activity:' })
		).toContainText('No active run');
		await page.getByRole('button', { name: 'Version history', exact: true }).click();
		await expect(page.getByText('Immutable · v1', { exact: true })).toBeVisible();
		await expect(page.locator('.mw-snapshot')).toContainText(version.fingerprint.slice(7));
	} finally {
		await api.dispose();
		await stop();
		rmSync(directory, { recursive: true, force: true });
	}
});
