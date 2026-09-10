import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
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
