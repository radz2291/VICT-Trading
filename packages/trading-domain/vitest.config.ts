import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'trading-domain',
		environment: 'node',
		include: ['test/**/*.test.ts']
	}
});
