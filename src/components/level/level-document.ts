/**
 * Edits to a level document.
 *
 * Pure: a document and a gesture in, the next document out. The live copy
 * stays in valtio. `null` means the gesture changed nothing — a vertex move
 * that broke the solid, a clip that missed, a delete of an unknown id.
 */

import type { BridgePose, BridgeVec3 } from '@zylem/bridge';
import {
	type BrushPlane,
	boxBrush,
	clipBrush,
	compileBrush,
	setBrushVertex,
	translateBrush,
} from './brush';
import type { EntityPlacement, LevelDocument, LevelGesture, LevelLayerId } from './level-types';

export interface LevelEdit {
	document: LevelDocument;
	selectIds: string[];
}

export function createLevelDocument(): LevelDocument {
	return { version: 2, solids: [], doodads: [], entities: [] };
}

export function cloneLevelDocument(document: LevelDocument): LevelDocument {
	return JSON.parse(JSON.stringify(document)) as LevelDocument;
}

/** Brushes that do not compile. The level panel lists these. */
export function invalidSolidIds(document: LevelDocument): string[] {
	return document.solids
		.filter((solid) => compileBrush(solid.planes) === null)
		.map((solid) => solid.id);
}

export function layerOf(document: LevelDocument, id: string): LevelLayerId | null {
	if (document.solids.some((solid) => solid.id === id)) return 'solid';
	if (document.doodads.some((doodad) => doodad.id === id)) return 'doodad';
	if (document.entities.some((entity) => entity.id === id)) return 'entity';
	return null;
}

let nextLevelId = 1;

export function createLevelId(): string {
	const id = `lvl-${nextLevelId.toString(36)}`;
	nextLevelId += 1;
	return id;
}

export function resetLevelIds(): void {
	nextLevelId = 1;
}

function samePoint(
	a: { x: number; y: number; z: number },
	b: { x: number; y: number; z: number }
): boolean {
	return Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.z - b.z) < 1e-4;
}

function sameSolid(a: readonly BrushPlane[], b: readonly BrushPlane[]): boolean {
	const left = compileBrush(a);
	const right = compileBrush(b);
	if (!left || !right || left.vertices.length !== right.vertices.length) return false;
	return left.vertices.every((vertex) => right.vertices.some((other) => samePoint(vertex, other)));
}

function movePose(pose: BridgePose, delta: BridgeVec3): BridgePose {
	const position = pose.position ?? { x: 0, y: 0, z: 0 };
	return {
		...pose,
		position: {
			x: position.x + delta.x,
			y: position.y + delta.y,
			z: position.z + delta.z,
		},
	};
}

function zeroDelta(delta: BridgeVec3): boolean {
	return delta.x === 0 && delta.y === 0 && delta.z === 0;
}

/**
 * Apply one finished gesture.
 *
 * @returns `null` when the document should stay as it is.
 */
export function applyLevelGesture(
	document: LevelDocument,
	gesture: LevelGesture,
	nextId: () => string = createLevelId,
	selectedIds: readonly string[] = []
): LevelEdit | null {
	switch (gesture.kind) {
		case 'brush':
			return addBrush(document, gesture.min, gesture.max, nextId);
		case 'clip':
			return clipSolid(document, gesture.brushId, gesture.plane, nextId);
		case 'vertex':
			return moveVertex(
				document,
				gesture.brushId,
				gesture.vertexIndex,
				gesture.position,
				selectedIds
			);
		case 'translate':
			return translateItem(document, gesture.id, gesture.layer, gesture.delta, selectedIds);
		case 'doodad':
			return addDoodad(document, gesture, nextId);
		case 'spawn':
			return addSpawn(document, gesture.pose, nextId);
		case 'trigger':
			return addTrigger(document, gesture.pose, gesture.size, nextId);
		case 'delete':
			return deleteItem(document, gesture.id, selectedIds);
	}
}

function addBrush(
	document: LevelDocument,
	min: BridgeVec3,
	max: BridgeVec3,
	nextId: () => string
): LevelEdit | null {
	const planes = boxBrush(min, max);
	if (!compileBrush(planes)) return null;
	const id = nextId();
	return {
		document: { ...document, solids: [...document.solids, { id, planes }] },
		selectIds: [id],
	};
}

function clipSolid(
	document: LevelDocument,
	brushId: string,
	plane: BrushPlane,
	nextId: () => string
): LevelEdit | null {
	const solid = document.solids.find((entry) => entry.id === brushId);
	if (!solid) return null;
	const sides = clipBrush(solid.planes, plane);
	const kept = sides[0];
	if (!kept) return null;
	if (sides.length === 1 && sameSolid(kept, solid.planes)) return null;

	const ids = sides.map((_, index) => (index === 0 ? solid.id : nextId()));
	const replacements = sides.flatMap((planes, index) => {
		const id = ids[index];
		return id ? [{ id, planes }] : [];
	});
	return {
		document: {
			...document,
			solids: document.solids.flatMap((entry) => (entry.id === brushId ? replacements : [entry])),
		},
		selectIds: ids,
	};
}

function moveVertex(
	document: LevelDocument,
	brushId: string,
	vertexIndex: number,
	position: BridgeVec3,
	selectedIds: readonly string[]
): LevelEdit | null {
	const solid = document.solids.find((entry) => entry.id === brushId);
	if (!solid) return null;
	const planes = setBrushVertex(solid.planes, vertexIndex, position);
	if (!planes) return null;
	return {
		document: {
			...document,
			solids: document.solids.map((entry) => (entry.id === brushId ? { ...entry, planes } : entry)),
		},
		selectIds: selectedIds.length > 0 ? [...selectedIds] : [brushId],
	};
}

function translateItem(
	document: LevelDocument,
	id: string,
	layer: LevelLayerId,
	delta: BridgeVec3,
	selectedIds: readonly string[]
): LevelEdit | null {
	if (zeroDelta(delta)) return null;
	if (layer === 'solid') {
		const solid = document.solids.find((entry) => entry.id === id);
		if (!solid) return null;
		return {
			document: {
				...document,
				solids: document.solids.map((entry) =>
					entry.id === id ? { ...entry, planes: translateBrush(entry.planes, delta) } : entry
				),
			},
			selectIds: selectedIds.length > 0 ? [...selectedIds] : [id],
		};
	}
	if (layer === 'doodad') {
		if (!document.doodads.some((entry) => entry.id === id)) return null;
		return {
			document: {
				...document,
				doodads: document.doodads.map((entry) =>
					entry.id === id ? { ...entry, pose: movePose(entry.pose, delta) } : entry
				),
			},
			selectIds: selectedIds.length > 0 ? [...selectedIds] : [id],
		};
	}
	if (!document.entities.some((entry) => entry.id === id)) return null;
	return {
		document: {
			...document,
			entities: document.entities.map((entry) =>
				entry.id === id ? { ...entry, pose: movePose(entry.pose, delta) } : entry
			),
		},
		selectIds: selectedIds.length > 0 ? [...selectedIds] : [id],
	};
}

function addDoodad(
	document: LevelDocument,
	gesture: Extract<LevelGesture, { kind: 'doodad' }>,
	nextId: () => string
): LevelEdit {
	const id = nextId();
	return {
		document: {
			...document,
			doodads: [
				...document.doodads,
				{ id, typeId: gesture.typeId, pose: gesture.pose, props: { ...(gesture.props ?? {}) } },
			],
		},
		selectIds: [id],
	};
}

function addSpawn(document: LevelDocument, pose: BridgePose, nextId: () => string): LevelEdit {
	const count = document.entities.filter((entity) => entity.typeId === 'spawn').length + 1;
	const entity: EntityPlacement = {
		id: nextId(),
		typeId: 'spawn',
		name: `spawn-${count}`,
		pose,
		props: { spawnKind: 'player', archetype: '' },
	};
	return {
		document: { ...document, entities: [...document.entities, entity] },
		selectIds: [entity.id],
	};
}

function addTrigger(
	document: LevelDocument,
	pose: BridgePose,
	size: BridgeVec3,
	nextId: () => string
): LevelEdit {
	const count = document.entities.filter((entity) => entity.typeId === 'zone').length + 1;
	const entity: EntityPlacement = {
		id: nextId(),
		typeId: 'zone',
		name: `trigger-${count}`,
		pose,
		props: { size: { x: size.x, y: size.y, z: size.z } },
	};
	return {
		document: { ...document, entities: [...document.entities, entity] },
		selectIds: [entity.id],
	};
}

function deleteItem(
	document: LevelDocument,
	id: string,
	selectedIds: readonly string[]
): LevelEdit | null {
	const solids = document.solids.filter((entry) => entry.id !== id);
	const doodads = document.doodads.filter((entry) => entry.id !== id);
	const entities = document.entities.filter((entry) => entry.id !== id);
	if (
		solids.length === document.solids.length &&
		doodads.length === document.doodads.length &&
		entities.length === document.entities.length
	) {
		return null;
	}
	return {
		document: { ...document, solids, doodads, entities },
		selectIds: selectedIds.filter((selected) => selected !== id),
	};
}

export interface EntityFieldPatch {
	name?: string;
	spawnKind?: string;
	archetype?: string;
	size?: BridgeVec3;
}

/** A copy of the entity with inspector fields written. The id is unchanged. */
export function withEntityFields(
	entity: EntityPlacement,
	patch: EntityFieldPatch
): EntityPlacement {
	const props = { ...entity.props };
	if (patch.spawnKind !== undefined) props.spawnKind = patch.spawnKind;
	if (patch.archetype !== undefined) props.archetype = patch.archetype;
	if (patch.size) props.size = { ...patch.size };
	return {
		...entity,
		name: patch.name ?? entity.name,
		props,
	};
}
