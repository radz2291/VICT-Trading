import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: './test/browser',
	outputDir: './test-results/t3/output',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command:
			'npm run build -w trading-os-app && npm run preview -w trading-os-app -- --port 4174 --strictPort --host 127.0.0.1',
		url: `${baseURL}/`,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			TRADING_OS_DB_PATH: `./.data/trading-os-e2e-${process.pid}-${Date.now()}.sqlite`
		}
	},
	projects: [
		{
			name: 'desktop',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chrome',
				viewport: { width: 1440, height: 900 }
			}
		},
		{
			name: 'laptop',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chrome',
				viewport: { width: 1024, height: 768 }
			}
		},
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'], channel: 'chrome' }
		}
	]
});
