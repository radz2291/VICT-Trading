import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const file = resolve('apps/trading-os/.svelte-kit/output/client/t3-negative-control.js');
// Exclusive creation: never overwrite an existing artifact; remove only this exact file.
writeFileSync(
	file,
	'// appdata_evaluation_results\n// createSqliteEvaluationRepository\n// node:sqlite\n',
	{ flag: 'wx' }
);
try {
	const child = spawnSync(process.execPath, ['scripts/check-client-boundary.mjs'], {
		encoding: 'utf8'
	});
	if (
		child.status !== 1 ||
		!child.stderr.includes('t3-negative-control.js') ||
		!child.stderr.includes('createSqliteEvaluationRepository')
	)
		throw new Error('Client boundary negative control did not reject the injected leak');
	console.log(
		'NEGATIVE CONTROL OK — actual emitted-client scan rejected injected evaluation/SQLite markers (expected child exit 1).'
	);
} finally {
	unlinkSync(file);
}
