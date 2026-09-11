/**
 * THE canonical Trading OS Application Definition (vict.application@2).
 *
 * This neutral definition is the single source of truth for navigation,
 * screens, regions, standard surfaces, safe states, theme tokens, and the
 * actions/resources that perform real T1 behavior. The generic public VICT
 * renderer (VitApp) renders exactly what is declared here — adding a route
 * or screen is a definition change, never a page shell.
 *
 * Navigation-group order uses the verified first-occurrence semantics of
 * VICT 0.1.1: groups render in the order of first occurrence in the ordered
 * route list, so the routes array below yields
 *   (top level) Desk, Markets → Research → Practice → Operate → Review → System.
 * The navigation-group shape is static by design (no reactive group
 * add/remove — a recorded VICT 0.1.x limitation must not be exercised).
 */
import {
	APPLICATION_DEFINITION_SCHEMA_V2,
	RESOURCE_DEFINITION_SCHEMA,
	defineApplication,
	defineResource
} from '@victframework/sdk';
import { compileApplication, type ApplicationPlan } from '@victframework/application';
import { defineContract, type Contract } from '@victframework/contracts';
import {
	WORKSPACE_INSTANCE_SCHEMA,
	WORKSPACE_LAYOUT_PRESETS,
	parseWorkspaceInstance,
	serializeWorkspaceInstance
} from '@trading-os/trading-domain';
import { TRADING_SURFACE_IDS } from '@trading-os/trading-surfaces';
import {
	evaluationActions,
	evaluationCommandContract,
	evaluationReplyContract,
	EVALUATION_CAPABILITIES
} from './evaluation-actions';
import {
	methodResource,
	methodActions,
	methodCommandContract,
	methodReplyContract
} from './method-actions';

/* ------------------------------------------------------------------ */
/* Resource: persisted Workspace Instances                             */
/* ------------------------------------------------------------------ */

/**
 * The persisted Workspace Instance record. Layout content is product data
 * (a trader-owned Workspace Instance — never a Method Version); VICT's
 * SQLite application-data store provides the versioned, transactional
 * storage, contracts, and below-UI authorization.
 */
export const workspaceResource = defineResource({
	schema: RESOURCE_DEFINITION_SCHEMA,
	id: 'workspace_instances',
	revision: '1',
	identity: { key: 'id' },
	fields: [
		{ name: 'id', type: 'string', required: true, label: 'Id' },
		{ name: 'schema', type: 'string', required: true, label: 'Schema' },
		{ name: 'state', type: 'json', required: true, label: 'State' },
		{ name: 'updatedAt', type: 'string', required: true, label: 'Updated at' }
	],
	queries: { list: { sort: ['updatedAt'], pagination: false } },
	mutations: [
		{
			op: 'create',
			effect: 'write',
			idempotency: 'keyed',
			inputContractId: 'trading.workspace-record',
			permissions: ['workspace.write']
		},
		{
			op: 'update',
			effect: 'write',
			inputContractId: 'trading.workspace-record',
			permissions: ['workspace.write']
		}
	],
	authorization: { effect: 'read' }
});

/** The persisted-record contract: schema marker + validated state. */
export const workspaceRecordContract: Contract<{
	id: string;
	schema: string;
	state: {
		instrumentId: string;
		timeframeId: string;
		layoutPreset: string;
		watchlistVisible: boolean;
	};
	updatedAt: string;
}> = defineContract({
	id: 'trading.workspace-record',
	revision: '1',
	expected:
		'A Trading OS Workspace Instance record: id, schema marker, validated state, ISO updatedAt.',
	parse(input: unknown) {
		const parsed = parseWorkspaceInstance(input);
		if (!parsed.ok) {
			return {
				ok: false as const,
				issues: [{ path: 'state', message: parsed.message, code: parsed.code }]
			};
		}
		return { ok: true as const, value: serializeWorkspaceInstance(parsed.instance) };
	}
});

/* ------------------------------------------------------------------ */
/* Honest safe-state text for later-stage routes                       */
/* ------------------------------------------------------------------ */

const laterStage = (route: string, stage: string): string =>
	`${route} arrives at Stage ${stage}. Trading OS is being built in verified stages — the platform shell, the market workspace, and persisted workspaces are live now; this screen is intentionally not a preview of unfinished behavior.`;

/* ------------------------------------------------------------------ */
/* The canonical definition                                            */
/* ------------------------------------------------------------------ */

export const application = defineApplication({
	schema: APPLICATION_DEFINITION_SCHEMA_V2,
	id: 'trading.os',
	revision: '3',
	name: 'Trading OS',
	routes: [
		// Top level (no group) — the two always-visible entries.
		{ id: 'desk', path: '/', screenId: 's.desk', nav: { label: 'Desk', order: 1 } },
		{
			id: 'markets',
			path: '/markets',
			screenId: 's.markets',
			nav: { label: 'Markets', order: 2 }
		},
		// Research → Practice → Operate → Review → System (first-occurrence order).
		{
			id: 'methods',
			path: '/research/methods',
			screenId: 's.methods',
			nav: { group: 'Research', label: 'Methods', order: 1 }
		},
		{
			id: 'backtest',
			path: '/practice/backtest',
			screenId: 's.backtest',
			nav: { group: 'Practice', label: 'Backtest', order: 1 }
		},
		{
			id: 'replay',
			path: '/practice/replay',
			screenId: 's.replay',
			nav: { group: 'Practice', label: 'Replay', order: 2 }
		},
		{
			id: 'live-watch',
			path: '/operate/live-watch',
			screenId: 's.live-watch',
			nav: { group: 'Operate', label: 'Live Watch', order: 1 }
		},
		{
			id: 'trading',
			path: '/operate/trading',
			screenId: 's.trading',
			nav: { group: 'Operate', label: 'Trading', order: 2 }
		},
		{
			id: 'journal',
			path: '/review/journal',
			screenId: 's.journal',
			nav: { group: 'Review', label: 'Journal', order: 1 }
		},
		{
			id: 'evidence',
			path: '/review/evidence',
			screenId: 's.evidence',
			nav: { group: 'Review', label: 'Evidence', order: 2 }
		},
		{
			id: 'risk',
			path: '/system/risk',
			screenId: 's.risk',
			nav: { group: 'System', label: 'Risk', order: 1 }
		},
		{
			id: 'settings',
			path: '/system/settings',
			screenId: 's.settings',
			nav: { group: 'System', label: 'Settings', order: 2 }
		}
	],
	screens: [
		{
			id: 's.desk',
			title: 'Desk',
			layout: [
				{
					name: 'main',
					surfaces: [
						{
							role: 'component',
							id: 'cmp.desk-overview',
							componentId: TRADING_SURFACE_IDS.deskOverview.componentId,
							revision: TRADING_SURFACE_IDS.deskOverview.revision
						},
						{
							role: 'action',
							id: 'act.openMarketsSurface',
							actionId: 'act.openMarkets',
							label: 'Open Markets'
						},
						{
							role: 'text',
							id: 't.desk.scope',
							content:
								'The Desk shows the context of the program: workspace, market selection, data truth, and activity. Define Methods in Research. Runs and evidence arrive in later verified stages.'
						}
					]
				}
			],
			states: {
				loading: { role: 'text', id: 't.desk.loading', content: 'Loading workspace context…' },
				empty: { role: 'text', id: 't.desk.empty', content: 'No workspace context yet.' },
				failure: {
					role: 'text',
					id: 't.desk.failure',
					content: 'The workspace context failed to load. Nothing is being guessed.'
				}
			}
		},
		{
			id: 's.markets',
			title: 'Markets',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Markets' }],
			layout: [
				{
					name: 'stored-data',
					surfaces: [
						{ role: 'component', id: 'cmp.data-catalog', ...TRADING_SURFACE_IDS.dataCatalog }
					]
				},
				{
					name: 'context',
					surfaces: [
						{
							role: 'component',
							id: 'cmp.workspace-controls',
							componentId: TRADING_SURFACE_IDS.workspaceControls.componentId,
							revision: TRADING_SURFACE_IDS.workspaceControls.revision
						}
					]
				},
				{
					name: 'primary',
					surfaces: [
						{
							role: 'component',
							id: 'cmp.market-chart',
							componentId: TRADING_SURFACE_IDS.marketChart.componentId,
							revision: TRADING_SURFACE_IDS.marketChart.revision
						}
					]
				},
				{
					name: 'inspection',
					surfaces: [
						{
							role: 'component',
							id: 'cmp.watchlist',
							componentId: TRADING_SURFACE_IDS.watchlist.componentId,
							revision: TRADING_SURFACE_IDS.watchlist.revision
						}
					]
				}
			],
			states: {
				loading: { role: 'text', id: 't.markets.loading', content: 'Loading market workspace…' },
				empty: {
					role: 'text',
					id: 't.markets.empty',
					content: 'The market workspace has no data yet.'
				},
				failure: {
					role: 'text',
					id: 't.markets.failure',
					content: 'The market workspace failed to load. Nothing is being guessed.'
				}
			}
		},
		{
			id: 's.methods',
			title: 'Methods',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Methods' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{
							role: 'status',
							id: 'st.methods.scope',
							value: 'Immutable Methods · Deterministic evaluation',
							tones: {}
						},
						{ role: 'component', id: 'cmp.methods', ...TRADING_SURFACE_IDS.methods }
					]
				}
			],
			states: {
				loading: { role: 'text', id: 't.methods.loading', content: 'Loading Method library…' },
				empty: {
					role: 'text',
					id: 't.methods.empty',
					content: 'No Methods yet. Create your first definition.'
				},
				failure: {
					role: 'text',
					id: 't.methods.failure',
					content: 'The Method library is unavailable. Retry to restore confirmed state.'
				},
				validation: {
					role: 'text',
					id: 't.methods.validation',
					content: 'Resolve definition diagnostics before freezing.'
				},
				stale: {
					role: 'text',
					id: 't.methods.stale',
					content: 'Last-known content. Reload before editing.'
				}
			}
		},
		{
			id: 's.backtest',
			title: 'Backtest',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Backtest' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.backtest.title', level: 2, content: 'Backtest runs' },
						{
							role: 'status',
							id: 'st.backtest',
							value: 'Planned — Stage T4',
							tones: { 'Planned — Stage T4': 'info' }
						},
						{
							role: 'text',
							id: 't.backtest.body',
							level: 3,
							content: laterStage('Historical evaluation with simulated fills', 'T4')
						}
					]
				}
			]
		},
		{
			id: 's.replay',
			title: 'Replay',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Replay' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.replay.title', level: 2, content: 'Blind replay practice' },
						{
							role: 'status',
							id: 'st.replay',
							value: 'Planned — Stage T4',
							tones: { 'Planned — Stage T4': 'info' }
						},
						{
							role: 'text',
							id: 't.replay.body',
							level: 3,
							content: laterStage('Interactive historical practice with the future hidden', 'T4')
						}
					]
				}
			]
		},
		{
			id: 's.live-watch',
			title: 'Live Watch',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Live Watch' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.lw.title', level: 2, content: 'Live Watch' },
						{
							role: 'status',
							id: 'st.lw',
							value: 'Planned — Stage T6',
							tones: { 'Planned — Stage T6': 'info' }
						},
						{
							role: 'text',
							id: 't.lw.body',
							level: 3,
							content: laterStage(
								'Background observation of the current market — recording, never ordering',
								'T6'
							)
						}
					]
				}
			]
		},
		{
			id: 's.trading',
			title: 'Trading',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Trading' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.trading.title', level: 2, content: 'Assisted-live trading' },
						{
							role: 'status',
							id: 'st.trading',
							value: 'Planned — Stage T7',
							tones: { 'Planned — Stage T7': 'info' }
						},
						{
							role: 'text',
							id: 't.trading.body',
							level: 3,
							content: laterStage(
								'Assisted-live operation with the trader as the final authority over every order',
								'T7'
							)
						}
					]
				}
			]
		},
		{
			id: 's.journal',
			title: 'Journal',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Journal' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.journal.title', level: 2, content: 'Journal' },
						{
							role: 'status',
							id: 'st.journal',
							value: 'Planned — Stage T5',
							tones: { 'Planned — Stage T5': 'info' }
						},
						{
							role: 'text',
							id: 't.journal.body',
							level: 3,
							content: laterStage('Opportunities, decisions, and unacted records', 'T5')
						}
					]
				}
			]
		},
		{
			id: 's.evidence',
			title: 'Evidence',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Evidence' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.evidence.title', level: 2, content: 'Evidence' },
						{
							role: 'status',
							id: 'st.evidence',
							value: 'Planned — Stage T5',
							tones: { 'Planned — Stage T5': 'info' }
						},
						{
							role: 'text',
							id: 't.evidence.body',
							level: 3,
							content: laterStage('Per-Method-Version performance and evidence lineage', 'T5')
						}
					]
				}
			]
		},
		{
			id: 's.risk',
			title: 'Risk',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Risk' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.risk.title', level: 2, content: 'Risk Constitution' },
						{
							role: 'status',
							id: 'st.risk',
							value: 'Planned — Stage T7',
							tones: { 'Planned — Stage T7': 'info' }
						},
						{
							role: 'text',
							id: 't.risk.body',
							level: 3,
							content: laterStage('Capital limits, hard and soft limits, and sessions', 'T7')
						}
					]
				}
			]
		},
		{
			id: 's.settings',
			title: 'Settings',
			breadcrumbs: [{ label: 'Desk', routeId: 'desk' }, { label: 'Settings' }],
			layout: [
				{
					name: 'main',
					surfaces: [
						{ role: 'text', id: 't.settings.title', level: 2, content: 'Settings' },
						{
							role: 'status',
							id: 'st.settings',
							value: 'Planned — later stage',
							tones: { 'Planned — later stage': 'info' }
						},
						{
							role: 'text',
							id: 't.settings.body',
							level: 3,
							content: laterStage('Data sources, integrations, and program administration', 'T3+')
						}
					]
				}
			]
		}
	],
	actions: [
		...evaluationActions,
		...methodActions,
		{
			kind: 'navigation',
			id: 'act.openMarkets',
			revision: '1',
			routeId: 'markets'
		},
		{
			kind: 'query',
			id: 'act.queryWorkspaces',
			revision: '1',
			resourceId: 'workspace_instances',
			resourceRevision: '1'
		},
		{
			kind: 'mutation',
			id: 'act.saveWorkspace',
			revision: '1',
			resourceId: 'workspace_instances',
			resourceRevision: '1',
			op: 'update',
			inputContractId: 'trading.workspace-record',
			inputContractRevision: '1'
		},
		{
			kind: 'mutation',
			id: 'act.createWorkspace',
			revision: '1',
			resourceId: 'workspace_instances',
			resourceRevision: '1',
			op: 'create',
			inputContractId: 'trading.workspace-record',
			inputContractRevision: '1'
		}
	],
	resources: [
		{ resourceId: 'workspace_instances', revision: '1' },
		{ resourceId: methodResource.id, revision: '1' }
	],
	components: [
		TRADING_SURFACE_IDS.dataCatalog,
		TRADING_SURFACE_IDS.methods,
		TRADING_SURFACE_IDS.deskOverview,
		TRADING_SURFACE_IDS.workspaceControls,
		TRADING_SURFACE_IDS.marketChart,
		TRADING_SURFACE_IDS.watchlist
	],
	theme: {
		reference: 'vict.default-theme',
		tokens: [
			{ name: 'color.bg', value: '#0d1117' },
			{ name: 'color.surface', value: '#161c24' },
			{ name: 'color.text', value: '#e8edf2' },
			{ name: 'color.textMuted', value: '#97a3ae' },
			{ name: 'color.accent', value: '#d29922' },
			{ name: 'color.accentContrast', value: '#10151c' },
			{ name: 'color.border', value: '#2a3340' },
			{ name: 'color.danger', value: '#e5534b' },
			{ name: 'color.warning', value: '#d9a53a' },
			{ name: 'color.success', value: '#3fb27f' },
			{ name: 'color.info', value: '#4c8bd8' },
			{ name: 'color.focusRing', value: '#4fa3ff' },
			{
				name: 'font.family',
				value: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
			},
			{ name: 'font.sizeBase', value: '15px' },
			{ name: 'spacing.unit', value: '6px' },
			{ name: 'radius.base', value: '6px' },
			{ name: 'density', value: '1' },
			{ name: 'elevation.low', value: '0 1px 2px rgba(0, 0, 0, 0.4)' },
			{ name: 'elevation.high', value: '0 10px 30px rgba(0, 0, 0, 0.55)' }
		]
	},
	compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2, vict: '0.1.1' }
});

/** The exact Workspace Instance schema marker used by persistence. */
export const WORKSPACE_SCHEMA_MARKER = WORKSPACE_INSTANCE_SCHEMA;
export const WORKSPACE_PRESETS = WORKSPACE_LAYOUT_PRESETS;

/**
 * Compile the neutral definition into the immutable plan. Throws a
 * structured failure when the definition is invalid — a broken definition
 * is a build-time error, never a silently degraded application.
 */
export function compileAppPlan(): ApplicationPlan {
	const result = compileApplication({
		application,
		resources: [workspaceResource, methodResource],
		// The compiler consumes contract REGISTRY ENTRIES (identity only — the
		// canonical compile boundary never receives executable parse
		// functions); the data adapter binds the actual contract objects.
		contracts: [
			workspaceRecordContract,
			methodCommandContract,
			methodReplyContract,
			evaluationCommandContract,
			evaluationReplyContract
		].map(({ id, revision }) => ({ id, revision })),
		capabilities: EVALUATION_CAPABILITIES,
		components: application.components ?? []
	});
	if (!result.ok) {
		const details = result.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ');
		throw new Error(`The Trading OS application definition is invalid: ${details}`);
	}
	return result.plan;
}
