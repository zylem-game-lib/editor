import { afterEach, describe, expect, it } from 'vitest';
import {
	isPanelVisible,
	overrideForToggle,
	setPanelShown,
	visibleAccordionIds,
} from '../../src/components/editor-panel/panel-visibility';
import { debugStore, resetPanelOverrides } from '../../src/components/editor-store';

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

	it('lets a stored choice win, including over an always-on section', () => {
		expect(isPanelVisible('console', idle, { console: 'hide' })).toBe(false);
		expect(isPanelVisible('game-config', idle, { 'game-config': 'hide' })).toBe(false);
		expect(isPanelVisible('level', idle, { level: 'show' })).toBe(true);
		expect(isPanelVisible('level', { ...idle, build: true }, { level: 'hide' })).toBe(false);
	});
});

describe('overrideForToggle', () => {
	afterEach(() => {
		resetPanelOverrides();
	});

	it('stores a choice only when it differs from the mode', () => {
		expect(overrideForToggle(true, true)).toBeNull();
		expect(overrideForToggle(false, false)).toBeNull();
		expect(overrideForToggle(false, true)).toBe('hide');
		expect(overrideForToggle(true, false)).toBe('show');
	});

	it('drops the stored choice once the checkbox matches the mode again', () => {
		resetPanelOverrides();
		setPanelShown('console', false);
		expect(debugStore.panelOverrides.console).toBe('hide');
		setPanelShown('console', true);
		expect(debugStore.panelOverrides.console).toBeUndefined();
	});

	it('reset drops every stored choice', () => {
		setPanelShown('console', false);
		setPanelShown('level', true);
		resetPanelOverrides();
		expect(debugStore.panelOverrides).toEqual({});
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

	it('keeps a manually hidden section out of the accordion', () => {
		expect(
			visibleAccordionIds(
				order,
				[],
				{ debug: false, build: false, tool: 'select' },
				{ console: 'hide' }
			)
		).toEqual(['game-config', 'stage-config']);
	});
});
