import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: [
			'**/.svelte-kit/',
			'**/build/',
			'**/dist/',
			'**/node_modules/',
			'docs/',
			'test-results/'
		]
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			// The svelte parser delegates <script lang="ts"> bodies to the
			// TypeScript parser; wire it explicitly.
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['**/*.test.ts', 'playwright.config.ts', '**/playwright/**/*.ts'],
		plugins: { vitest },
		languageOptions: { globals: { ...globals.node } },
		rules: vitest.configs.recommended.rules
	},
	{
		files: ['scripts/**/*.mjs', 'eslint.config.js', 'playwright.config.ts'],
		languageOptions: { globals: { ...globals.node } }
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['**/CommandPalette.svelte'],
		rules: {
			// The palette options implement the combobox pattern (keyboard owned
			// by the input via aria-activedescendant); svelte-check requires the
			// svelte-ignore comment while eslint's unused-ignore rule considers
			// it unused — keep the ignore and silence this eslint disagreement.
			'svelte/no-unused-svelte-ignore': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		rules: {
			// Router hrefs inside the SvelteKit host are intentional navigation.
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
);
