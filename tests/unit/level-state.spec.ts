import {
	boxBrush,
	DEFAULT_DRAW_SHAPE,
	getZylemBridge,
	type LevelDocument,
	type LevelElementRef,
	type LevelSyncPayload,
} from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	applyLevelSelect,
	clearLevelSelection,
	levelState,
	loadLevelDocument,
	resetLevelEditor,
	selectLevelRow,
	setLevelDrawSegments,
	setLevelDrawShape,
	setLevelDrawSides,
	setLevelDrawThickness,
	setLevelDrawTurn,
	setLevelEditorActive,
	setLevelElementMode,
	setLevelSectorTint,
	toggleLevelSectorHidden,
	turnLevelDrawShape,
} from '../../src/components/level/level-state';
import { setGridVisible, transformState } from '../../src/components/transform/transform-state';

let syncs: LevelSyncPayload[];
let stopCapture: () => void = () => {};

/** Solid `a` alone, `b` and `c` in group `arch`, doodad `d`, spawn `e`. */
function scene(): LevelDocument {
	const box = (x: number) => boxBrush({ x, y: 0, z: 0 }, { x: x + 1, y: 1, z: 1 });
	return {
		version: 2,
		solids: [
			{ id: 'a', planes: box(0) },
			{ id: 'b', planes: box(4), groupId: 'arch' },
			{ id: 'c', planes: box(6), groupId: 'arch' },
		],
		doodads: [{ id: 'd', typeId: 'box', pose: { position: { x: 1, y: 0, z: 0 } }, props: {} }],
		entities: [
			{
				id: 'e',
				typeId: 'spawn',
				name: 'spawn-1',
				pose: { position: { x: 0, y: 1, z: 0 } },
				props: { spawnKind: 'player', archetype: '' },
			},
		],
	};
}

function face(brushId: string, plane: number): LevelElementRef {
	return { brushId, kind: 'face', planes: [plane] };
}

const lastSync = () => syncs[syncs.length - 1];

beforeEach(() => {
	const { channel } = getZylemBridge();
	channel.reset();
	resetLevelEditor();
	loadLevelDocument(scene());
	setLevelEditorActive(true);
	syncs = [];
	stopCapture = channel.on('level:sync', (payload) => syncs.push(payload));
});

afterEach(() => {
	stopCapture();
});

describe('applyLevelSelect: objects', () => {
	it('replaces the selection with the hit, and syncs without an undo step', () => {
		levelState.selectedIds = ['a'];
		applyLevelSelect({ id: 'd' });
		expect(levelState.selectedIds).toEqual(['d']);
		expect(levelState.activeLayer).toBe('doodad');
		expect(lastSync()?.selectedIds).toEqual(['d']);
		expect(levelState.undoDepth).toBe(0);
	});

	it('clears on empty space, unless Shift is held', () => {
		levelState.selectedIds = ['a'];
		applyLevelSelect({ id: null, additive: true });
		expect(levelState.selectedIds).toEqual(['a']);
		applyLevelSelect({ id: null });
		expect(levelState.selectedIds).toEqual([]);
	});

	it('picks a grouped solid with its whole group', () => {
		applyLevelSelect({ id: 'c' });
		expect(levelState.selectedIds).toEqual(['b', 'c']);
	});

	it('picks one member of a group on a double-click', () => {
		applyLevelSelect({ id: 'c', ungroup: true });
		expect(levelState.selectedIds).toEqual(['c']);
	});

	it('adds a Shift-clicked hit, and takes it out once it is wholly selected', () => {
		applyLevelSelect({ id: 'a' });
		applyLevelSelect({ id: 'b', additive: true });
		expect(levelState.selectedIds).toEqual(['a', 'b', 'c']);
		applyLevelSelect({ id: 'e', additive: true });
		expect(levelState.selectedIds).toEqual(['a', 'b', 'c', 'e']);
		applyLevelSelect({ id: 'c', additive: true });
		expect(levelState.selectedIds).toEqual(['a', 'e']);
		applyLevelSelect({ id: 'a', additive: true });
		expect(levelState.selectedIds).toEqual(['e']);
	});

	it('adds the rest of a group that is only partly selected', () => {
		applyLevelSelect({ id: 'b', ungroup: true });
		applyLevelSelect({ id: 'c', additive: true });
		expect(levelState.selectedIds).toEqual(['b', 'c']);
		applyLevelSelect({ id: 'b', additive: true, ungroup: true });
		expect(levelState.selectedIds).toEqual(['c']);
	});

	it('treats an id the document does not have as empty space', () => {
		levelState.selectedIds = ['a'];
		applyLevelSelect({ id: 'gone', additive: true });
		expect(levelState.selectedIds).toEqual(['a']);
		applyLevelSelect({ id: 'gone' });
		expect(levelState.selectedIds).toEqual([]);
	});
});

describe('applyLevelSelect: elements', () => {
	beforeEach(() => {
		setLevelElementMode('face');
	});

	it('replaces the elements and selects the solids that own them', () => {
		applyLevelSelect({ id: 'a', elements: [face('a', 2), face('b', 0)] });
		expect(levelState.selectedElements).toEqual([face('a', 2), face('b', 0)]);
		expect(levelState.selectedIds).toEqual(['a', 'b']);
		expect(lastSync()).toMatchObject({
			elementMode: 'face',
			elements: [face('a', 2), face('b', 0)],
			selectedIds: ['a', 'b'],
		});

		applyLevelSelect({ id: 'c', elements: [face('c', 1)] });
		expect(levelState.selectedElements).toEqual([face('c', 1)]);
		expect(levelState.selectedIds).toEqual(['c']);
	});

	it('toggles Shift-clicked elements across solids', () => {
		applyLevelSelect({ id: 'a', elements: [face('a', 2)] });
		applyLevelSelect({ id: 'b', elements: [face('b', 2)], additive: true });
		applyLevelSelect({ id: 'a', elements: [face('a', 3)], additive: true });
		expect(levelState.selectedElements).toEqual([face('a', 2), face('b', 2), face('a', 3)]);
		expect(levelState.selectedIds).toEqual(['a', 'b']);

		applyLevelSelect({ id: 'a', elements: [face('a', 2)], additive: true });
		expect(levelState.selectedElements).toEqual([face('b', 2), face('a', 3)]);
		expect(levelState.selectedIds).toEqual(['b', 'a']);
	});

	it('tells elements apart by solid, kind, and every plane', () => {
		setLevelElementMode('edge');
		const edge = (brushId: string, planes: number[]): LevelElementRef => ({
			brushId,
			kind: 'edge',
			planes,
		});
		applyLevelSelect({ id: 'a', elements: [edge('a', [0, 2])] });
		applyLevelSelect({ id: 'a', elements: [edge('a', [0, 3])], additive: true });
		applyLevelSelect({ id: 'b', elements: [edge('b', [0, 2])], additive: true });
		expect(levelState.selectedElements).toHaveLength(3);
		applyLevelSelect({ id: 'a', elements: [edge('a', [0, 2])], additive: true });
		expect(levelState.selectedElements).toEqual([edge('a', [0, 3]), edge('b', [0, 2])]);
	});

	it('clears on a click with no element, unless Shift is held', () => {
		applyLevelSelect({ id: 'a', elements: [face('a', 2)] });
		applyLevelSelect({ id: null, additive: true });
		expect(levelState.selectedElements).toEqual([face('a', 2)]);
		applyLevelSelect({ id: 'a', elements: [], additive: true });
		expect(levelState.selectedElements).toEqual([face('a', 2)]);

		applyLevelSelect({ id: 'a' });
		expect(levelState.selectedElements).toEqual([]);
		expect(levelState.selectedIds).toEqual([]);
		applyLevelSelect({ id: 'a', elements: [face('a', 2)] });
		applyLevelSelect({ id: null, elements: [] });
		expect(levelState.selectedElements).toEqual([]);
	});

	it('keeps only elements of the current kind on solids that exist', () => {
		applyLevelSelect({
			id: 'a',
			elements: [
				face('a', 2),
				{ brushId: 'a', kind: 'vertex', planes: [0, 2, 4] },
				face('gone', 1),
			],
		});
		expect(levelState.selectedElements).toEqual([face('a', 2)]);
		expect(levelState.selectedIds).toEqual(['a']);
	});
});

describe('selectLevelRow', () => {
	it('selects the row alone, ungrouped, and toggles it with Shift', () => {
		selectLevelRow('b');
		expect(levelState.selectedIds).toEqual(['b']);
		selectLevelRow('e', true);
		expect(levelState.selectedIds).toEqual(['b', 'e']);
		expect(levelState.activeLayer).toBe('entity');
		selectLevelRow('b', true);
		expect(levelState.selectedIds).toEqual(['e']);
	});

	it('leaves an element mode, since a row is a whole object', () => {
		setLevelElementMode('face');
		applyLevelSelect({ id: 'a', elements: [face('a', 2)] });
		selectLevelRow('c');
		expect(levelState.elementMode).toBe('object');
		expect(levelState.selectedElements).toEqual([]);
		expect(levelState.selectedIds).toEqual(['c']);
	});
});

describe('clearLevelSelection', () => {
	it('drops objects and elements, and reports whether anything was selected', () => {
		setLevelElementMode('face');
		applyLevelSelect({ id: 'a', elements: [face('a', 2)] });
		expect(clearLevelSelection()).toBe(true);
		expect(levelState.selectedIds).toEqual([]);
		expect(levelState.selectedElements).toEqual([]);
		expect(lastSync()?.elements).toEqual([]);
		expect(clearLevelSelection()).toBe(false);
	});

	it('does nothing while level mode is off', () => {
		levelState.selectedIds = ['a'];
		setLevelEditorActive(false);
		expect(clearLevelSelection()).toBe(false);
		expect(levelState.selectedIds).toEqual(['a']);
	});
});

describe('draw shape', () => {
	it('starts as the default box and rides on every sync', () => {
		expect(levelState.drawShape).toEqual(DEFAULT_DRAW_SHAPE);
		setLevelSectorTint(true);
		expect(lastSync()?.drawShape).toEqual(DEFAULT_DRAW_SHAPE);

		setLevelDrawShape('arch');
		expect(lastSync()?.drawShape).toEqual({ ...DEFAULT_DRAW_SHAPE, shape: 'arch' });
	});

	it('clamps the cylinder sides and arch segments to whole counts', () => {
		setLevelDrawSides(2);
		expect(levelState.drawShape.sides).toBe(3);
		setLevelDrawSides(100);
		expect(levelState.drawShape.sides).toBe(64);
		setLevelDrawSides(7.6);
		expect(levelState.drawShape.sides).toBe(8);

		setLevelDrawSegments(1);
		expect(levelState.drawShape.segments).toBe(2);
		setLevelDrawSegments(40);
		expect(levelState.drawShape.segments).toBe(32);
		setLevelDrawSegments(Number.NaN);
		expect(levelState.drawShape.segments).toBe(32);
	});

	it('keeps the arch thickness positive', () => {
		setLevelDrawThickness(0.5);
		expect(levelState.drawShape.thickness).toBe(0.5);
		setLevelDrawThickness(0);
		setLevelDrawThickness(-1);
		setLevelDrawThickness(Number.NaN);
		expect(levelState.drawShape.thickness).toBe(0.5);
	});

	it('wraps the turn, and turns a quarter at a time', () => {
		setLevelDrawTurn(5);
		expect(levelState.drawShape.turn).toBe(1);
		setLevelDrawTurn(-1);
		expect(levelState.drawShape.turn).toBe(3);
		turnLevelDrawShape();
		expect(levelState.drawShape.turn).toBe(0);
		turnLevelDrawShape();
		expect(levelState.drawShape.turn).toBe(1);
		expect(lastSync()?.drawShape?.turn).toBe(1);
	});

	it('is editor state, not an undo step', () => {
		setLevelDrawShape('wedge');
		turnLevelDrawShape();
		expect(levelState.undoDepth).toBe(0);
	});
});

describe('sectors', () => {
	it('hides and shows sectors and tints them in the sync, without an undo step', () => {
		toggleLevelSectorHidden('0:0');
		toggleLevelSectorHidden('-1:2');
		expect(lastSync()?.hiddenSectors).toEqual(['0:0', '-1:2']);
		toggleLevelSectorHidden('0:0');
		expect(levelState.hiddenSectors).toEqual(['-1:2']);

		expect(lastSync()?.showSectorTint).toBe(false);
		setLevelSectorTint(true);
		expect(lastSync()?.showSectorTint).toBe(true);
		expect(levelState.undoDepth).toBe(0);
	});
});

describe('level editing grid', () => {
	it('turns the grid on when editing starts, and leaves a later hide alone', () => {
		setLevelEditorActive(false);
		setGridVisible(false);
		setLevelEditorActive(true);
		expect(transformState.gridVisible).toBe(true);

		setGridVisible(false);
		expect(transformState.gridVisible).toBe(false);

		setLevelEditorActive(false);
		setLevelEditorActive(true);
		expect(transformState.gridVisible).toBe(true);
	});
});
