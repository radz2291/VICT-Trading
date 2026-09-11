import {
	parseMethodReply,
	METHOD_ERROR_MESSAGES,
	type MethodClient,
	type MethodCommand,
	type MethodErrorCode
} from '@trading-os/trading-domain';
import { METHOD_ACTION_OPS } from '$lib/application/method-actions';
export function createMethodClient(send: typeof fetch = fetch): MethodClient {
	return {
		async execute(command: MethodCommand) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 5000);
			try {
				const actionId = Object.entries(METHOD_ACTION_OPS).find(([, ops]) =>
					(ops as readonly string[]).includes(command.op)
				)?.[0];
				const response = await send('/api/act', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					signal: controller.signal,
					body: JSON.stringify({ actionId, input: command })
				});
				const result = await response.json();
				if (response.ok && result?.ok === true) {
					const value = parseMethodReply(result.value);
					const expected =
						command.op === 'list'
							? 'library'
							: command.op === 'profile' || command.op === 'assign'
								? 'profile'
								: command.op === 'compare'
									? 'comparison'
									: command.op === 'validate'
										? 'validation'
										: 'detail';
					if (value.kind !== expected) throw new Error('Unexpected response contract');
					return { ok: true, value };
				}
				const code: MethodErrorCode =
					result &&
					typeof result.code === 'string' &&
					Object.hasOwn(METHOD_ERROR_MESSAGES, result.code)
						? result.code
						: 'PERSISTENCE_FAILED';
				// Error prose never comes from a remote exception or raw database diagnostic.
				return { ok: false, code, message: METHOD_ERROR_MESSAGES[code], diagnostics: [] };
			} catch {
				return {
					ok: false,
					code: 'PERSISTENCE_FAILED',
					message: METHOD_ERROR_MESSAGES.PERSISTENCE_FAILED,
					diagnostics: []
				};
			} finally {
				clearTimeout(timeout);
			}
		}
	};
}
