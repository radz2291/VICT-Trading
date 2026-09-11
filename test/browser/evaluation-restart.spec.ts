import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { reversionFixture } from '../../packages/trading-capabilities/test/fixtures';
import type { MethodDetail, StoredSeries } from '@trading-os/trading-domain';

test('T3 production process restart reopens exact persisted evaluation and reruns identical bytes', async ({
	page,
	playwright
}, info) => {
	const directory = mkdtempSync(join(tmpdir(), 'tos-t3-browser-restart-'));
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
		const version = (
			await command('act.methodFreeze', {
				op: 'freeze',
				requestId: randomUUID(),
				methodId: created.method.id,
				expectedRevision: 2
			})
		).detail.versions[0];
		await command('act.fixtureInstall', {
			op: 'install',
			requestId: randomUUID(),
			fixtureRevision: '1'
		});
		const series = (await command('act.dataRead', { op: 'catalog' })).series as StoredSeries[];
		const daily = series.find((s) => s.instrument === 'EXAMPLE-B')!;
		const input = {
			schema: 'trading.evaluation-request@1',
			methodVersionId: version.id,
			bindings: [{ observationId: 'daily', seriesId: daily.id }],
			driverObservationId: 'daily',
			calculationRevision: 'closed-bars-v1',
			start: daily.coverage.end - 10 * daily.durationMs,
			end: daily.coverage.end
		};
		const requestId = randomUUID();
		await command('act.evaluationStart', { op: 'start', requestId, request: input });
		await expect
			.poll(async () => (await command('act.dataRead', { op: 'get', runId: requestId })).run.status)
			.toBe('succeeded');
		const first = await command('act.dataRead', { op: 'get', runId: requestId });
		await stop();
		await start();
		expect(await command('act.dataRead', { op: 'get', runId: requestId })).toEqual(first);
		if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${baseURL}/research/methods`);
		await page.getByRole('button', { name: 'Evaluation inspector', exact: true }).click();
		await page
			.getByRole('region', { name: 'Saved evaluations' })
			.getByRole('button')
			.filter({ hasText: reversionFixture.name })
			.click();
		await expect(page.getByRole('region', { name: 'Completed evaluation' })).toContainText(
			reversionFixture.name
		);
		await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'succeeded');
		const secondId = randomUUID();
		await command('act.evaluationStart', { op: 'start', requestId: secondId, request: input });
		await expect
			.poll(async () => (await command('act.dataRead', { op: 'get', runId: secondId })).run.status)
			.toBe('succeeded');
		const second = await command('act.dataRead', { op: 'get', runId: secondId });
		expect(second.result.canonical).toBe(first.result.canonical);
		expect(second.result.fingerprint).toBe(first.result.fingerprint);
		// Simulate disk corruption only in this test-owned database, with the process stopped.
		await stop();
		const { DatabaseSync } = createRequire(import.meta.url)(
			'node:sqlite'
		) as typeof import('node:sqlite');
		const db = new DatabaseSync(join(directory, 'state.sqlite'));
		try {
			db.exec('DROP TRIGGER evaluation_results_no_update');
			db.prepare(
				"UPDATE appdata_evaluation_results SET canonical=json_set(canonical,'$.method.name','corrupted') WHERE fingerprint=?"
			).run(first.result.fingerprint);
		} finally {
			db.close();
		}
		await start();
		const rejected = await (
			await api.post('/api/act', {
				data: { actionId: 'act.dataRead', input: { op: 'get', runId: requestId } }
			})
		).json();
		expect(rejected).toMatchObject({ ok: false, code: 'INVALID_RECORD' });
		expect(JSON.stringify(rejected)).not.toMatch(/SELECT|sqlite|state\.sqlite|corrupted/);
		await page.reload();
		await page.getByRole('button', { name: 'Evaluation inspector', exact: true }).click();
		await page
			.getByRole('region', { name: 'Saved evaluations' })
			.getByRole('button')
			.filter({ hasText: reversionFixture.name })
			.first()
			.click();
		await expect(page.locator('.ev-status')).toHaveAttribute('data-state', 'failed');
		await expect(page.getByRole('region', { name: 'Completed evaluation' })).toHaveCount(0);
	} finally {
		await api.dispose();
		await stop();
		rmSync(directory, { recursive: true, force: true });
	}
});
