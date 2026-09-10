/** Test double for `$app/navigation` (asserted via spies in tests). */
import { vi } from 'vitest';

export const goto = vi.fn<(url: string, opts?: unknown) => Promise<void>>(async () => {});
export const invalidateAll = vi.fn<() => Promise<void>>(async () => {});
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
