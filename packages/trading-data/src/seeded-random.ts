/**
 * Deterministic seeded PRNG (mulberry32). Used only for fixture generation:
 * identical seeds always produce identical sequences, in any process, on
 * any platform, in any run.
 */
export type SeededRandom = () => number;

/** Create a seeded generator from a 32-bit seed. */
export function mulberry32(seed: number): SeededRandom {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Stable 32-bit string hash (FNV-1a). Never security-relevant. */
export function hashString(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}
