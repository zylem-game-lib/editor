import {
	type BrushSurface,
	boxBrush,
	brushBounds,
	compileBrush,
	createSurface,
	DEFAULT_DRAW_SHAPE,
	DEFAULT_SECTOR_SIZE,
	frameForPlane,
	type LevelDocument,
	type LevelDrawShape,
	type LevelElementRef,
	type LevelGesture,
	type LevelTexture,
} from '@zylem/bridge';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	addLevelTexture,
	applyLevelGesture,
	cloneLevelDocument,
	deleteObjects,
	duplicateObjects,
	facesOfSolids,
	paintFaces,
	removeLevelTexture,
	resetLevelIds,
	resizeSectors,
	subdivideSolids,
} from '../../src/components/level/level-document';
import {
	addLevelTextureEntry,
	applyIncomingGesture,
	deleteLevelSelection,
	duplicateLevelSelection,
	levelHasUnsavedChanges,
	levelState,
	loadLevelDocument,
	paintLevelSelection,
	redoLevel,
	removeLevelTextureEntry,
	resetLevelEditor,
	setLevelEditorActive,
	setLevelElementMode,
	setLevelSectorSize,
	setLevelSubdivideTile,
	snapshotLevelDocument,
	subdivideLevelSelection,
	undoLevel,
} from '../../src/components/level/level-state';

const GROUND = frameForPlane({ x: 0, y: 1, z: 0 }, 0);
const TOP = 2;
const RIGHT = 0;

beforeEach(() => {
	resetLevelEditor();
	resetLevelIds();
});

function drawShape(patch: Partial<LevelDrawShape> = {}): LevelDrawShape {
	return { ...DEFAULT_DRAW_SHAPE, ...patch };
}

/** A box drawn on the ground: x 0..2, y 0..1, z -2..0. */
function boxGesture(height = 1): LevelGesture {
	return {
		kind: 'primitive',
		frame: GROUND,
		footprint: { u0: 0, v0: 0, u1: 2, v1: 2 },
		height,
		shape: drawShape(),
	};
}

function withSolids(
	...solids: Array<{ id: string; min: [number, number, number]; max: [number, number, number] }>
): LevelDocument {
	return {
		version: 2,
		solids: solids.map(({ id, min, max }) => ({
			id,
			planes: boxBrush({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] }),
		})),
		doodads: [],
		entities: [],
	};
}

function boundsOf(document: LevelDocument, id: string) {
	const solid = document.solids.find((entry) => entry.id === id);
	if (!solid) throw new Error(`no solid ${id}`);
	const bounds = brushBounds(solid.planes);
	if (!bounds) throw new Error(`solid ${id} does not compile`);
	return bounds;
}

/** Ids `new-1`, `new-2`, ... in call order. */
function counter(): () => string {
	let count = 0;
	return () => {
		count += 1;
		return `new-${count}`;
	};
}

/** Solid `a` alone, `b` and `c` in group `arch`, doodad `d`, spawn `e`. */
function scene(): LevelDocument {
	const document = withSolids(
		{ id: 'a', min: [0, 0, 0], max: [1, 1, 1] },
		{ id: 'b', min: [4, 0, 0], max: [5, 1, 1] },
		{ id: 'c', min: [6, 0, 0], max: [7, 1, 1] }
	);
	document.solids = document.solids.map((solid) =>
		solid.id === 'a' ? solid : { ...solid, groupId: 'arch' }
	);
	document.doodads.push({
		id: 'd',
		typeId: 'box',
		pose: { position: { x: 1, y: 0, z: 0 } },
		props: { size: 1 },
	});
	document.entities.push({
		id: 'e',
		typeId: 'spawn',
		name: 'spawn-1',
		pose: { position: { x: 0, y: 1, z: 0 } },
		props: { spawnKind: 'player', archetype: '' },
	});
	return document;
}

describe('applyLevelGesture: primitives and clip', () => {
	it('bakes a drawn box into one selected solid', () => {
		const drawn = applyLevelGesture(levelState.document, boxGesture());
		if (!drawn) throw new Error('expected a box');
		expect(drawn.document.solids).toHaveLength(1);
		const id = drawn.document.solids[0]?.id;
		expect(drawn.selectIds).toEqual([id]);
		expect(drawn.document.solids[0]?.groupId).toBeUndefined();
		const bounds = boundsOf(drawn.document, id);
		expect(bounds.max.x).toBeCloseTo(2, 6);
		expect(bounds.max.y).toBeCloseTo(1, 6);
		expect(bounds.min.z).toBeCloseTo(-2, 6);
	});

	it('bakes an arch into grouped segments and rejects a flat primitive', () => {
		const arch = applyLevelGesture(levelState.document, {
			kind: 'primitive',
			frame: GROUND,
			footprint: { u0: 0, v0: 0, u1: 8, v1: 1 },
			height: 4,
			shape: drawShape({ shape: 'arch', segments: 6 }),
		});
		if (!arch) throw new Error('expected an arch');
		expect(arch.document.solids).toHaveLength(6);
		const groups = new Set(arch.document.solids.map((solid) => solid.groupId));
		expect(groups.size).toBe(1);
		expect([...groups][0]).toBeTruthy();
		expect(arch.selectIds).toHaveLength(6);

		expect(applyLevelGesture(levelState.document, boxGesture(0))).toBeNull();
	});

	it('clips every listed solid and selects all the pieces', () => {
		const document = withSolids(
			{ id: 'a', min: [0, 0, 0], max: [2, 1, 1] },
			{ id: 'b', min: [0, 0, 4], max: [2, 1, 5] }
		);
		const clipped = applyLevelGesture(document, {
			kind: 'clip',
			brushIds: ['a', 'b'],
			plane: { normal: { x: 1, y: 0, z: 0 }, distance: 1 },
		});
		expect(clipped?.document.solids).toHaveLength(4);
		expect(clipped?.selectIds).toHaveLength(4);
		expect(
			applyLevelGesture(document, {
				kind: 'clip',
				brushIds: ['a'],
				plane: { normal: { x: 1, y: 0, z: 0 }, distance: 10 },
			})
		).toBeNull();
	});

	it('keeps a clipped solid in its group', () => {
		const document = withSolids({ id: 'a', min: [0, 0, 0], max: [2, 1, 1] });
		document.solids = document.solids.map((solid) => ({ ...solid, groupId: 'g1' }));
		const clipped = applyLevelGesture(document, {
			kind: 'clip',
			brushIds: ['a'],
			plane: { normal: { x: 1, y: 0, z: 0 }, distance: 1 },
		});
		expect(clipped?.document.solids.map((solid) => solid.groupId)).toEqual(['g1', 'g1']);
	});
});

describe('applyLevelGesture: faces and elements', () => {
	const document = withSolids(
		{ id: 'a', min: [0, 0, 0], max: [1, 1, 1] },
		{ id: 'b', min: [3, 0, 0], max: [4, 1, 1] }
	);

	it('pushes faces on several solids and keeps them selected', () => {
		const faces = [
			{ brushId: 'a', kind: 'face' as const, planes: [TOP] },
			{ brushId: 'b', kind: 'face' as const, planes: [TOP] },
		];
		const pushed = applyLevelGesture(document, { kind: 'face-move', faces, distance: 2 });
		if (!pushed) throw new Error('expected a face move');
		expect(boundsOf(pushed.document, 'a').max.y).toBeCloseTo(3, 6);
		expect(boundsOf(pushed.document, 'b').max.y).toBeCloseTo(3, 6);
		expect(pushed.selectElements).toEqual(faces);
		expect(pushed.selectIds).toEqual(['a', 'b']);
	});

	it('rejects the whole push when one solid would collapse', () => {
		const flat = withSolids(
			{ id: 'a', min: [0, 0, 0], max: [1, 1, 1] },
			{ id: 'b', min: [3, 0, 0], max: [4, 3, 1] }
		);
		expect(
			applyLevelGesture(flat, {
				kind: 'face-move',
				faces: [
					{ brushId: 'a', kind: 'face', planes: [TOP] },
					{ brushId: 'b', kind: 'face', planes: [TOP] },
				],
				distance: -2,
			})
		).toBeNull();
	});

	it('extrudes a face into a new solid and selects its outer face', () => {
		const extruded = applyLevelGesture(
			document,
			{ kind: 'face-extrude', faces: [{ brushId: 'a', kind: 'face', planes: [TOP] }], distance: 2 },
			() => 'new'
		);
		if (!extruded) throw new Error('expected an extrusion');
		expect(extruded.document.solids.map((solid) => solid.id)).toEqual(['a', 'b', 'new']);
		const bounds = boundsOf(extruded.document, 'new');
		expect(bounds.min.y).toBeCloseTo(1, 6);
		expect(bounds.max.y).toBeCloseTo(3, 6);
		expect(extruded.selectIds).toEqual(['new']);
		expect(extruded.selectElements).toEqual([{ brushId: 'new', kind: 'face', planes: [0] }]);
	});

	it('lifts an edge and hands back the remapped edge', () => {
		const edge = { brushId: 'a', kind: 'edge' as const, planes: [RIGHT, TOP] };
		const lifted = applyLevelGesture(document, {
			kind: 'element-move',
			elements: [edge],
			delta: { x: 0, y: 1, z: 0 },
		});
		if (!lifted) throw new Error('expected an edge move');
		expect(boundsOf(lifted.document, 'a').max.y).toBeCloseTo(2, 6);
		expect(lifted.selectElements).toHaveLength(1);
		expect(lifted.selectElements?.[0]).toMatchObject({ brushId: 'a', kind: 'edge' });
	});

	it('rejects a vertex pushed inside its solid', () => {
		const corner = { brushId: 'a', kind: 'vertex' as const, planes: [0, 2, 4] };
		expect(
			applyLevelGesture(document, {
				kind: 'element-move',
				elements: [corner],
				delta: { x: -0.5, y: -0.5, z: -0.5 },
			})
		).toBeNull();
	});

	it('deletes a corner and refuses a face that would flatten the box', () => {
		const cut = applyLevelGesture(document, {
			kind: 'element-delete',
			elements: [{ brushId: 'a', kind: 'vertex', planes: [0, TOP, 4] }],
		});
		expect(cut?.selectIds).toEqual(['a']);
		expect(cut?.selectElements).toEqual([]);
		const vertices = compileBrush(cut!.document.solids[0]!.planes)!.vertices;
		expect(vertices).toHaveLength(7);
		expect(
			applyLevelGesture(document, {
				kind: 'element-delete',
				elements: [{ brushId: 'a', kind: 'face', planes: [TOP] }],
			})
		).toBeNull();
	});

	it('shears a face within its own plane', () => {
		const sheared = applyLevelGesture(document, {
			kind: 'shear',
			faces: [{ brushId: 'a', kind: 'face', planes: [TOP] }],
			delta: { x: 1, y: 4, z: 0 },
		});
		if (!sheared) throw new Error('expected a shear');
		const bounds = boundsOf(sheared.document, 'a');
		expect(bounds.max.y).toBeCloseTo(1, 6);
		expect(bounds.max.x).toBeCloseTo(2, 6);
		expect(sheared.selectElements).toHaveLength(1);
	});
});

describe('applyLevelGesture: transforms', () => {
	function mixed(): LevelDocument {
		const document = withSolids({ id: 'a', min: [0, 0, 0], max: [2, 1, 1] });
		document.doodads.push({
			id: 'd',
			typeId: 'box',
			pose: { position: { x: 1, y: 0, z: 0 } },
			props: {},
		});
		document.entities.push({
			id: 'z',
			typeId: 'zone',
			name: 'trigger-1',
			pose: { position: { x: 0, y: 0, z: 2 } },
			props: { size: { x: 2, y: 2, z: 2 } },
		});
		return document;
	}

	it('translates objects on every layer together', () => {
		const moved = applyLevelGesture(mixed(), {
			kind: 'transform',
			ids: ['a', 'd', 'z'],
			transform: { kind: 'translate', delta: { x: 1, y: 2, z: 3 } },
		});
		if (!moved) throw new Error('expected a move');
		expect(boundsOf(moved.document, 'a').min).toMatchObject({ x: 1, y: 2, z: 3 });
		expect(moved.document.doodads[0]?.pose.position).toEqual({ x: 2, y: 2, z: 3 });
		expect(moved.document.entities[0]?.pose.position).toEqual({ x: 1, y: 2, z: 5 });
		expect(moved.selectIds).toEqual(['a', 'd', 'z']);
	});

	it('rotates solids and poses about the pivot', () => {
		const turned = applyLevelGesture(mixed(), {
			kind: 'transform',
			ids: ['a', 'd'],
			transform: {
				kind: 'rotate',
				axis: { x: 0, y: 1, z: 0 },
				angle: Math.PI / 2,
				pivot: { x: 0, y: 0, z: 0 },
			},
		});
		if (!turned) throw new Error('expected a rotation');
		const bounds = boundsOf(turned.document, 'a');
		expect(bounds.min.z).toBeCloseTo(-2, 6);
		expect(bounds.max.x).toBeCloseTo(1, 6);
		const pose = turned.document.doodads[0]?.pose;
		expect(pose.position?.x).toBeCloseTo(0, 6);
		expect(pose.position?.z).toBeCloseTo(-1, 6);
		expect(pose.quaternion?.y).toBeCloseTo(Math.SQRT1_2, 6);
		expect(pose.quaternion?.w).toBeCloseTo(Math.SQRT1_2, 6);
		expect(pose.rotation?.y).toBeCloseTo(Math.PI / 2, 6);
	});

	it('scales solids, doodads, and trigger sizes about the pivot', () => {
		const scaled = applyLevelGesture(mixed(), {
			kind: 'transform',
			ids: ['a', 'd', 'z'],
			transform: { kind: 'scale', factor: { x: 2, y: 2, z: 2 }, pivot: { x: 0, y: 0, z: 0 } },
		});
		if (!scaled) throw new Error('expected a scale');
		expect(boundsOf(scaled.document, 'a').max.x).toBeCloseTo(4, 6);
		expect(scaled.document.doodads[0]?.pose.position).toEqual({ x: 2, y: 0, z: 0 });
		expect(scaled.document.doodads[0]?.pose.scale).toEqual({ x: 2, y: 2, z: 2 });
		expect(scaled.document.entities[0]?.props.size).toEqual({ x: 4, y: 4, z: 4 });
	});

	it('rejects a flattening scale and an empty selection', () => {
		expect(
			applyLevelGesture(mixed(), {
				kind: 'transform',
				ids: ['a'],
				transform: { kind: 'scale', factor: { x: 0, y: 1, z: 1 }, pivot: { x: 0, y: 0, z: 0 } },
			})
		).toBeNull();
		expect(
			applyLevelGesture(mixed(), {
				kind: 'transform',
				ids: ['missing'],
				transform: { kind: 'translate', delta: { x: 1, y: 0, z: 0 } },
			})
		).toBeNull();
	});
});

describe('applyLevelGesture: placements', () => {
	it('places a doodad without collision props, a spawn, and a named trigger', () => {
		const doodad = applyLevelGesture(levelState.document, {
			kind: 'doodad',
			typeId: 'box',
			pose: { position: { x: 1, y: 0, z: 0 } },
			props: { size: { x: 1, y: 1, z: 1 } },
		});
		if (!doodad) throw new Error('expected a doodad');
		expect(doodad.document.doodads[0]).toMatchObject({ typeId: 'box' });

		const spawn = applyLevelGesture(doodad.document, {
			kind: 'spawn',
			pose: { position: { x: 0, y: 1, z: 0 } },
		});
		expect(spawn?.document.entities[0]).toMatchObject({
			typeId: 'spawn',
			name: 'spawn-1',
			props: { spawnKind: 'player', archetype: '' },
		});

		if (!spawn) throw new Error('expected a spawn');
		const trigger = applyLevelGesture(spawn.document, {
			kind: 'trigger',
			pose: { position: { x: 3, y: 0, z: 0 } },
			size: { x: 4, y: 2, z: 4 },
		});
		expect(trigger?.document.entities[1]).toMatchObject({
			typeId: 'zone',
			name: 'trigger-1',
			props: { size: { x: 4, y: 2, z: 4 } },
		});
	});
});

describe('duplicateObjects', () => {
	const offset = { x: 2, y: 0, z: 0 };

	it('copies objects on every layer with new ids, offset, and selects the copies', () => {
		const copied = duplicateObjects(scene(), ['a', 'd', 'e'], offset, counter());
		if (!copied) throw new Error('expected a duplicate');
		expect(copied.document.solids.map((solid) => solid.id)).toEqual(['a', 'b', 'c', 'new-1']);
		expect(boundsOf(copied.document, 'new-1').min.x).toBeCloseTo(2, 6);
		expect(boundsOf(copied.document, 'a').min.x).toBeCloseTo(0, 6);
		expect(copied.document.solids[3]?.groupId).toBeUndefined();
		expect(copied.document.doodads[1]).toEqual({
			id: 'new-2',
			typeId: 'box',
			pose: { position: { x: 3, y: 0, z: 0 } },
			props: { size: 1 },
		});
		expect(copied.document.entities[1]).toMatchObject({
			id: 'new-3',
			typeId: 'spawn',
			pose: { position: { x: 2, y: 1, z: 0 } },
			props: { spawnKind: 'player', archetype: '' },
		});
		expect(copied.selectIds).toEqual(['new-1', 'new-2', 'new-3']);
		expect(copied.selectElements).toBeUndefined();
	});

	it('gives each copied group a fresh group shared by its copies', () => {
		const copied = duplicateObjects(scene(), ['b', 'c'], offset, counter());
		if (!copied) throw new Error('expected a duplicate');
		const copies = copied.document.solids.slice(3);
		expect(copies).toHaveLength(2);
		expect(copies[0]?.groupId).toBeTruthy();
		expect(copies[0]?.groupId).not.toBe('arch');
		expect(copies[1]?.groupId).toBe(copies[0]?.groupId);
		expect(copied.document.solids.slice(1, 3).map((solid) => solid.groupId)).toEqual([
			'arch',
			'arch',
		]);
		expect(copied.selectIds).toEqual(copies.map((solid) => solid.id));
	});

	it('does not share a group between copies made from different groups', () => {
		const document = scene();
		document.solids = document.solids.map((solid) =>
			solid.id === 'a' ? { ...solid, groupId: 'other' } : solid
		);
		const copied = duplicateObjects(document, ['a', 'b'], offset, counter());
		const groups = copied?.document.solids.slice(3).map((solid) => solid.groupId);
		expect(new Set(groups).size).toBe(2);
	});

	it('returns null with nothing to copy', () => {
		expect(duplicateObjects(scene(), ['missing'], offset)).toBeNull();
		expect(duplicateObjects(scene(), [], offset)).toBeNull();
	});
});

describe('subdivideSolids', () => {
	it('cuts each selected solid on the XZ grid and selects every piece', () => {
		const document = withSolids(
			{ id: 'a', min: [0, 0, 0], max: [8, 1, 8] },
			{ id: 'b', min: [9, 0, 1], max: [11, 1, 3] }
		);
		const cut = subdivideSolids(document, ['a', 'b'], 4, counter());
		if (!cut) throw new Error('expected a subdivision');
		expect(cut.document.solids.map((solid) => solid.id)).toEqual([
			'a',
			'new-1',
			'new-2',
			'new-3',
			'b',
		]);
		expect(cut.selectIds).toEqual(['a', 'new-1', 'new-2', 'new-3', 'b']);
		const first = boundsOf(cut.document, 'a');
		expect(first.max.x).toBeCloseTo(4, 6);
		expect(first.max.z).toBeCloseTo(4, 6);
		const last = boundsOf(cut.document, 'new-3');
		expect(last.min.x).toBeCloseTo(4, 6);
		expect(last.min.z).toBeCloseTo(4, 6);
		expect(boundsOf(cut.document, 'b').max.x).toBeCloseTo(11, 6);
	});

	it('keeps the group on every piece and leaves unselected solids alone', () => {
		const document = withSolids(
			{ id: 'a', min: [0, 0, 0], max: [8, 1, 1] },
			{ id: 'b', min: [0, 0, 4], max: [8, 1, 5] }
		);
		document.solids = document.solids.map((solid) => ({ ...solid, groupId: 'g1' }));
		const cut = subdivideSolids(document, ['a', 'missing-doodad'], 4, counter());
		expect(cut?.document.solids.map((solid) => [solid.id, solid.groupId])).toEqual([
			['a', 'g1'],
			['new-1', 'g1'],
			['b', 'g1'],
		]);
	});

	it('rejects the whole edit when one solid cannot be cut', () => {
		const document = withSolids(
			{ id: 'a', min: [0, 0, 0], max: [8, 1, 4] },
			{ id: 'big', min: [0, 0, 10], max: [20, 1, 30] },
			{ id: 'flat', min: [0, 0, 40], max: [8, 0, 44] }
		);
		expect(subdivideSolids(document, ['a', 'big'], 1)).toBeNull();
		expect(subdivideSolids(document, ['a', 'flat'], 4)).toBeNull();
		expect(subdivideSolids(document, ['a'], 0)).toBeNull();
	});

	it('returns null when no grid line crosses a selected solid', () => {
		const document = withSolids({ id: 'a', min: [0, 0, 0], max: [2, 1, 2] });
		expect(subdivideSolids(document, ['a'], 4)).toBeNull();
		expect(subdivideSolids(document, [], 4)).toBeNull();
	});
});

describe('deleteObjects', () => {
	it('removes every listed object from every layer and selects nothing', () => {
		const deleted = deleteObjects(scene(), ['a', 'c', 'd', 'e']);
		if (!deleted) throw new Error('expected a delete');
		expect(deleted.document.solids.map((solid) => solid.id)).toEqual(['b']);
		expect(deleted.document.doodads).toEqual([]);
		expect(deleted.document.entities).toEqual([]);
		expect(deleted.selectIds).toEqual([]);
	});

	it('returns null when nothing listed exists', () => {
		expect(deleteObjects(scene(), ['missing'])).toBeNull();
		expect(deleteObjects(scene(), [])).toBeNull();
	});
});

describe('resizeSectors', () => {
	const face: LevelElementRef = { brushId: 'a', kind: 'face', planes: [TOP] };

	it('writes the sector size, at least 1, and keeps the selection', () => {
		const resized = resizeSectors(scene(), 16, ['a'], [face]);
		expect(resized?.document.sectors).toEqual({ size: 16 });
		expect(resized?.selectIds).toEqual(['a']);
		expect(resized?.selectElements).toEqual([face]);
		expect(resizeSectors(scene(), 0.25)?.document.sectors).toEqual({ size: 1 });
	});

	it('returns null when the size would not change or is not a number', () => {
		expect(resizeSectors(scene(), DEFAULT_SECTOR_SIZE)).toBeNull();
		expect(resizeSectors({ ...scene(), sectors: { size: 16 } }, 16)).toBeNull();
		expect(resizeSectors(scene(), Number.NaN)).toBeNull();
		expect(resizeSectors(scene(), Number.POSITIVE_INFINITY)).toBeNull();
	});
});

describe('editor commands with undo', () => {
	beforeEach(() => {
		loadLevelDocument(scene());
		setLevelEditorActive(true);
	});

	it('duplicates the selection and undoes it', () => {
		levelState.selectedIds = ['b', 'c'];
		expect(duplicateLevelSelection({ x: 0.25, y: 0, z: 0 })).toBe(true);
		const copies = levelState.document.solids.slice(3);
		expect(copies).toHaveLength(2);
		expect(levelState.selectedIds).toEqual(copies.map((solid) => solid.id));
		expect(boundsOf(levelState.document, copies[0]?.id ?? '').min.x).toBeCloseTo(4.25, 6);
		expect(levelState.undoLabel).toBe('Duplicate');

		expect(undoLevel()).toBe(true);
		expect(levelState.document.solids).toHaveLength(3);
		expect(levelState.selectedIds).toEqual(['b', 'c']);
	});

	it('duplicates the solids that own the selected elements and switches to objects', () => {
		const face: LevelElementRef = { brushId: 'a', kind: 'face', planes: [TOP] };
		setLevelElementMode('face');
		levelState.selectedElements = [face];
		levelState.selectedIds = ['a'];

		expect(duplicateLevelSelection({ x: 1, y: 0, z: 0 })).toBe(true);
		expect(levelState.elementMode).toBe('object');
		expect(levelState.selectedElements).toEqual([]);
		expect(levelState.selectedIds).toEqual([levelState.document.solids[3]?.id]);

		expect(undoLevel()).toBe(true);
		expect(levelState.elementMode).toBe('face');
		expect(levelState.selectedElements).toEqual([face]);
		expect(levelState.selectedIds).toEqual(['a']);
	});

	it('subdivides at the tile size, selects the pieces, and undoes it', () => {
		loadLevelDocument(withSolids({ id: 'a', min: [0, 0, 0], max: [4, 1, 2] }));
		expect(levelState.subdivideTile).toBe(4);
		levelState.selectedIds = ['a'];
		expect(subdivideLevelSelection()).toBe(false);
		expect(levelState.undoDepth).toBe(0);

		setLevelSubdivideTile(2);
		expect(subdivideLevelSelection()).toBe(true);
		expect(levelState.document.solids).toHaveLength(2);
		expect(levelState.selectedIds).toEqual(levelState.document.solids.map((solid) => solid.id));
		expect(levelState.undoLabel).toBe('Subdivide');

		expect(undoLevel()).toBe(true);
		expect(levelState.document.solids.map((solid) => solid.id)).toEqual(['a']);
	});

	it('keeps the subdivide tile positive', () => {
		setLevelSubdivideTile(0);
		setLevelSubdivideTile(-2);
		setLevelSubdivideTile(Number.NaN);
		expect(levelState.subdivideTile).toBe(4);
	});

	it('deletes the whole selection in one step and undoes it', () => {
		levelState.selectedIds = ['a', 'd', 'e'];
		expect(deleteLevelSelection()).toBe(true);
		expect(levelState.document.solids.map((solid) => solid.id)).toEqual(['b', 'c']);
		expect(levelState.document.doodads).toEqual([]);
		expect(levelState.document.entities).toEqual([]);
		expect(levelState.selectedIds).toEqual([]);
		expect(levelState.undoDepth).toBe(1);

		expect(undoLevel()).toBe(true);
		expect(levelState.document.solids).toHaveLength(3);
		expect(levelState.document.doodads).toHaveLength(1);
		expect(levelState.selectedIds).toEqual(['a', 'd', 'e']);
	});

	it('sets the sector size as an undo step', () => {
		expect(setLevelSectorSize(8)).toBe(true);
		expect(levelState.document.sectors).toEqual({ size: 8 });
		expect(levelState.undoLabel).toBe('Sector size');
		expect(setLevelSectorSize(8)).toBe(false);
		expect(levelState.undoDepth).toBe(1);

		expect(undoLevel()).toBe(true);
		expect(levelState.document.sectors).toBeUndefined();
	});

	it('records nothing when a command has nothing to act on', () => {
		levelState.selectedIds = [];
		expect(duplicateLevelSelection({ x: 1, y: 0, z: 0 })).toBe(false);
		expect(subdivideLevelSelection()).toBe(false);
		expect(deleteLevelSelection()).toBe(false);
		expect(levelState.undoDepth).toBe(0);
	});
});

describe('level document undo', () => {
	it('records a gesture, undoes it, and round-trips a snapshot', () => {
		setLevelEditorActive(true);
		applyIncomingGesture(boxGesture());
		expect(levelState.document.solids).toHaveLength(1);

		const snapshot = snapshotLevelDocument();
		expect(snapshot.document).not.toBe(levelState.document);
		expect(snapshot.document.solids).toHaveLength(1);

		expect(undoLevel()).toBe(true);
		expect(levelState.document.solids).toEqual([]);

		const loaded: LevelDocument = {
			version: 2,
			solids: snapshot.document.solids,
			doodads: [],
			entities: [],
		};
		loadLevelDocument(loaded);
		expect(levelState.document.solids).toHaveLength(1);
		expect(levelState.undoDepth).toBe(0);
	});

	it('restores the element selection on undo', () => {
		loadLevelDocument(withSolids({ id: 'a', min: [0, 0, 0], max: [1, 1, 1] }));
		setLevelEditorActive(true);
		const face = { brushId: 'a', kind: 'face' as const, planes: [TOP] };
		levelState.selectedElements = [face];
		applyIncomingGesture({ kind: 'face-move', faces: [face], distance: 1 });
		expect(levelState.selectedElements).toEqual([face]);
		levelState.selectedElements = [];
		expect(undoLevel()).toBe(true);
		expect(levelState.selectedElements).toEqual([face]);
	});

	it('does not reseed from the stage when the mode is turned on again', () => {
		applyIncomingGesture({
			kind: 'spawn',
			pose: { position: { x: 0, y: 0, z: 0 } },
		});
		expect(levelState.document.entities).toEqual([]);

		setLevelEditorActive(true);
		applyIncomingGesture({
			kind: 'spawn',
			pose: { position: { x: 2, y: 0, z: 0 } },
		});
		setLevelEditorActive(false);
		setLevelEditorActive(true);
		expect(levelState.document.entities).toHaveLength(1);
		expect(levelState.document.entities[0]?.pose.position).toEqual({ x: 2, y: 0, z: 0 });
	});
});

const BRICK: BrushSurface = { ...createSurface('builtin:brick'), scale: { u: 2, v: 2 } };
const PHOTO: LevelTexture = {
	id: 'tex-1',
	name: 'Moss',
	dataUrl: 'data:image/png;base64,AAAA',
	width: 64,
	height: 32,
};

function faceOf(brushId: string, plane: number): LevelElementRef {
	return { brushId, kind: 'face', planes: [plane] };
}

function surfacesOf(document: LevelDocument, id: string): Array<string | null> {
	const solid = document.solids.find((entry) => entry.id === id);
	return (solid?.planes ?? []).map((plane) => plane.surface?.textureId ?? null);
}

describe('applyLevelGesture: paint', () => {
	it('lays the surface on the named faces and leaves the shape and the selection alone', () => {
		const selected = [faceOf('b', RIGHT)];
		const edit = applyLevelGesture(
			scene(),
			{ kind: 'paint', faces: [faceOf('a', TOP), faceOf('b', TOP)], surface: BRICK },
			counter(),
			['b'],
			selected
		);
		expect(surfacesOf(edit?.document ?? scene(), 'a')).toEqual([
			null,
			null,
			'builtin:brick',
			null,
			null,
			null,
		]);
		expect(edit?.document.solids[1]?.planes[TOP]?.surface).toEqual(BRICK);
		expect(surfacesOf(edit?.document ?? scene(), 'c')).toEqual(Array(6).fill(null));
		expect(boundsOf(edit?.document ?? scene(), 'a')).toEqual(boundsOf(scene(), 'a'));
		expect(edit?.selectIds).toEqual(['b']);
		expect(edit?.selectElements).toEqual(selected);
	});

	it('gives every face its own copy of the surface', () => {
		const edit = paintFaces(scene(), [faceOf('a', TOP), faceOf('a', RIGHT)], BRICK);
		const [right, , top] = edit?.document.solids[0]?.planes ?? [];
		expect(top?.surface).toEqual(BRICK);
		expect(top?.surface).not.toBe(BRICK);
		expect(top?.surface).not.toBe(right?.surface);
	});

	it('takes a texture off with no surface', () => {
		const painted = paintFaces(scene(), facesOfSolids(scene(), ['a']), BRICK)?.document;
		if (!painted) throw new Error('nothing was painted');
		const cleared = paintFaces(painted, [faceOf('a', TOP)], null);
		expect(surfacesOf(cleared?.document ?? painted, 'a')).toEqual([
			'builtin:brick',
			'builtin:brick',
			null,
			'builtin:brick',
			'builtin:brick',
			'builtin:brick',
		]);
		expect(cleared?.document.solids[0]?.planes[TOP]).not.toHaveProperty('surface');
	});

	it('changes nothing when every face already looks that way', () => {
		const painted = paintFaces(scene(), [faceOf('a', TOP)], BRICK)?.document;
		if (!painted) throw new Error('nothing was painted');
		expect(paintFaces(painted, [faceOf('a', TOP)], { ...BRICK })).toBeNull();
		expect(paintFaces(scene(), [faceOf('a', TOP)], null)).toBeNull();
		expect(paintFaces(scene(), [faceOf('gone', TOP)], BRICK)).toBeNull();
		expect(paintFaces(scene(), [{ brushId: 'a', kind: 'edge', planes: [0, 2] }], BRICK)).toBeNull();
		expect(paintFaces(scene(), [], BRICK)).toBeNull();
	});

	it('repaints a face whose tiling differs', () => {
		const painted = paintFaces(scene(), [faceOf('a', TOP)], BRICK)?.document;
		if (!painted) throw new Error('nothing was painted');
		const turned = paintFaces(painted, [faceOf('a', TOP)], { ...BRICK, rotation: 1 });
		expect(turned?.document.solids[0]?.planes[TOP]?.surface?.rotation).toBe(1);
	});

	it('keeps a painted face through a move and a duplicate', () => {
		const painted = paintFaces(scene(), [faceOf('a', TOP)], BRICK)?.document;
		if (!painted) throw new Error('nothing was painted');
		const moved = applyLevelGesture(painted, {
			kind: 'transform',
			ids: ['a'],
			transform: { kind: 'translate', delta: { x: 3, y: 0, z: 0 } },
		});
		expect(moved?.document.solids[0]?.planes[TOP]?.surface).toEqual(BRICK);
		const copied = duplicateObjects(painted, ['a'], { x: 1, y: 0, z: 0 }, counter());
		expect(surfacesOf(copied?.document ?? painted, 'new-1')[TOP]).toBe('builtin:brick');
	});
});

describe('facesOfSolids', () => {
	it('names every face of the listed solids', () => {
		expect(facesOfSolids(scene(), ['a', 'd', 'gone'])).toEqual(
			[0, 1, 2, 3, 4, 5].map((plane) => faceOf('a', plane))
		);
	});
});

describe('level textures', () => {
	it('adds an image to the library, replacing one with the same id', () => {
		const added = addLevelTexture(scene(), PHOTO);
		expect(added.textures).toEqual([PHOTO]);
		expect(scene().textures).toBeUndefined();
		const replaced = addLevelTexture(added, { ...PHOTO, name: 'Lichen' });
		expect(replaced.textures?.map((texture) => texture.name)).toEqual(['Lichen']);
	});

	it('removes an image and takes it off every face showing it', () => {
		const withPhoto = addLevelTexture(scene(), PHOTO);
		const photo = createSurface(PHOTO.id);
		const painted = paintFaces(
			paintFaces(withPhoto, [faceOf('a', TOP), faceOf('b', RIGHT)], photo)?.document ?? withPhoto,
			[faceOf('a', RIGHT)],
			BRICK
		)?.document;
		if (!painted) throw new Error('nothing was painted');

		const removed = removeLevelTexture(painted, PHOTO.id);
		expect(removed?.textures).toEqual([]);
		expect(surfacesOf(removed ?? painted, 'a')).toEqual([
			'builtin:brick',
			null,
			null,
			null,
			null,
			null,
		]);
		expect(surfacesOf(removed ?? painted, 'b')).toEqual(Array(6).fill(null));
		// A solid nothing was taken off is the same object.
		expect(removed?.solids[2]).toBe(painted.solids[2]);
	});

	it('changes nothing for an image the level does not have', () => {
		expect(removeLevelTexture(scene(), 'tex-9')).toBeNull();
		expect(removeLevelTexture(addLevelTexture(scene(), PHOTO), 'builtin:brick')).toBeNull();
	});
});

describe('cloneLevelDocument', () => {
	it('copies everything but shares nothing that can be edited', () => {
		const document = addLevelTexture(
			paintFaces(scene(), [faceOf('a', TOP)], BRICK)?.document ?? scene(),
			PHOTO
		);
		const copy = cloneLevelDocument(document);
		expect(JSON.stringify(copy)).toBe(JSON.stringify(document));
		expect(copy.textures).toEqual([PHOTO]);
		expect(copy.solids[0]?.planes[TOP]?.surface).not.toBe(document.solids[0]?.planes[TOP]?.surface);
		expect(copy.textures?.[0]).not.toBe(document.textures?.[0]);
	});

	it('keeps the keys in order, so a copy reads the same as JSON', () => {
		const document: LevelDocument = { ...scene(), textures: [PHOTO], sectors: { size: 8 } };
		expect(Object.keys(cloneLevelDocument(document))).toEqual(Object.keys(document));
	});
});

describe('painting with undo', () => {
	beforeEach(() => {
		loadLevelDocument(scene());
		setLevelEditorActive(true);
	});

	it('paints from a gesture as one step and keeps the selection', () => {
		levelState.selectedIds = ['b', 'c'];
		expect(
			applyIncomingGesture({
				kind: 'paint',
				faces: [faceOf('a', TOP), faceOf('a', RIGHT), faceOf('b', TOP)],
				surface: BRICK,
			})
		).toBe(true);
		expect(surfacesOf(levelState.document, 'a')[TOP]).toBe('builtin:brick');
		expect(levelState.undoLabel).toBe('Paint texture');
		expect(levelState.undoDepth).toBe(1);
		expect(levelState.selectedIds).toEqual(['b', 'c']);

		expect(undoLevel()).toBe(true);
		expect(surfacesOf(levelState.document, 'a')).toEqual(Array(6).fill(null));
		expect(surfacesOf(levelState.document, 'b')).toEqual(Array(6).fill(null));
		expect(redoLevel()).toBe(true);
		expect(surfacesOf(levelState.document, 'b')[TOP]).toBe('builtin:brick');
	});

	it('labels an erasing stroke, and records nothing for a stroke that changes nothing', () => {
		applyIncomingGesture({ kind: 'paint', faces: [faceOf('a', TOP)], surface: BRICK });
		expect(applyIncomingGesture({ kind: 'paint', faces: [faceOf('a', TOP)], surface: BRICK })).toBe(
			false
		);
		expect(levelState.undoDepth).toBe(1);

		expect(applyIncomingGesture({ kind: 'paint', faces: [faceOf('a', TOP)], surface: null })).toBe(
			true
		);
		expect(levelState.undoLabel).toBe('Clear texture');
	});

	it('paints the selected solids whole, or only the selected faces in face mode', () => {
		levelState.selectedIds = ['a'];
		expect(paintLevelSelection(BRICK)).toBe(true);
		expect(surfacesOf(levelState.document, 'a')).toEqual(Array(6).fill('builtin:brick'));
		expect(levelState.selectedIds).toEqual(['a']);

		setLevelElementMode('face');
		levelState.selectedIds = ['b'];
		levelState.selectedElements = [faceOf('b', TOP)];
		expect(paintLevelSelection(BRICK)).toBe(true);
		expect(surfacesOf(levelState.document, 'b')).toEqual([
			null,
			null,
			'builtin:brick',
			null,
			null,
			null,
		]);
		expect(levelState.selectedElements).toEqual([faceOf('b', TOP)]);

		expect(paintLevelSelection(null)).toBe(true);
		expect(levelState.undoLabel).toBe('Clear texture');
		expect(surfacesOf(levelState.document, 'b')).toEqual(Array(6).fill(null));
	});

	it('paints nothing with nothing selected', () => {
		expect(paintLevelSelection(BRICK)).toBe(false);
		levelState.selectedIds = ['d'];
		expect(paintLevelSelection(BRICK)).toBe(false);
		expect(levelState.undoDepth).toBe(0);
	});

	it('adds and removes a library image as undo steps', () => {
		addLevelTextureEntry(PHOTO);
		expect(levelState.document.textures).toEqual([PHOTO]);
		expect(levelState.undoLabel).toBe('Add texture');
		expect(levelHasUnsavedChanges()).toBe(true);

		levelState.selectedIds = ['a'];
		paintLevelSelection(createSurface(PHOTO.id));
		expect(removeLevelTextureEntry(PHOTO.id)).toBe(true);
		expect(levelState.undoLabel).toBe('Remove texture');
		expect(levelState.document.textures).toEqual([]);
		expect(surfacesOf(levelState.document, 'a')).toEqual(Array(6).fill(null));
		expect(levelState.selectedIds).toEqual(['a']);
		expect(removeLevelTextureEntry(PHOTO.id)).toBe(false);

		expect(undoLevel()).toBe(true);
		expect(levelState.document.textures).toEqual([PHOTO]);
		expect(surfacesOf(levelState.document, 'a')).toEqual(Array(6).fill(PHOTO.id));

		undoLevel();
		undoLevel();
		expect(levelState.document.textures).toBeUndefined();
		expect(levelHasUnsavedChanges()).toBe(false);
	});
});
