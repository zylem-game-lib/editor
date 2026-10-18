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
import type { LevelDocument } from '../../src/components/level/level-types';

beforeEach(() => {
	resetLevelEditor();
	resetLevelIds();
});

describe('applyLevelGesture', () => {
	it('draws a brush, rejects a vertex pushed inside, and clips the solid in two', () => {
		const drawn = applyLevelGesture(levelState.document, {
			kind: 'brush',
			min: { x: 0, y: 0, z: 0 },
			max: { x: 2, y: 1, z: 2 },
		});
		if (!drawn) throw new Error('expected a brush');
		expect(drawn.document.solids).toHaveLength(1);
		const id = drawn.document.solids[0]?.id;
		if (!id) throw new Error('expected a brush id');

		const inside = applyLevelGesture(drawn.document, {
			kind: 'vertex',
			brushId: id,
			vertexIndex: 0,
			position: { x: 1, y: 0.5, z: 1 },
		});
		expect(inside).toBeNull();

		const clipped = applyLevelGesture(drawn.document, {
			kind: 'clip',
			brushId: id,
			plane: { normal: { x: 1, y: 0, z: 0 }, distance: 1 },
		});
		expect(clipped?.document.solids).toHaveLength(2);
		expect(clipped?.selectIds).toHaveLength(2);
	});

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
		applyIncomingGesture({
			kind: 'brush',
			min: { x: 0, y: 0, z: 0 },
			max: { x: 1, y: 1, z: 1 },
		});
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
