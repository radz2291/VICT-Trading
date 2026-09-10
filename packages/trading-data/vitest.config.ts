import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'trading-data',
		environment: 'node',
		include: ['test/**/*.test.ts']
	}
});
