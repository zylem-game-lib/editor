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
			'view-top',
			'view-side',
			'view-isometric',
			'view-custom',
			'grid',
			'add-actor',
			'add-level',
			'add-primitive',
			'delete',
			'snap',
			'undo',
			'redo',
		]);
	});
});
