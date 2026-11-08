import {
	boxBrush,
	brushBounds,
	DEFAULT_DRAW_SHAPE,
	frameForPlane,
	type LevelDocument,
	type LevelDrawShape,
	type LevelGesture,
} from '@zylem/bridge';
import { beforeEach, describe, expect, it } from 'vitest';

import { applyLevelGesture, resetLevelIds } from '../../src/components/level/level-document';
import {
	applyIncomingGesture,
	levelState,
	loadLevelDocument,
	resetLevelEditor,
	setLevelEditorActive,
	snapshotLevelDocument,
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
