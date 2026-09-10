import { error } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { PageServerLoad } from './$types';

// The ONLY page server load of the application: resolves the route from the
// neutral plan and reads the persisted workspace instance through the
// application-data port. Unknown paths produce a structured 404 — never a
// silent fallback. The payload contains declarations and workspace state
// only — never secrets or filesystem paths.
export const load: PageServerLoad = async ({ url }) => {
	const app = getAppServer();
	const path = url.pathname === '' ? '/' : url.pathname;
	const route = app.loadRoute(path);
	if (route === undefined || route === null) {
		throw error(404, 'No application route is declared for this path.');
	}
	const workspace = await app.readWorkspace();
	return {
		plan: app.plan.toJSON(),
		workspace
	};
};
