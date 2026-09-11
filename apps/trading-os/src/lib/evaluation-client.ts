import {
	parseEvaluationReply,
	contentFingerprint,
	canonicalEvaluation,
	EVALUATION_LIMITS,
	EVALUATION_ERRORS,
	CALCULATION_DIAGNOSTICS,
	type EvaluationClient,
	type EvaluationErrorCode,
	type DiagnosticCode,
	type CalculationDiagnostic
} from '@trading-os/trading-domain';
import { EVALUATION_ACTION_OPS } from './application/evaluation-actions';
export function createEvaluationClient(send: typeof fetch = fetch): EvaluationClient {
	return {
		async execute(command) {
			const controller = new AbortController(),
				timeout = setTimeout(() => controller.abort(), 15000);
			try {
				const actionId = Object.entries(EVALUATION_ACTION_OPS).find(([, ops]) =>
					(ops as readonly string[]).includes(command.op)
				)?.[0];
				const response = await send('/api/act', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ actionId, input: command }),
					signal: controller.signal
				});
				const reader = response.body?.getReader();
				if (!reader) throw new Error('Missing response');
				const decoder = new TextDecoder('utf-8', { fatal: true });
				let raw = '',
					bytes = 0;
				try {
					while (true) {
						const chunk = await reader.read();
						if (chunk.done) break;
						bytes += chunk.value.byteLength;
						if (bytes > EVALUATION_LIMITS.responseBytes) {
							await reader.cancel();
							throw new Error('Response limit');
						}
						raw += decoder.decode(chunk.value, { stream: true });
					}
					raw += decoder.decode();
				} finally {
					reader.releaseLock();
				}
				const result = JSON.parse(raw);
				if (response.ok && result?.ok === true) {
					const value = parseEvaluationReply(result.value),
						expected =
							command.op === 'catalog'
								? 'catalog'
								: command.op === 'install'
									? 'ingestion'
									: command.op === 'runs'
										? 'runs'
										: command.op === 'bars'
											? 'bars'
											: 'run';
					if (value.kind !== expected) throw new Error('Unexpected reply');
					if (
						value.kind === 'run' &&
						value.run.id !==
							(command.op === 'get'
								? command.runId
								: command.op === 'start'
									? command.requestId
									: '')
					)
						throw new Error('Wrong run');
					if (value.kind === 'run') {
						if (
							(await contentFingerprint(canonicalEvaluation(value.run.identity))) !==
							value.run.inputFingerprint
						)
							throw new Error('Input hash mismatch');
						if (
							value.result &&
							(await contentFingerprint(value.result.canonical)) !== value.result.fingerprint
						)
							throw new Error('Result hash mismatch');
					}
					if (value.kind === 'runs')
						for (const run of value.runs)
							if (
								(await contentFingerprint(canonicalEvaluation(run.identity))) !==
								run.inputFingerprint
							)
								throw new Error('Input hash mismatch');
					return { ok: true, value };
				}
				const code: EvaluationErrorCode =
					typeof result?.code === 'string' && Object.hasOwn(EVALUATION_ERRORS, result.code)
						? result.code
						: 'PERSISTENCE_FAILED';
				const diagnostics: CalculationDiagnostic[] = Array.isArray(result?.diagnostics)
					? result.diagnostics.slice(0, 64).flatMap((d: unknown) => {
							if (!d || typeof d !== 'object') return [];
							const v = d as Record<string, unknown>;
							if (
								typeof v.code !== 'string' ||
								!Object.hasOwn(CALCULATION_DIAGNOSTICS, v.code) ||
								typeof v.instanceId !== 'string' ||
								!/^[A-Za-z0-9_.:-]{1,96}$/.test(v.instanceId)
							)
								return [];
							return [
								{
									code: v.code as DiagnosticCode,
									instanceId: v.instanceId,
									message: CALCULATION_DIAGNOSTICS[v.code as DiagnosticCode]
								}
							];
						})
					: [];
				return { ok: false, code, message: EVALUATION_ERRORS[code], diagnostics };
			} catch {
				return {
					ok: false,
					code: 'PERSISTENCE_FAILED',
					message: EVALUATION_ERRORS.PERSISTENCE_FAILED,
					diagnostics: []
				};
			} finally {
				clearTimeout(timeout);
			}
		}
	};
}
