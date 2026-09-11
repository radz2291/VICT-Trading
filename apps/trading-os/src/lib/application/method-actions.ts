import {
	defineResource,
	RESOURCE_DEFINITION_SCHEMA,
	type ActionDefinition
} from '@victframework/sdk';
import { defineContract } from '@victframework/contracts';
import { parseMethodCommand, parseMethodReply } from '@trading-os/trading-domain';

export const METHOD_ACTION_OPS = {
	'act.methodRead': ['list', 'get', 'version', 'compare', 'profile', 'validate'],
	'act.methodCreate': ['create'],
	'act.methodSave': ['save'],
	'act.methodFreeze': ['freeze'],
	'act.methodRevise': ['revise'],
	'act.methodClone': ['clone'],
	'act.methodAssign': ['assign']
} as const;
export const methodCommandContract = defineContract({
	id: 'trading.method-command',
	revision: '1',
	expected: 'A bounded Method authoring command with explicit revision and retry identity.',
	parse(input: unknown) {
		try {
			return { ok: true as const, value: parseMethodCommand(input) };
		} catch {
			return {
				ok: false as const,
				issues: [{ code: 'INVALID_REQUEST', path: '', message: 'Invalid Method command.' }]
			};
		}
	}
});
export const methodReplyContract = defineContract({
	id: 'trading.method-reply',
	revision: '1',
	expected: 'Validated Method authoring response.',
	parse(input: unknown) {
		try {
			return { ok: true as const, value: parseMethodReply(input) };
		} catch {
			return {
				ok: false as const,
				issues: [{ code: 'INVALID_RECORD', path: '', message: 'Invalid Method response.' }]
			};
		}
	}
});
export const methodResource = defineResource({
	schema: RESOURCE_DEFINITION_SCHEMA,
	id: 'method_system',
	revision: '1',
	identity: { key: 'id' },
	fields: [
		{ name: 'id', type: 'string', required: true },
		{ name: 'name', type: 'string', required: true },
		{ name: 'description', type: 'string', required: true }
	],
	queries: { list: { pagination: false } },
	authorization: { effect: 'read', permissions: ['method.read'] },
	mutations: ['create', 'save', 'freeze', 'revise', 'clone', 'assign'].map((op) => ({
		op,
		effect: 'write' as const,
		inputContractId: methodCommandContract.id,
		outputContractId: methodReplyContract.id,
		permissions: ['method.write'],
		idempotency: 'keyed' as const
	}))
});
/** Declared domain verbs; implemented by the product transaction service, not flat CRUD. */
export const methodActions: readonly ActionDefinition[] = Object.entries(METHOD_ACTION_OPS).map(
	([id, ops]) =>
		id === 'act.methodRead'
			? {
					kind: 'query',
					id,
					revision: '1',
					resourceId: methodResource.id,
					resourceRevision: '1',
					inputContractId: methodCommandContract.id,
					inputContractRevision: '1',
					outputContractId: methodReplyContract.id,
					outputContractRevision: '1'
				}
			: {
					kind: 'mutation',
					id,
					revision: '1',
					resourceId: methodResource.id,
					resourceRevision: '1',
					op: ops[0]!,
					inputContractId: methodCommandContract.id,
					inputContractRevision: '1',
					outputContractId: methodReplyContract.id,
					outputContractRevision: '1'
				}
);
