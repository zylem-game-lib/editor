import { describe, expect, it } from 'vitest';
import { MAIN_PANEL_ID, TOOLBAR_PANEL_ID } from '../../src/components/common/dock-layout';
import {
	dockSideFromWindow,
	toWindowDock,
	windowDockOptions,
} from '../../src/components/common/window-dock';

describe('window dock menu', () => {
	it('keeps the toolbar on the default top, float, and bottom menu', () => {
		expect(windowDockOptions(TOOLBAR_PANEL_ID)).toBeUndefined();
		expect(toWindowDock('top')).toBe('top');
		expect(toWindowDock(null)).toBe('float');
		expect(dockSideFromWindow(TOOLBAR_PANEL_ID, 'bottom')).toBe('bottom');
		expect(dockSideFromWindow(TOOLBAR_PANEL_ID, 'float')).toBeNull();
	});

	it('offers the main panel left, float, and right on the same control', () => {
		expect(windowDockOptions(MAIN_PANEL_ID)?.map((option) => option.label)).toEqual([
			'Left',
			'Float',
			'Right',
		]);
		expect(toWindowDock('right')).toBe('right');
		expect(dockSideFromWindow(MAIN_PANEL_ID, 'left')).toBe('left');
		expect(dockSideFromWindow(MAIN_PANEL_ID, 'top')).toBeNull();
	});

	it('offers a detached section float and the bottom band', () => {
		expect(windowDockOptions('console')?.map((option) => option.label)).toEqual([
			'Float',
			'Bottom',
		]);
		expect(toWindowDock('single')).toBe('bottom');
		expect(toWindowDock(null)).toBe('float');
		expect(dockSideFromWindow('console', 'bottom')).toBe('single');
		expect(dockSideFromWindow('console', 'float')).toBeNull();
		expect(dockSideFromWindow('console', 'top')).toBeNull();
	});
});
