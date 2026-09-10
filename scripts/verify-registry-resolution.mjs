/**
 * Clean registry-resolution verification for the T1 verification ladder.
 *
 * Verifies, without trusting any cache:
 *  1. every @victframework/* specifier in every workspace manifest is the
 *     exact version `0.1.1` (no ranges, no file:/link:/workspace:/git);
 *  2. the lockfile resolves every @victframework/* entry from
 *     https://registry.npmjs.org at exactly 0.1.1 with integrity;
 *  3. the installed realpath of each consumed package is inside THIS
 *     repository's node_modules — never the local VICT checkout;
 *  4. the public registry exposes exactly the declared release set
 *     `vict-release-set@1/0.1.1` (content ID recomputed here).
 */
import { readdirSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.cwd();
const VICT_CHECKOUT_FRAGMENT = '260831-VCT-02';
const EXPECTED_VERSION = '0.1.1';
const EXPECTED_CONTENT_ID = 'v1_e31e8dd60d05e1d6feb08b5ed0874cceae561bdf10e08d8b93e07840de8d9cdf';
const RELEASE_SET_MEMBERS = [
	'application',
	'appdata-sqlite',
	'cli',
	'contracts',
	'control',
	'kernel',
	'mastra',
	'renderer-svelte',
	'runtime',
	'scaffolder',
	'sdk',
	'server',
	'store-sqlite'
];

const problems = [];

function collectManifests(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (
			['node_modules', '.git', '.svelte-kit', 'build', 'dist', 'docs', 'test-results'].includes(
				entry.name
			)
		) {
			continue;
		}
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...collectManifests(full));
		} else if (entry.name === 'package.json') {
			out.push(full);
		}
	}
	return out;
}

// 1. Manifest specifiers.
for (const manifestPath of collectManifests(ROOT)) {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	for (const section of [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies'
	]) {
		for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
			if (!name.startsWith('@victframework/')) continue;
			if (spec !== EXPECTED_VERSION) {
				problems.push(
					`${manifestPath}: ${name}@${spec} is not the exact version ${EXPECTED_VERSION}`
				);
			}
		}
	}
}

// 2. Lockfile resolutions.
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
const lockEntries = Object.entries(lock.packages ?? {}).filter(([path]) =>
	path.includes('@victframework/')
);
if (lockEntries.length === 0) {
	problems.push('The lockfile contains no @victframework/* entries; run npm install first.');
}
for (const [path, entry] of lockEntries) {
	const name = path.replace(/^node_modules\//, '');
	if (!name.startsWith('@victframework/')) continue;
	if (entry.version !== EXPECTED_VERSION) {
		problems.push(`lockfile: ${name} resolved to ${entry.version}, expected ${EXPECTED_VERSION}`);
	}
	if (
		typeof entry.resolved !== 'string' ||
		!entry.resolved.startsWith('https://registry.npmjs.org/')
	) {
		problems.push(`lockfile: ${name} resolved from ${entry.resolved}, not the public registry`);
	}
	if (typeof entry.integrity !== 'string' || entry.integrity.length === 0) {
		problems.push(`lockfile: ${name} has no integrity`);
	}
}

// 3. Installed realpaths.
const consumed = [
	'application',
	'appdata-sqlite',
	'contracts',
	'renderer-svelte',
	'scaffolder',
	'sdk'
];
for (const pkg of consumed) {
	const manifestPath = join(ROOT, 'node_modules', '@victframework', pkg, 'package.json');
	if (!existsSync(manifestPath)) {
		problems.push(`@victframework/${pkg} is not installed`);
		continue;
	}
	const real = realpathSync(join(ROOT, 'node_modules', '@victframework', pkg));
	if (real.includes(VICT_CHECKOUT_FRAGMENT)) {
		problems.push(`@victframework/${pkg} realpaths into the local VICT checkout: ${real}`);
	}
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	if (manifest.version !== EXPECTED_VERSION) {
		problems.push(`installed @victframework/${pkg} is version ${manifest.version}`);
	}
}

// 4. Release-set identity from the live public registry.
try {
	const lines = [];
	for (const pkg of RELEASE_SET_MEMBERS) {
		const response = await fetch(`https://registry.npmjs.org/@victframework/${pkg}`);
		if (!response.ok) {
			problems.push(`registry: @victframework/${pkg} lookup failed (${response.status})`);
			continue;
		}
		const metadata = await response.json();
		if (metadata['dist-tags']?.latest !== EXPECTED_VERSION) {
			problems.push(
				`registry: @victframework/${pkg} latest is ${metadata['dist-tags']?.latest}, expected ${EXPECTED_VERSION}`
			);
		}
		if (metadata.versions?.[EXPECTED_VERSION] === undefined) {
			problems.push(`registry: @victframework/${pkg} has no ${EXPECTED_VERSION}`);
		}
		lines.push(`@victframework/${pkg}@${EXPECTED_VERSION}`);
	}
	lines.sort();
	const contentId = `v1_${createHash('sha256').update(lines.join('\n')).digest('hex')}`;
	if (contentId !== EXPECTED_CONTENT_ID) {
		problems.push(`release-set content ID ${contentId} != declared ${EXPECTED_CONTENT_ID}`);
	}
} catch (error) {
	problems.push(`registry check could not run: ${error.message}`);
}

if (problems.length > 0) {
	console.error('REGISTRY RESOLUTION VERIFICATION FAILED:');
	for (const problem of problems) {
		console.error(` - ${problem}`);
	}
	process.exit(1);
}
console.log(
	`REGISTRY RESOLUTION OK — ${consumed.length} consumed packages at exact ${EXPECTED_VERSION} from https://registry.npmjs.org, release set ${EXPECTED_CONTENT_ID} verified.`
);
