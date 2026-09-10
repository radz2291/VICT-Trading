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
