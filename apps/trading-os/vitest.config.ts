import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	plugins: [svelte()],
	resolve: {
		conditions: ['browser'],
		alias: {
			// Unit tests run without the full SvelteKit router: $lib resolves to
			// the app's lib and $app modules are deterministic test doubles
			// (the real router behaviors are exercised by the browser suite).
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			'$app/navigation': fileURLToPath(
				new URL('./src/lib/testing/app-navigation-mock.ts', import.meta.url)
			),
			'$app/state': fileURLToPath(new URL('./src/lib/testing/app-state-mock.ts', import.meta.url)),
			'$app/environment': fileURLToPath(
				new URL('./src/lib/testing/app-environment-mock.ts', import.meta.url)
			)
		}
	},
	test: {
		name: 'app',
		environment: 'happy-dom',
		include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts']
	}
});
