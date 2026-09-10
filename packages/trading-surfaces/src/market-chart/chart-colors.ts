/**
 * Resolve product design tokens to concrete color values for the chart
 * engine (canvas cannot interpret CSS custom properties). Reads the
 * computed token values at chart-creation time; safe defaults keep the
 * chart readable if tokens are unavailable.
 */
import type { MarketChartColors } from './market-chart-adapter.ts';

export function resolveMarketChartColors(): MarketChartColors {
	const fallback: MarketChartColors = {
		background: 'transparent',
		text: '#97a3ae',
		grid: '#212a35',
		border: '#2a3340',
		crosshair: '#4fa3ff',
		up: '#3fb27f',
		down: '#e5534b',
		volumeUp: 'rgba(63, 178, 127, 0.42)',
		volumeDown: 'rgba(229, 83, 75, 0.42)'
	};
	if (typeof document === 'undefined') {
		return fallback;
	}
	const styles = getComputedStyle(document.documentElement);
	const read = (name: string, fb: string): string => {
		const value = styles.getPropertyValue(name).trim();
		return value.length > 0 ? value : fb;
	};
	return {
		background: 'transparent',
		text: read('--tos-chart-text', fallback.text),
		grid: read('--tos-chart-grid', fallback.grid),
		border: read('--tos-chart-border', fallback.border),
		crosshair: read('--tos-chart-crosshair', fallback.crosshair),
		up: read('--tos-up', fallback.up),
		down: read('--tos-down', fallback.down),
		volumeUp: read('--tos-vol-up', fallback.volumeUp),
		volumeDown: read('--tos-vol-down', fallback.volumeDown)
	};
}
