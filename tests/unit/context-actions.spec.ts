import { describe, expect, it } from 'vitest';
import { contextToolbarActions } from '../../src/components/toolbar/context-actions';

describe('contextToolbarActions', () => {
	const base = ['translate', 'rotate', 'scale', 'snap', 'undo', 'redo'];

	it('always shows the select gizmos, then snap, undo, and redo once', () => {
		expect(contextToolbarActions({ perspective: false, debug: false, build: false })).toEqual(base);
	});

	it('appends each layer without repeating the shared actions', () => {
		expect(contextToolbarActions({ perspective: true, debug: true, build: true })).toEqual([
			'translate',
			'rotate',
			'scale',
			'view-game',
			'view-side',
			'view-top',
			'view-isometric',
			'view-free',
			'grid',
			'draw-brush',
			'clip-brush',
			'vertex-brush',
			'delete',
			'snap',
			'undo',
			'redo',
		]);
	});

	it('switches the level row with the active layer', () => {
		expect(
			contextToolbarActions({ perspective: false, debug: false, build: true, levelLayer: 'doodad' })
		).toEqual(['translate', 'rotate', 'scale', 'add-doodad', 'delete', 'snap', 'undo', 'redo']);
		expect(
			contextToolbarActions({ perspective: false, debug: false, build: true, levelLayer: 'entity' })
		).toEqual([
			'translate',
			'rotate',
			'scale',
			'add-spawn',
			'add-trigger',
			'delete',
			'snap',
			'undo',
			'redo',
		]);
	});
});
