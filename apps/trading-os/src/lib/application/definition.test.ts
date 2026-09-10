import { describe, expect, it } from 'vitest';
import { compileAppPlan, application, workspaceResource } from '$lib/application/definition';
import { TRADING_SURFACE_IDS } from '@trading-os/trading-surfaces';

function renderedNavigation(plan: ReturnType<typeof compileAppPlan>): {
	group: string;
	label: string;
	path: string;
}[] {
	const groups: string[] = [];
	const out: { group: string; label: string; path: string }[] = [];
	for (const entry of plan.routes) {
		if (entry.route.nav === undefined) continue;
		const group = entry.route.nav.group ?? '';
		if (!groups.includes(group)) {
			groups.push(group);
		}
	}
	for (const group of groups) {
		const entries = plan.routes
			.filter(
				(entry) =>
					entry.route.nav !== undefined &&
					(entry.route.nav.group ?? '') === group &&
					entry.screen !== null
			)
			.sort((a, b) => (a.route.nav?.order ?? 0) - (b.route.nav?.order ?? 0));
		for (const entry of entries) {
			out.push({ group, label: entry.route.nav?.label ?? '', path: entry.route.path });
		}
	}
	return out;
}

describe('the canonical Application Definition', () => {
	it('compiles to a plan', () => {
		const plan = compileAppPlan();
		expect(plan.applicationId).toBe('trading.os');
		expect(plan.routes.length).toBe(11);
	});

	it('produces a deterministic application identity', () => {
		const a = compileAppPlan();
		const b = compileAppPlan();
		expect(a.applicationVersion).toBe(b.applicationVersion);
		expect(a.toJSON()).toEqual(b.toJSON());
		expect(a.applicationVersion).toMatch(/^v\d+_[0-9a-f]{64}$/);
	});

	it('renders the exact declared navigation order: Desk, Markets, then Research → Practice → Operate → Review → System', () => {
		const nav = renderedNavigation(compileAppPlan());
		expect(nav.map((entry) => `${entry.group}:${entry.label}`)).toEqual([
			':Desk',
			':Markets',
			'Research:Methods',
			'Practice:Backtest',
			'Practice:Replay',
			'Operate:Live Watch',
			'Operate:Trading',
			'Review:Journal',
			'Review:Evidence',
			'System:Risk',
			'System:Settings'
		]);
	});

	it('keeps the navigation-group shape static (no dynamic group add/remove surface exists)', () => {
		// Every nav-bearing route is declared statically in the definition;
		// the compiled plan routes equal the definition routes in order.
		const plan = compileAppPlan();
		expect(plan.routes.map((entry) => entry.route.id)).toEqual(
			application.routes.map((route) => route.id)
		);
	});

	it('declares the versioned custom surfaces with exact ids and revisions', () => {
		const plan = compileAppPlan();
		const declared = plan.components.map(
			(component) => `${component.componentId}@${component.revision}`
		);
		expect(declared).toContain(`${TRADING_SURFACE_IDS.marketChart.componentId}@1`);
		expect(declared).toContain(`${TRADING_SURFACE_IDS.watchlist.componentId}@1`);
		expect(declared).toContain(`${TRADING_SURFACE_IDS.workspaceControls.componentId}@1`);
		expect(declared).toContain(`${TRADING_SURFACE_IDS.deskOverview.componentId}@1`);
	});

	it('declares safe states on data-dependent screens', () => {
		const plan = compileAppPlan();
		for (const screenId of ['s.desk', 's.markets']) {
			const screen = plan.screens[screenId];
			expect(screen?.states?.loading, `${screenId} loading`).toBeTruthy();
			expect(screen?.states?.empty, `${screenId} empty`).toBeTruthy();
			expect(screen?.states?.failure, `${screenId} failure`).toBeTruthy();
		}
	});

	it('uses only real T1 actions (navigation + workspace persistence)', () => {
		const plan = compileAppPlan();
		expect(Object.keys(plan.actions).sort()).toEqual([
			'act.createWorkspace',
			'act.openMarkets',
			'act.queryWorkspaces',
			'act.saveWorkspace'
		]);
	});

	it('binds the workspace resource at revision 1 only', () => {
		const plan = compileAppPlan();
		expect(plan.resources['workspace_instances']?.revision).toBe('1');
		expect(workspaceResource.id).toBe('workspace_instances');
	});
});
