/**
 * Package-boundary architecture tests: the dependency adjacency accepted at
 * T0 must hold in the actual source. These tests read the repository files
 * directly, so a violation fails CI, not just review.
 */
import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function listFiles(dir: string, extensions: string[]): string[] {
	const out: string[] = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const full = `${dir}/${entry}`;
		if (statSync(full).isDirectory()) {
			out.push(...listFiles(full, extensions));
		} else if (extensions.some((ext) => entry.endsWith(ext))) {
			out.push(full);
		}
	}
	return out;
}

const IMPORT_RE = /(?:from|import)\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	const specifiers: string[] = [];
	for (const match of source.matchAll(IMPORT_RE)) {
		specifiers.push(match[1] ?? match[2] ?? '');
	}
	return specifiers;
}

function packageOf(specifier: string): string | null {
	if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
	const parts = specifier.split('/');
	if (specifier.startsWith('@')) {
		return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
	}
	return parts[0] ?? null;
}

function srcFiles(pkgDir: string): string[] {
	return listFiles(`${ROOT}/${pkgDir}/src`, ['.ts', '.js', '.svelte']).filter(
		(file) => !file.endsWith('.d.ts')
	);
}

const FORBIDDEN_IN_DOMAIN = ['svelte', '@victframework', 'node:', 'better-sqlite3', '@trading-os'];

describe('package boundaries (T0 audit §4 adjacency)', () => {
	it('trading-domain imports NOTHING external — pure framework-neutral TypeScript', () => {
		const files = srcFiles('packages/trading-domain');
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			for (const specifier of importsOf(file)) {
				expect(packageOf(specifier), `${file} must be dependency-free`).toBeNull();
				for (const forbidden of FORBIDDEN_IN_DOMAIN) {
					expect(specifier.includes(forbidden), `${file} must not import ${specifier}`).toBe(false);
				}
			}
		}
	});

	it('trading-domain declares no runtime dependencies', () => {
		const manifest = JSON.parse(
			readFileSync(`${ROOT}/packages/trading-domain/package.json`, 'utf8')
		) as { dependencies?: unknown; peerDependencies?: unknown };
		expect(manifest.dependencies).toBeUndefined();
		expect(manifest.peerDependencies).toBeUndefined();
	});

	it('trading-data isolates the public SQLite foundation and Node crypto to its server adapter', () => {
		const files = srcFiles('packages/trading-data');
		for (const file of files) {
			for (const specifier of importsOf(file)) {
				const pkg = packageOf(specifier);
				if (pkg === null) continue;
				const allowed = file.endsWith('/method-store.ts')
					? ['@trading-os/trading-domain', '@victframework/appdata-sqlite', 'node:crypto']
					: ['@trading-os/trading-domain'];
				expect(allowed.includes(pkg), `${file} imports ${specifier}`).toBe(true);
			}
		}
	});

	it('trading-capabilities imports only domain authoring contracts and is composed only by the app', () => {
		const capabilities = srcFiles('packages/trading-capabilities');
		for (const file of capabilities) {
			for (const specifier of importsOf(file)) {
				expect([null, '@trading-os/trading-domain']).toContain(packageOf(specifier));
			}
		}
		const consumers = [
			...srcFiles('packages/trading-surfaces'),
			...srcFiles('packages/trading-data'),
			...srcFiles('packages/trading-domain')
		];
		for (const file of consumers) {
			for (const specifier of importsOf(file)) {
				expect(specifier.includes('trading-capabilities'), `${file} → ${specifier}`).toBe(false);
			}
		}
	});

	it('trading-surfaces imports only the domain and the VICT application registry contract', () => {
		const files = srcFiles('packages/trading-surfaces');
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			for (const specifier of importsOf(file)) {
				const pkg = packageOf(specifier);
				if (pkg === null) continue;
				expect(
					[
						'@trading-os/trading-domain',
						'@victframework/application',
						'lightweight-charts',
						'svelte'
					].includes(pkg),
					`${file} imports ${specifier}`
				).toBe(true);
			}
			// Node-only modules must never enter surfaces.
			expect(file, 'surfaces must not import node:').toBeTruthy();
			const source = readFileSync(file, 'utf8');
			expect(source.includes('node:'), `${file} imports node:`).toBe(false);
		}
	});

	it('the trading-data concrete store never leaks into trading-surfaces or the domain', () => {
		const files = [
			...srcFiles('packages/trading-surfaces'),
			...srcFiles('packages/trading-domain')
		];
		for (const file of files) {
			for (const specifier of importsOf(file)) {
				expect(
					specifier.includes('trading-data'),
					`${file} imports the concrete store: ${specifier}`
				).toBe(false);
			}
		}
	});

	it('apps/trading-os is the only package depending on all composition targets', () => {
		const manifest = JSON.parse(readFileSync(`${ROOT}/apps/trading-os/package.json`, 'utf8')) as {
			dependencies: Record<string, string>;
		};
		for (const required of [
			'@trading-os/trading-capabilities',
			'@trading-os/trading-domain',
			'@trading-os/trading-data',
			'@trading-os/trading-surfaces',
			'@victframework/application',
			'@victframework/appdata-sqlite',
			'@victframework/renderer-svelte',
			'@victframework/sdk'
		]) {
			expect(typeof manifest.dependencies[required], `missing ${required}`).toBe('string');
		}
		expect(manifest.dependencies['@trading-os/trading-domain']).toBe('0.1.0');
	});

	it('no Trading OS package appears in any VICT dependency (one-way direction)', () => {
		const manifestPaths = [
			`${ROOT}/package.json`,
			...listFiles(`${ROOT}/packages`, ['.json']).filter((f) => f.endsWith('/package.json')),
			`${ROOT}/apps/trading-os/package.json`
		];
		for (const path of manifestPaths) {
			const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
				name?: string;
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			if (manifest.name?.startsWith('@victframework')) {
				throw new Error('A Trading OS manifest claims a VICT identity');
			}
			for (const deps of [manifest.dependencies, manifest.devDependencies]) {
				for (const [name, spec] of Object.entries(deps ?? {})) {
					if (name.startsWith('@victframework')) {
						expect(spec.startsWith('workspace'), `${path}: ${name} → ${spec}`).toBe(false);
						expect(spec.startsWith('file:'), `${path}: ${name} → ${spec}`).toBe(false);
						expect(spec.startsWith('link:'), `${path}: ${name} → ${spec}`).toBe(false);
					}
				}
			}
		}
	});
});

describe('T2 permanent boundaries and evidence integrity', () => {
	it('keeps the server adapter out of the browser barrel and browser application modules', () => {
		expect(readFileSync(`${ROOT}/packages/trading-data/src/index.ts`, 'utf8')).not.toMatch(
			/method-store|sqlite|node:/
		);
		for (const file of srcFiles('apps/trading-os').filter((f) => !f.includes('/server/'))) {
			for (const spec of importsOf(file))
				expect(spec).not.toMatch(/trading-data\/method-store|appdata-sqlite|node:/);
		}
	});
	it('contains definition contracts without market-evaluation or network implementations', () => {
		for (const file of [
			...srcFiles('packages/trading-capabilities'),
			...srcFiles('packages/trading-domain').filter((f) => f.includes('/method'))
		]) {
			const code = readFileSync(file, 'utf8');
			expect(code).not.toMatch(
				/\b(fetch|WebSocket|evaluate|backtest|simulateFill|submitOrder)\s*\(/
			);
		}
		for (const file of srcFiles('packages/trading-surfaces').filter((f) => f.includes('/methods/')))
			expect(readFileSync(file, 'utf8')).not.toMatch(
				/analysis\.range|analysis\.mean|SS Breakout|trading-capabilities/
			);
	});
	it('keeps VICT exact and public-registry-resolved, with consumer-local realpaths', () => {
		const lock = JSON.parse(readFileSync(`${ROOT}/package-lock.json`, 'utf8'));
		for (const [name, value] of Object.entries(lock.packages) as [
			string,
			{ version?: string; resolved?: string; link?: boolean }
		][]) {
			if (!name.startsWith('node_modules/@victframework/')) continue;
			expect(value.version).toBe('0.1.1');
			expect(value.resolved).toMatch(/^https:\/\/registry\.npmjs\.org\//);
			expect(value.link).not.toBe(true);
			expect(realpathSync(`${ROOT}/${name}`).toLowerCase()).toContain('node_modules');
			expect(realpathSync(`${ROOT}/${name}`)).not.toContain('260831-VCT-02');
		}
	});
	it('preserves every T0/T1 evidence record byte-for-byte against the closed baseline', () => {
		const files = execFileSync(
			'git',
			[
				'ls-tree',
				'-r',
				'ad860465bf404b7bd1f4359c712f7f6bdf52a6d1',
				'docs/audit',
				'docs/report',
				'docs/evidence',
				'docs/TRADING-OS-PRODUCT-CONSTITUTION.md',
				'docs/architecture/TRADING-OS-SURFACE-ARCHITECTURE.md'
			],
			{ cwd: ROOT, encoding: 'utf8' }
		)
			.trim()
			.split('\n');
		for (const entry of files) {
			const [metadata, file] = entry.split('\t');
			const expected = metadata!.split(' ')[2];
			const bytes = readFileSync(`${ROOT}/${file}`);
			const actual = createHash('sha1')
				.update(`blob ${bytes.length}\0`)
				.update(bytes)
				.digest('hex');
			expect({ file, blob: actual }).toEqual({ file, blob: expected });
		}
	});
	it('tracks no runtime database, secret, cache or build output; tests never overwrite evidence', () => {
		const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
		expect(tracked).not.toMatch(
			/(?:^|\n)(?:.*\/)?(?:\.env(?:\.|$)|node_modules\/|\.data\/|test-results\/|build\/|.*\.(?:sqlite|db)(?:-wal|-shm)?$)/m
		);
		for (const file of listFiles(`${ROOT}/test/browser`, ['.ts']))
			expect(readFileSync(file, 'utf8')).not.toMatch(/path:\s*['"`]docs\/evidence/);
	});
});
