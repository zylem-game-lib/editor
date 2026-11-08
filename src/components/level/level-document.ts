/**
 * Edits to a level document.
 *
 * Pure: a document and a gesture or editor command in, the next document out.
 * The live copy stays in valtio. `null` means the edit changed nothing: an
 * edit that would leave a solid non-convex or empty, a clip that missed, a
 * delete of an unknown id. An edit that touches several solids is all or
 * nothing. Brush math comes from the `@zylem/bridge` kernel.
 */

import {
	type BridgePose,
	type BridgeQuat,
	type BridgeVec3,
	type BrushPlane,
	type BrushSolid,
	clipBrush,
	type EntityPlacement,
	extrudeFace,
	type LevelDocument,
	type LevelElementRef,
	type LevelGesture,
	type LevelLayerId,
	type LevelTransform,
	MAX_SUBDIVIDE_PIECES,
	moveElements,
	moveFaces,
	primitiveBrushes,
	rotateBrush,
	scaleBrush,
	sectorSizeOf,
	shearFaces,
	subdivideBrush,
	translateBrush,
} from '@zylem/bridge';

export interface LevelEdit {
	document: LevelDocument;
	selectIds: string[];
	/** Elements to select after the edit. Absent clears the element selection. */
	selectElements?: LevelElementRef[];
}

export function createLevelDocument(): LevelDocument {
	return { version: 2, solids: [], doodads: [], entities: [] };
}

export function cloneLevelDocument(document: LevelDocument): LevelDocument {
	return JSON.parse(JSON.stringify(document)) as LevelDocument;
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

const ZERO: BridgeVec3 = { x: 0, y: 0, z: 0 };
const ONE: BridgeVec3 = { x: 1, y: 1, z: 1 };

function add(a: BridgeVec3, b: BridgeVec3): BridgeVec3 {
	return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: BridgeVec3, b: BridgeVec3): BridgeVec3 {
	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function mul(a: BridgeVec3, b: BridgeVec3): BridgeVec3 {
	return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

function zeroDelta(delta: BridgeVec3): boolean {
	return delta.x === 0 && delta.y === 0 && delta.z === 0;
}

function quatFromAxisAngle(axis: BridgeVec3, angle: number): BridgeQuat {
	const length = Math.hypot(axis.x, axis.y, axis.z) || 1;
	const s = Math.sin(angle / 2) / length;
	return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };
}

/** XYZ order, matching Three.js. */
function quatFromEuler(euler: BridgeVec3): BridgeQuat {
	const c1 = Math.cos(euler.x / 2);
	const c2 = Math.cos(euler.y / 2);
	const c3 = Math.cos(euler.z / 2);
	const s1 = Math.sin(euler.x / 2);
	const s2 = Math.sin(euler.y / 2);
	const s3 = Math.sin(euler.z / 2);
	return {
		x: s1 * c2 * c3 + c1 * s2 * s3,
		y: c1 * s2 * c3 - s1 * c2 * s3,
		z: c1 * c2 * s3 + s1 * s2 * c3,
		w: c1 * c2 * c3 - s1 * s2 * s3,
	};
}

/** XYZ order, matching Three.js. */
function eulerFromQuat(q: BridgeQuat): BridgeVec3 {
	const m11 = 1 - 2 * (q.y * q.y + q.z * q.z);
	const m12 = 2 * (q.x * q.y - q.w * q.z);
	const m13 = 2 * (q.x * q.z + q.w * q.y);
	const m22 = 1 - 2 * (q.x * q.x + q.z * q.z);
	const m23 = 2 * (q.y * q.z - q.w * q.x);
	const m32 = 2 * (q.y * q.z + q.w * q.x);
	const m33 = 1 - 2 * (q.x * q.x + q.y * q.y);
	const y = Math.asin(Math.min(1, Math.max(-1, m13)));
	if (Math.abs(m13) < 0.9999999) {
		return { x: Math.atan2(-m23, m33), y, z: Math.atan2(-m12, m11) };
	}
	return { x: Math.atan2(m32, m22), y, z: 0 };
}

function multiplyQuat(a: BridgeQuat, b: BridgeQuat): BridgeQuat {
	return {
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
	};
}

function rotateByQuat(v: BridgeVec3, q: BridgeQuat): BridgeVec3 {
	const ix = q.w * v.x + q.y * v.z - q.z * v.y;
	const iy = q.w * v.y + q.z * v.x - q.x * v.z;
	const iz = q.w * v.z + q.x * v.y - q.y * v.x;
	const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
	return {
		x: ix * q.w - iw * q.x - iy * q.z + iz * q.y,
		y: iy * q.w - iw * q.y - iz * q.x + ix * q.z,
		z: iz * q.w - iw * q.z - ix * q.y + iy * q.x,
	};
}

function sizeOf(props: Record<string, unknown>): BridgeVec3 {
	const size = props.size as Partial<BridgeVec3> | undefined;
	return { x: size?.x ?? 2, y: size?.y ?? 2, z: size?.z ?? 2 };
}

function copyRef(ref: LevelElementRef): LevelElementRef {
	return { brushId: ref.brushId, kind: ref.kind, planes: [...ref.planes] };
}

function solidById(document: LevelDocument, id: string): BrushSolid | undefined {
	return document.solids.find((solid) => solid.id === id);
}

/** Refs grouped by solid, in first-seen order. */
function refsByBrush(
	refs: readonly LevelElementRef[],
	kind?: LevelElementRef['kind']
): Map<string, LevelElementRef[]> {
	const byBrush = new Map<string, LevelElementRef[]>();
	for (const ref of refs) {
		if (kind && ref.kind !== kind) continue;
		const list = byBrush.get(ref.brushId);
		if (list) list.push(ref);
		else byBrush.set(ref.brushId, [ref]);
	}
	return byBrush;
}

function withPlanes(
	document: LevelDocument,
	planesById: ReadonlyMap<string, BrushPlane[]>
): LevelDocument {
	return {
		...document,
		solids: document.solids.map((solid) => {
			const planes = planesById.get(solid.id);
			return planes ? { ...solid, planes } : solid;
		}),
	};
}

function samePlanes(a: readonly BrushPlane[], b: readonly BrushPlane[]): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
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
		case 'primitive':
			return addPrimitive(document, gesture, nextId);
		case 'clip':
			return clipSolids(document, gesture.brushIds, gesture.plane, nextId);
		case 'face-move':
			return moveSolidFaces(document, gesture.faces, gesture.distance);
		case 'face-extrude':
			return extrudeSolidFaces(document, gesture.faces, gesture.distance, nextId);
		case 'element-move':
			return moveSolidElements(document, gesture.elements, gesture.delta);
		case 'shear':
			return shearSolidFaces(document, gesture.faces, gesture.delta);
		case 'transform':
			return transformObjects(document, gesture.ids, gesture.transform);
		case 'doodad':
			return addDoodad(document, gesture, nextId);
		case 'spawn':
			return addSpawn(document, gesture.pose, nextId);
		case 'trigger':
			return addTrigger(document, gesture.pose, gesture.size, nextId);
		case 'delete':
			return deleteItem(document, gesture.id, selectedIds);
		default:
			return null;
	}
}

/** Bake a drawn primitive. Several brushes (an arch) share a new group. */
function addPrimitive(
	document: LevelDocument,
	gesture: Extract<LevelGesture, { kind: 'primitive' }>,
	nextId: () => string
): LevelEdit | null {
	const brushes = primitiveBrushes(
		gesture.shape.shape,
		gesture.frame,
		gesture.footprint,
		gesture.height,
		gesture.shape
	);
	if (!brushes || brushes.length === 0) return null;
	const groupId = brushes.length > 1 ? `group-${nextId()}` : undefined;
	const solids: BrushSolid[] = brushes.map((planes) => ({
		id: nextId(),
		planes,
		...(groupId ? { groupId } : {}),
	}));
	return {
		document: { ...document, solids: [...document.solids, ...solids] },
		selectIds: solids.map((solid) => solid.id),
	};
}

/** Split each listed solid. Pieces keep the solid's group; a solid the plane misses stays whole. */
function clipSolids(
	document: LevelDocument,
	brushIds: readonly string[],
	plane: BrushPlane,
	nextId: () => string
): LevelEdit | null {
	const targets = new Set(brushIds);
	const pieces = new Map<string, BrushSolid[]>();
	const selectIds: string[] = [];
	for (const solid of document.solids) {
		if (!targets.has(solid.id)) continue;
		const sides = clipBrush(solid.planes, plane);
		if (sides.length < 2) {
			selectIds.push(solid.id);
			continue;
		}
		const split = sides.map((planes, index) => ({
			id: index === 0 ? solid.id : nextId(),
			planes,
			...(solid.groupId ? { groupId: solid.groupId } : {}),
		}));
		pieces.set(solid.id, split);
		selectIds.push(...split.map((piece) => piece.id));
	}
	if (pieces.size === 0) return null;
	return {
		document: {
			...document,
			solids: document.solids.flatMap((solid) => pieces.get(solid.id) ?? [solid]),
		},
		selectIds,
	};
}

function moveSolidFaces(
	document: LevelDocument,
	faces: readonly LevelElementRef[],
	distance: number
): LevelEdit | null {
	if (!Number.isFinite(distance) || distance === 0) return null;
	const byBrush = refsByBrush(faces, 'face');
	if (byBrush.size === 0) return null;
	const next = new Map<string, BrushPlane[]>();
	for (const [brushId, refs] of byBrush) {
		const solid = solidById(document, brushId);
		const planes = solid
			? moveFaces(
					solid.planes,
					refs.map((ref) => ref.planes[0] ?? -1),
					distance
				)
			: null;
		if (!planes) return null;
		next.set(brushId, planes);
	}
	return {
		document: withPlanes(document, next),
		selectIds: [...byBrush.keys()],
		selectElements: [...byBrush.values()].flat().map(copyRef),
	};
}

/** Each face becomes a new solid. The new solids' outer faces end up selected, so another drag keeps going. */
function extrudeSolidFaces(
	document: LevelDocument,
	faces: readonly LevelElementRef[],
	distance: number,
	nextId: () => string
): LevelEdit | null {
	const created: BrushSolid[] = [];
	for (const ref of faces) {
		if (ref.kind !== 'face') continue;
		const solid = solidById(document, ref.brushId);
		const planes = solid ? extrudeFace(solid.planes, ref.planes[0] ?? -1, distance) : null;
		if (!planes) return null;
		created.push({ id: nextId(), planes });
	}
	if (created.length === 0) return null;
	return {
		document: { ...document, solids: [...document.solids, ...created] },
		selectIds: created.map((solid) => solid.id),
		selectElements: created.map((solid) => ({ brushId: solid.id, kind: 'face', planes: [0] })),
	};
}

function moveSolidElements(
	document: LevelDocument,
	elements: readonly LevelElementRef[],
	delta: BridgeVec3
): LevelEdit | null {
	if (zeroDelta(delta)) return null;
	const byBrush = refsByBrush(elements);
	if (byBrush.size === 0) return null;
	const next = new Map<string, BrushPlane[]>();
	const selectElements: LevelElementRef[] = [];
	for (const [brushId, refs] of byBrush) {
		const solid = solidById(document, brushId);
		const moved = solid
			? moveElements(
					solid.planes,
					refs.map((ref) => ({ kind: ref.kind, planes: ref.planes })),
					delta
				)
			: null;
		if (!moved) return null;
		next.set(brushId, moved.planes);
		selectElements.push(
			...moved.keys.map((key) => ({ brushId, kind: key.kind, planes: [...key.planes] }))
		);
	}
	return { document: withPlanes(document, next), selectIds: [...byBrush.keys()], selectElements };
}

function shearSolidFaces(
	document: LevelDocument,
	faces: readonly LevelElementRef[],
	delta: BridgeVec3
): LevelEdit | null {
	if (zeroDelta(delta)) return null;
	const byBrush = refsByBrush(faces, 'face');
	if (byBrush.size === 0) return null;
	const next = new Map<string, BrushPlane[]>();
	const selectElements: LevelElementRef[] = [];
	let changed = false;
	for (const [brushId, refs] of byBrush) {
		const solid = solidById(document, brushId);
		const sheared = solid
			? shearFaces(
					solid.planes,
					refs.map((ref) => ref.planes[0] ?? -1),
					delta
				)
			: null;
		if (!solid || !sheared) return null;
		if (!samePlanes(sheared.planes, solid.planes)) changed = true;
		next.set(brushId, sheared.planes);
		selectElements.push(
			...sheared.keys.map((key) => ({ brushId, kind: key.kind, planes: [...key.planes] }))
		);
	}
	if (!changed) return null;
	return { document: withPlanes(document, next), selectIds: [...byBrush.keys()], selectElements };
}

function isIdentity(transform: LevelTransform): boolean {
	switch (transform.kind) {
		case 'translate':
			return zeroDelta(transform.delta);
		case 'rotate':
			return transform.angle === 0;
		case 'scale':
			return transform.factor.x === 1 && transform.factor.y === 1 && transform.factor.z === 1;
	}
}

function transformPlanes(
	planes: readonly BrushPlane[],
	transform: LevelTransform
): BrushPlane[] | null {
	switch (transform.kind) {
		case 'translate':
			return translateBrush(planes, transform.delta);
		case 'rotate':
			return rotateBrush(planes, transform.axis, transform.angle, transform.pivot);
		case 'scale':
			return scaleBrush(planes, transform.factor, transform.pivot);
	}
}

function transformPose(pose: BridgePose, transform: LevelTransform): BridgePose {
	const position = pose.position ?? ZERO;
	switch (transform.kind) {
		case 'translate':
			return { ...pose, position: add(position, transform.delta) };
		case 'rotate': {
			const turn = quatFromAxisAngle(transform.axis, transform.angle);
			const quaternion = multiplyQuat(
				turn,
				pose.quaternion ?? quatFromEuler(pose.rotation ?? ZERO)
			);
			return {
				...pose,
				position: add(transform.pivot, rotateByQuat(sub(position, transform.pivot), turn)),
				quaternion,
				rotation: eulerFromQuat(quaternion),
			};
		}
		case 'scale':
			return {
				...pose,
				position: add(transform.pivot, mul(sub(position, transform.pivot), transform.factor)),
				scale: mul(pose.scale ?? ONE, transform.factor),
			};
	}
}

/** Markers do not scale; a trigger scales its size instead. */
function transformEntity(entity: EntityPlacement, transform: LevelTransform): EntityPlacement {
	if (transform.kind !== 'scale') return { ...entity, pose: transformPose(entity.pose, transform) };
	const position = entity.pose.position ?? ZERO;
	const pose = {
		...entity.pose,
		position: add(transform.pivot, mul(sub(position, transform.pivot), transform.factor)),
	};
	if (entity.typeId !== 'zone') return { ...entity, pose };
	return {
		...entity,
		pose,
		props: { ...entity.props, size: mul(sizeOf(entity.props), transform.factor) },
	};
}

/** Transform objects on any layer together. A solid that would not compile rejects the whole edit. */
function transformObjects(
	document: LevelDocument,
	ids: readonly string[],
	transform: LevelTransform
): LevelEdit | null {
	if (isIdentity(transform)) return null;
	if (transform.kind === 'scale') {
		const { x, y, z } = transform.factor;
		if (!(x > 0 && y > 0 && z > 0)) return null;
	}
	const wanted = new Set(ids);
	const selectIds = [...wanted].filter((id) => layerOf(document, id) !== null);
	if (selectIds.length === 0) return null;

	const solids: BrushSolid[] = [];
	for (const solid of document.solids) {
		if (!wanted.has(solid.id)) {
			solids.push(solid);
			continue;
		}
		const planes = transformPlanes(solid.planes, transform);
		if (!planes) return null;
		solids.push({ ...solid, planes });
	}
	return {
		document: {
			...document,
			solids,
			doodads: document.doodads.map((doodad) =>
				wanted.has(doodad.id) ? { ...doodad, pose: transformPose(doodad.pose, transform) } : doodad
			),
			entities: document.entities.map((entity) =>
				wanted.has(entity.id) ? transformEntity(entity, transform) : entity
			),
		},
		selectIds,
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
	const edit = deleteObjects(document, [id]);
	return edit && { ...edit, selectIds: selectedIds.filter((selected) => selected !== id) };
}

function copyData<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Copy objects on every layer under new ids, moved by `offset`, and select the
 * copies. The copies of one group share a new group of their own.
 */
export function duplicateObjects(
	document: LevelDocument,
	ids: readonly string[],
	offset: BridgeVec3,
	nextId: () => string = createLevelId
): LevelEdit | null {
	const wanted = new Set(ids);
	const move: LevelTransform = { kind: 'translate', delta: offset };
	const groups = new Map<string, string>();
	const groupCopy = (groupId: string): string => {
		let copy = groups.get(groupId);
		if (!copy) {
			copy = `group-${nextId()}`;
			groups.set(groupId, copy);
		}
		return copy;
	};

	const solids: BrushSolid[] = document.solids
		.filter((solid) => wanted.has(solid.id))
		.map((solid) => {
			const groupId = solid.groupId ? groupCopy(solid.groupId) : undefined;
			return {
				id: nextId(),
				planes: translateBrush(solid.planes, offset),
				...(groupId ? { groupId } : {}),
			};
		});
	const doodads = document.doodads
		.filter((doodad) => wanted.has(doodad.id))
		.map((doodad) => {
			const copy = copyData(doodad);
			return { ...copy, id: nextId(), pose: transformPose(copy.pose, move) };
		});
	const entities = document.entities
		.filter((entity) => wanted.has(entity.id))
		.map((entity) => ({ ...transformEntity(copyData(entity), move), id: nextId() }));

	const selectIds = [...solids, ...doodads, ...entities].map((copy) => copy.id);
	if (selectIds.length === 0) return null;
	return {
		document: {
			...document,
			solids: [...document.solids, ...solids],
			doodads: [...document.doodads, ...doodads],
			entities: [...document.entities, ...entities],
		},
		selectIds,
	};
}

/**
 * Cut each listed solid on the world XZ grid and select every piece. Pieces
 * keep the solid's group, and the first keeps its id. One solid the kernel
 * refuses (too many pieces, or a brush that does not compile) rejects the
 * whole edit, and so does a cut that leaves every solid whole.
 */
export function subdivideSolids(
	document: LevelDocument,
	ids: readonly string[],
	tile: number,
	nextId: () => string = createLevelId
): LevelEdit | null {
	const targets = new Set(ids);
	const pieces = new Map<string, BrushSolid[]>();
	let changed = false;
	for (const solid of document.solids) {
		if (!targets.has(solid.id)) continue;
		const cuts = subdivideBrush(solid.planes, tile, { maxPieces: MAX_SUBDIVIDE_PIECES });
		if (!cuts) return null;
		if (cuts.length < 2) {
			pieces.set(solid.id, [solid]);
			continue;
		}
		changed = true;
		pieces.set(
			solid.id,
			cuts.map((planes, index) => ({
				id: index === 0 ? solid.id : nextId(),
				planes,
				...(solid.groupId ? { groupId: solid.groupId } : {}),
			}))
		);
	}
	if (!changed) return null;
	return {
		document: {
			...document,
			solids: document.solids.flatMap((solid) => pieces.get(solid.id) ?? [solid]),
		},
		selectIds: [...pieces.values()].flat().map((piece) => piece.id),
	};
}

/** Remove every listed object, on any layer, in one edit. */
export function deleteObjects(document: LevelDocument, ids: readonly string[]): LevelEdit | null {
	const drop = new Set(ids);
	const solids = document.solids.filter((entry) => !drop.has(entry.id));
	const doodads = document.doodads.filter((entry) => !drop.has(entry.id));
	const entities = document.entities.filter((entry) => !drop.has(entry.id));
	if (
		solids.length === document.solids.length &&
		doodads.length === document.doodads.length &&
		entities.length === document.entities.length
	) {
		return null;
	}
	return { document: { ...document, solids, doodads, entities }, selectIds: [] };
}

/** Resize the sector grid, 1 unit at the least. The selection passes through. */
export function resizeSectors(
	document: LevelDocument,
	size: number,
	selectedIds: readonly string[] = [],
	selectedElements: readonly LevelElementRef[] = []
): LevelEdit | null {
	if (!Number.isFinite(size)) return null;
	const next = Math.max(1, size);
	if (sectorSizeOf(document) === next) return null;
	return {
		document: { ...document, sectors: { size: next } },
		selectIds: [...selectedIds],
		selectElements: selectedElements.map(copyRef),
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
