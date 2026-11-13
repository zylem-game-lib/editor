import { describe, expect, it } from 'vitest';
import { toolbarModeFor } from '../../src/components/toolbar/toolbar-mode';

describe('toolbar colorways', () => {
	it('keeps the primary glass until a mode is chosen', () => {
		expect(toolbarModeFor(null)).toBe('primary');
	});

	it('gives each harness mode its colorway', () => {
		expect(toolbarModeFor('game-preview')).toBe('black');
		expect(toolbarModeFor('stage-editor')).toBe('primary');
		expect(toolbarModeFor('level-builder-mesh')).toBe('white');
		expect(toolbarModeFor('level-builder-navigation')).toBe('brown');
		expect(toolbarModeFor('level-builder-decoration')).toBe('yellow');
		expect(toolbarModeFor('hud-view')).toBe('magenta');
		expect(toolbarModeFor('entity-editor')).toBe('purple');
	});
});
