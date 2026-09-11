import { defineContract } from '@victframework/contracts';
import type { ActionDefinition } from '@victframework/sdk';
import { parseEvaluationCommand, parseEvaluationReply } from '@trading-os/trading-domain';
export const EVALUATION_ACTION_OPS = {
	'act.dataRead': ['catalog', 'runs', 'get', 'bars'],
	'act.fixtureInstall': ['install'],
	'act.evaluationStart': ['start']
} as const;
export const EVALUATION_CAPABILITIES = [
	{ id: 'trading.data-read', revision: '1', effect: 'read' as const, permissions: ['market.read'] },
	{
		id: 'trading.ingest-fixture',
		revision: '1',
		effect: 'write' as const,
		permissions: ['market.write']
	},
	{
		id: 'trading.evaluation-start',
		revision: '1',
		effect: 'write' as const,
		permissions: ['evaluation.write', 'market.read']
	}
] as const;
export const evaluationCommandContract = defineContract({
	id: 'trading.evaluation-command',
	revision: '1',
	expected: 'A bounded data/evaluation command.',
	parse(input: unknown) {
		try {
			return { ok: true as const, value: parseEvaluationCommand(input) };
		} catch {
			return {
				ok: false as const,
				issues: [{ code: 'INVALID_REQUEST', path: '', message: 'Invalid evaluation command.' }]
			};
		}
	}
});
export const evaluationReplyContract = defineContract({
	id: 'trading.evaluation-reply',
	revision: '1',
	expected: 'A validated bounded evaluation reply.',
	parse(input: unknown) {
		try {
			return { ok: true as const, value: parseEvaluationReply(input) };
		} catch {
			return {
				ok: false as const,
				issues: [{ code: 'INVALID_RECORD', path: '', message: 'Invalid evaluation response.' }]
			};
		}
	}
});
export const evaluationActions: readonly ActionDefinition[] = Object.keys(
	EVALUATION_ACTION_OPS
).map((id, i) => ({
	kind: 'capability',
	id,
	revision: '1',
	capabilityId: EVALUATION_CAPABILITIES[i]!.id,
	capabilityRevision: '1',
	inputContractId: evaluationCommandContract.id,
	inputContractRevision: '1',
	outputContractId: evaluationReplyContract.id,
	outputContractRevision: '1'
}));
