/**
 * Scaffolding evidence: runs the published @victframework/scaffolder into a
 * clean temporary directory OUTSIDE the repository and prints the generated
 * file inventory. The application's host files were integrated once from
 * this canonical generation; this script reproduces the evidence on demand
 * and never writes inside the repository.
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldVictApp } from '@victframework/scaffolder';

const dir = mkdtempSync(join(tmpdir(), 'tos-scaffold-evidence-'));
const target = join(dir, 'host');
const result = scaffoldVictApp({
	targetDir: target,
	appName: 'Trading OS',
	packageName: 'trading-os-app'
});
console.log(JSON.stringify(result, null, 2));
if (result.status === 'created') {
	console.log('Generated files:');
	for (const entry of readdirSync(target, { recursive: true }).sort()) {
		console.log(`  ${entry}`);
	}
}
rmSync(dir, { recursive: true, force: true });
