/**
 * Client-boundary verification: after `npm run build`, the browser bundle
 * must contain NO Node-only code and no filesystem/database markers, while
 * the server bundle legitimately does. Fails loudly on any leak.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CLIENT = join(ROOT, 'apps', 'trading-os', '.svelte-kit', 'output', 'client');
const SERVER = join(ROOT, 'apps', 'trading-os', '.svelte-kit', 'output', 'server');

const MARKERS = [
	'appdata_market_series',
	'appdata_market_bars',
	'appdata_evaluation_runs',
	'appdata_evaluation_results',
	'createSqliteEvaluationRepository',
	'VICT_RUNTIME_ACTIVATION_NOT_FOUND',
	'appdata_method_versions',
	'appdata_workspace_profiles',
	'createSqliteMethodRepository',
	'node:crypto',
	'node:sqlite',
	'node:fs',
	'node:path',
	'createSqliteApplicationData',
	'vict_appdata_migrations',
	'TRADING_OS_DB_PATH',
	'appdata.sqlite'
];

function listFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFiles(full));
		else out.push(full);
	}
	return out;
}

function scan(dir) {
	const hits = [];
	for (const file of listFiles(dir)) {
		if (!/\.(js|mjs|css|html)$/.test(file)) continue;
		const content = readFileSync(file, 'utf8');
		for (const marker of MARKERS) {
			if (content.includes(marker)) {
				hits.push(`${file} contains "${marker}"`);
			}
		}
	}
	return hits;
}

const clientHits = scan(CLIENT);
// SvelteKit legitimately uses sessionStorage for scroll/history restoration. Ban web
// storage in product source instead: Method/Workspace truth must use server adapters.
for (const source of [
	join(ROOT, 'apps', 'trading-os', 'src'),
	...['trading-domain', 'trading-data', 'trading-capabilities', 'trading-surfaces'].map((name) =>
		join(ROOT, 'packages', name, 'src')
	)
]) {
	for (const file of listFiles(source)) {
		if (!/\.(ts|svelte|js)$/.test(file) || file.includes('__tests__') || file.endsWith('.test.ts'))
			continue;
		const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
		if (/\b(?:localStorage|sessionStorage)\b/.test(code))
			clientHits.push(`${file} uses product web storage instead of the authoritative server`);
	}
}
if (clientHits.length > 0) {
	console.error('CLIENT BOUNDARY VIOLATION — Node-only code reached the browser bundle:');
	for (const hit of clientHits) console.error(` - ${hit}`);
	process.exit(1);
}

// Positive control: the server bundle SHOULD contain the storage markers.
const serverHits = scan(SERVER);
const hasServerMarkers = serverHits.length > 0;
if (!statSync(SERVER, { throwIfNoEntry: false })?.isDirectory()) {
	console.error('Server output missing — run `npm run build` first.');
	process.exit(1);
}
if (!hasServerMarkers) {
	console.error('Warning: expected storage markers in the server bundle were not found.');
	process.exit(1);
}
console.log('CLIENT BOUNDARY OK — browser bundle is free of Node-only storage code.');
