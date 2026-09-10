/**
 * Typed integration shim for `@victframework/renderer-svelte`.
 *
 * WHY THIS EXISTS: renderer-svelte is the one VICT package whose "types"
 * condition resolves to its Svelte SOURCE (not a dist .d.ts). Type-checking
 * its source pulls its internal `mount.svelte.ts` into this program, which
 * contains a pre-existing internal strictness variance (an `unknown` prop
 * passed into the component's `VictPlanView` prop) that is invisible through
 * the package's own public contract and is not Trading OS's to fix. This
 * shim declares the exact public surface Trading OS consumes so the
 * consumer typecheck is clean; RUNTIME resolution is untouched — vite and
 * vitest load the real published package through its exports map.
 * The declared shape mirrors the shipped 0.1.1 public API and is verified
 * by the composition and browser test suites.
 */
import type { Component } from 'svelte';

/** Mirrors the renderer's public `ActionResult` (safe structured value). */
export interface ActionResult {
	ok: boolean;
	value?: unknown;
	code?: string;
	message?: string;
}

/** Mirrors the renderer's public `ViewDatum`. */
export interface ViewDatum {
	readonly rows?: readonly Record<string, unknown>[];
	readonly record?: Record<string, unknown> | null;
	readonly total?: number;
	readonly loading?: boolean;
	readonly stale?: boolean;
	readonly partial?: boolean;
}

/** Structural subset of the compiled plan the renderer consumes. */
export interface VictPlanView {
	readonly applicationId: string;
	readonly applicationRevision: string;
	readonly applicationVersion: string;
	readonly routes: readonly unknown[];
	readonly screens: Readonly<Record<string, unknown>>;
	readonly views: Readonly<Record<string, unknown>>;
	readonly forms: Readonly<Record<string, unknown>>;
	readonly actions: Readonly<Record<string, unknown>>;
	readonly manifest?: { readonly theme?: unknown };
}

/** The canonical generic application host component. */
export const VitApp: Component<{
	plan: VictPlanView;
	registry: unknown;
	dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
	path?: string;
	viewData?: Readonly<Record<string, ViewDatum>>;
	onInvalidate?: () => void;
	record?: Record<string, unknown> | null;
	navigate?: (path: string) => void;
}>;

/** The canonical renderer identity (participates in release identity only). */
export const RENDERER_ID: string;
export const RENDERER_REVISION: string;
