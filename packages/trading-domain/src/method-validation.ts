import {
	METHOD_CONTENT_SCHEMA,
	MethodError,
	immutableCopy,
	type CapabilityCatalog,
	type CapabilityField,
	type Diagnostic,
	type MethodContent,
	type Scalar
} from './method.ts';

export function record(value: unknown): Record<string, unknown> {
	if (
		!value ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		![Object.prototype, null].includes(Object.getPrototypeOf(value))
	)
		throw new MethodError('INVALID_REQUEST');
	return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, keys: readonly string[]): void {
	if (
		Object.keys(value).length !== keys.length ||
		Object.keys(value).some((k) => !keys.includes(k))
	)
		throw new MethodError('INVALID_REQUEST');
}
export function textValue(value: unknown, max: number, nonempty = false): string {
	if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim()))
		throw new MethodError('INVALID_REQUEST');
	return value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}
export function identifier(value: unknown): string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(value))
		throw new MethodError('INVALID_REQUEST');
	return value;
}
export function revisionValue(value: unknown, min = 1): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min)
		throw new MethodError('INVALID_REQUEST');
	return value;
}
function array(value: unknown, max: number): unknown[] {
	if (!Array.isArray(value) || value.length > max) throw new MethodError('INVALID_REQUEST');
	return value;
}

/** Structural safety permits incomplete drafts and unsupported revisions to be retained. */
export function parseMethodContent(input: unknown): MethodContent {
	const r = record(input);
	if (r.schema !== METHOD_CONTENT_SCHEMA) throw new MethodError('UNSUPPORTED_SCHEMA');
	exact(r, ['schema', 'name', 'description', 'observations', 'rulePolicy', 'capabilities']);
	if (r.rulePolicy !== 'all' && r.rulePolicy !== 'any') throw new MethodError('INVALID_REQUEST');
	return immutableCopy({
		schema: METHOD_CONTENT_SCHEMA,
		name: textValue(r.name, 120),
		description: textValue(r.description, 4000),
		rulePolicy: r.rulePolicy,
		observations: array(r.observations, 32).map((v) => {
			const o = record(v);
			exact(o, ['id', 'label', 'instrument', 'timeframe', 'dataType']);
			if (o.dataType !== 'bars') throw new MethodError('INVALID_REQUEST');
			return {
				id: identifier(o.id),
				label: textValue(o.label, 100),
				instrument: textValue(o.instrument, 80),
				timeframe: textValue(o.timeframe, 30),
				dataType: 'bars' as const
			};
		}),
		capabilities: array(r.capabilities, 64).map((v) => {
			const c = record(v);
			exact(c, ['id', 'capabilityId', 'revision', 'config']);
			const config = record(c.config);
			if (Object.keys(config).length > 24) throw new MethodError('INVALID_REQUEST');
			const normalized: Record<string, Scalar> = {};
			for (const key of Object.keys(config).sort()) {
				identifier(key);
				if (['__proto__', 'constructor', 'prototype'].includes(key))
					throw new MethodError('INVALID_REQUEST');
				const value = config[key];
				if (typeof value === 'string') normalized[key] = textValue(value, 2000);
				else if (
					typeof value === 'boolean' ||
					(typeof value === 'number' && Number.isFinite(value))
				)
					normalized[key] = value;
				else throw new MethodError('INVALID_REQUEST');
			}
			return {
				id: identifier(c.id),
				capabilityId: identifier(c.capabilityId),
				revision: identifier(c.revision),
				config: normalized
			};
		})
	});
}
export function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	if (value && typeof value === 'object')
		return `{${Object.keys(value)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
			.join(',')}}`;
	return JSON.stringify(value);
}
export async function contentFingerprint(canonical: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonical)
	);
	return `sha256:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
export function fieldIssue(field: CapabilityField, value: Scalar | undefined): string | null {
	if (value === undefined || value === '') return field.required ? 'A value is required.' : null;
	switch (field.type) {
		case 'number':
			return typeof value !== 'number' ||
				value < field.min ||
				value > field.max ||
				(field.integer && !Number.isInteger(value))
				? `Use ${field.integer ? 'an integer' : 'a number'} from ${field.min} to ${field.max}.`
				: null;
		case 'boolean':
			return typeof value === 'boolean' ? null : 'Use true or false.';
		case 'enum':
			return typeof value === 'string' && field.options.includes(value)
				? null
				: 'Choose a supported value.';
		case 'text':
			return typeof value === 'string' && value.length <= field.maxLength
				? null
				: `Use text up to ${field.maxLength} characters.`;
		default:
			return typeof value === 'string' ? null : 'Choose a valid reference.';
	}
}
export function validateMethod(
	content: MethodContent,
	catalog: CapabilityCatalog
): readonly Diagnostic[] {
	const issues: Diagnostic[] = [];
	const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
	if (!content.name) add('REQUIRED', 'name', 'Name this Method.');
	if (!content.observations.length)
		add('REQUIRED', 'observations', 'Add at least one observation context.');
	const contexts = new Set<string>();
	content.observations.forEach((o, i) => {
		if (contexts.has(o.id))
			add('DUPLICATE_ID', `observations.${i}.id`, 'Context identities must be unique.');
		contexts.add(o.id);
		for (const field of ['label', 'instrument', 'timeframe'] as const)
			if (!o[field]) add('REQUIRED', `observations.${i}.${field}`, 'A value is required.');
	});
	const instances = new Set<string>();
	let ruleCount = 0;
	content.capabilities.forEach((c, i) => {
		const path = `capabilities.${i}`;
		if (instances.has(c.id))
			add('DUPLICATE_ID', `${path}.id`, 'Instance identities must be unique.');
		instances.add(c.id);
		const definition = catalog.resolve(c.capabilityId, c.revision);
		if (!definition) {
			add(
				'UNSUPPORTED_CAPABILITY',
				path,
				'This exact capability revision is unavailable. Retained for recovery; version creation is blocked.'
			);
			return;
		}
		if (definition.category === 'rule') ruleCount++;
		for (const key of Object.keys(c.config).sort())
			if (!definition.fields.some((f) => f.key === key))
				add(
					'UNKNOWN_FIELD',
					`${path}.config.${key}`,
					'This field is not declared by the pinned capability revision.'
				);
		for (const field of definition.fields) {
			const value = c.config[field.key];
			const fieldPath = `${path}.config.${field.key}`;
			const issue = fieldIssue(field, value);
			if (issue) {
				add('INVALID_CONFIG', fieldPath, issue);
				continue;
			}
			if (field.type === 'context' && typeof value === 'string' && !contexts.has(value))
				add('INVALID_REFERENCE', fieldPath, 'Choose an existing observation context.');
			if (field.type === 'instance' && typeof value === 'string') {
				const source = content.capabilities.slice(0, i).find((x) => x.id === value);
				if (
					!source ||
					catalog.resolve(source.capabilityId, source.revision)?.output !== field.output
				)
					add(
						'INVALID_REFERENCE',
						fieldPath,
						'Choose a compatible earlier analysis instance. Move its definition before this rule.'
					);
			}
		}
	});
	if (!ruleCount) add('REQUIRED', 'capabilities', 'Add at least one structured rule definition.');
	return immutableCopy(issues);
}
export async function canonicalizeMethod(input: unknown, catalog: CapabilityCatalog) {
	const parsed = parseMethodContent(input);
	// Observation declaration order is not semantic; capability dependency order IS.
	const content = immutableCopy({
		...parsed,
		observations: [...parsed.observations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
	});
	const diagnostics = validateMethod(content, catalog);
	if (diagnostics.length) return { content, diagnostics, canonical: null, fingerprint: null };
	const canonical = stableJson(content);
	return { content, diagnostics, canonical, fingerprint: await contentFingerprint(canonical) };
}
