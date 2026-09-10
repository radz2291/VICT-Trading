/**
 * Accessibility scan helper: injects the pinned axe-core source into the
 * page and runs a WCAG 2.0/2.1 AA scan. Uses real system Chrome via
 * Playwright's channel configuration.
 */
import { createRequire } from 'node:module';
import type { Page } from '@playwright/test';

const require = createRequire(import.meta.url);

export interface AxeResult {
	readonly violations: readonly {
		readonly id: string;
		readonly impact: string | null;
		readonly help: string;
		readonly nodes: readonly { readonly target: unknown }[];
	}[];
}

export async function scanAccessibility(page: Page): Promise<AxeResult> {
	const axeSource = require.resolve('axe-core/axe.min.js');
	await page.addScriptTag({ path: axeSource });
	return page.evaluate(`
		axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
	`) as Promise<AxeResult>;
}

export function assertNoCriticalViolations(result: AxeResult): void {
	const critical = result.violations.filter(
		(violation) => violation.impact === 'critical' || violation.impact === 'serious'
	);
	if (critical.length > 0) {
		const report = critical
			.map((violation) => {
				const targets = violation.nodes
					.map((node) => JSON.stringify(node.target))
					.slice(0, 4)
					.join(' | ');
				return `${violation.impact}: ${violation.id} — ${violation.help}
				  targets: ${targets}`;
			})
			.join('\n');
		throw new Error(`Critical axe violations:\n${report}`);
	}
}
