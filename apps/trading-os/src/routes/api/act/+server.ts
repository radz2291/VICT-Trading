import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { RequestHandler } from './$types';

// The ONLY action boundary of the application. Every non-local action
// crosses the server-side authorization/effect boundary here; local actions
// never reach this endpoint at all.
export const POST: RequestHandler = async ({ request, url }) => {
	if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) {
		return json(
			{ ok: false, code: 'DENIED', message: 'This action is not permitted.' },
			{ status: 403 }
		);
	}
	let body: { actionId?: unknown; input?: unknown };
	try {
		const raw = await request.text();
		if (raw.length > 300000) throw new Error('Request limit');
		body = JSON.parse(raw) as { actionId?: unknown; input?: unknown };
	} catch {
		return json(
			{
				ok: false,
				code: 'INVALID_REQUEST',
				message: 'The request body must be JSON.'
			},
			{ status: 400 }
		);
	}
	if (
		!body ||
		Array.isArray(body) ||
		typeof body !== 'object' ||
		Object.keys(body).some((k) => !['actionId', 'input'].includes(k)) ||
		typeof body.actionId !== 'string' ||
		body.actionId.length === 0
	) {
		return json(
			{ ok: false, code: 'INVALID_REQUEST', message: 'actionId is required.' },
			{ status: 400 }
		);
	}
	try {
		const result = await getAppServer().dispatch(body.actionId, body.input);
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json(
			{
				ok: false,
				code: 'PERSISTENCE_FAILED',
				message: 'Persistence could not be confirmed. Retain your changes and retry.'
			},
			{ status: 503 }
		);
	}
};
