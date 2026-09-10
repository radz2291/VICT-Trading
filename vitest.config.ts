import { defineConfig } from 'vitest/config';
import { cpus } from 'node:os';

export default defineConfig({
	test: {
		// Five vitest projects on one machine otherwise oversubscribe CPU
		// (each spawning default workers), starving fast pure-CPU tests into
		// spurious 5 s timeouts under full-suite load (audit finding F-10).
		// Bounding workers fixes the starvation at its source; per-test
		// timeouts stay at the strict default.
		maxWorkers: Math.max(2, Math.floor(cpus().length / 2)),
		projects: [
			'packages/trading-domain/vitest.config.ts',
			'packages/trading-data/vitest.config.ts',
			'packages/trading-surfaces/vitest.config.ts',
			'apps/trading-os/vitest.config.ts',
			{
				test: {
					name: 'architecture',
					environment: 'node',
					include: ['test/architecture/**/*.test.ts']
				}
			}
		]
	}
});
