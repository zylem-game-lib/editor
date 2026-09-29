import { describe, expect, it } from 'vitest';
import {
	isPanelVisible,
	visibleAccordionIds,
} from '../../src/components/editor-panel/panel-visibility';

const order = [
	'game-config',
	'stage-config',
	'entities',
	'transform',
	'level',
	'console',
	'bridge',
];

describe('isPanelVisible', () => {
	const idle = { debug: false, build: false, tool: 'select' as const };

	it('always shows game, stage, and console', () => {
		expect(isPanelVisible('game-config', idle)).toBe(true);
		expect(isPanelVisible('stage-config', idle)).toBe(true);
		expect(isPanelVisible('console', idle)).toBe(true);
		expect(isPanelVisible('entities', idle)).toBe(false);
		expect(isPanelVisible('bridge', idle)).toBe(false);
		expect(isPanelVisible('level', idle)).toBe(false);
		expect(isPanelVisible('transform', idle)).toBe(false);
	});

	it('shows transform only for a gizmo, and adds layer panels without hiding the rest', () => {
		expect(isPanelVisible('transform', { ...idle, tool: 'translate' })).toBe(true);
		expect(isPanelVisible('entities', { ...idle, debug: true })).toBe(true);
		expect(isPanelVisible('bridge', { ...idle, debug: true })).toBe(true);
		expect(isPanelVisible('level', { ...idle, build: true })).toBe(true);
		expect(isPanelVisible('console', { debug: true, build: true, tool: 'scale' })).toBe(true);
	});
});

describe('visibleAccordionIds', () => {
	it('keeps hidden and detached ids out of the accordion but not out of the stored order', () => {
		expect(
			visibleAccordionIds(order, ['console'], {
				debug: true,
				build: false,
				tool: 'rotate',
			})
		).toEqual(['game-config', 'stage-config', 'entities', 'transform', 'bridge']);
	});
});
