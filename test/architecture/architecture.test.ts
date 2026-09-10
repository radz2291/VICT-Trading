/**
 * Package-boundary architecture tests: the dependency adjacency accepted at
 * T0 must hold in the actual source. These tests read the repository files
 * directly, so a violation fails CI, not just review.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

	it('trading-data imports only the trading domain', () => {
		const files = srcFiles('packages/trading-data');
		for (const file of files) {
			for (const specifier of importsOf(file)) {
				const pkg = packageOf(specifier);
				if (pkg === null) continue;
				expect(['@trading-os/trading-domain'].includes(pkg), `${file} imports ${specifier}`).toBe(
					true
				);
			}
		}
	});

	it('trading-capabilities is imported by nothing and imports nothing (intentionally minimal at T1)', () => {
		const capabilities = srcFiles('packages/trading-capabilities');
		for (const file of capabilities) {
			for (const specifier of importsOf(file)) {
				expect(packageOf(specifier)).toBeNull();
			}
		}
		const consumers = [
			...srcFiles('apps/trading-os'),
			...srcFiles('packages/trading-surfaces'),
			...srcFiles('packages/trading-data')
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
