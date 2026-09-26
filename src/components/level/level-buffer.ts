/**
 * Level buffer edits.
 *
 * Pure functions over the document the Build mode records. The editor keeps the
 * live copy in valtio; nothing here touches Solid or the bridge channel. A
 * catalog id is resolved here because the entity list reports a constructor
 * symbol (`Box`) and the game can only spawn a catalog id (`box`).
 */

import type { BridgePose, BridgeQuat, BridgeVec3, LevelBuffer, LevelEntry } from '@zylem/bridge';

/** The slice of a catalog entry recording needs. */
export interface LevelCatalogType {
	id: string;
	label: string;
}

/** The slice of an entity summary recording needs. */
export interface LevelSourceEntity {
	uuid?: string;
	type?: string;
	position?: BridgeVec3;
	rotation?: BridgeVec3;
	quaternion?: BridgeQuat;
	scale?: BridgeVec3;
}

/** An empty level document. */
export function createLevelBuffer(): LevelBuffer {
	return { version: 1, entries: [] };
}

/**
 * Catalog id for an entity-list type.
 *
 * Matches `id` first, then `label`, so `box` and the constructor symbol `Box`
 * both resolve. Anything the catalog cannot spawn is `null`.
 */
export function resolveCatalogTypeId(
	type: string | undefined,
	catalog: readonly LevelCatalogType[]
): string | null {
	if (!type) return null;
	const byId = catalog.find((entry) => entry.id === type);
	if (byId) return byId.id;
	const byLabel = catalog.find((entry) => entry.label === type);
	return byLabel?.id ?? null;
}

/** Replace the buffer with whatever of `entities` the catalog can spawn. */
export function seedLevelBuffer(
	entities: readonly LevelSourceEntity[],
	catalog: readonly LevelCatalogType[]
): LevelBuffer {
	return upsertLevelEntries(createLevelBuffer(), entities, catalog);
}

/**
 * Insert or update entries from entity summaries.
 *
 * An entity whose type no longer resolves is dropped: the buffer only holds
 * things a later stream can spawn. Pose fields absent from a summary keep the
 * value already recorded.
 */
export function upsertLevelEntries(
	buffer: LevelBuffer,
	entities: readonly LevelSourceEntity[],
	catalog: readonly LevelCatalogType[]
): LevelBuffer {
	if (entities.length === 0) return buffer;

	const ordered = new Map<string, LevelEntry>();
	for (const entry of buffer.entries) {
		ordered.set(entry.id, { ...entry, pose: { ...entry.pose } });
	}

	let changed = false;
	for (const entity of entities) {
		if (!entity.uuid) continue;
		const typeId = resolveCatalogTypeId(entity.type, catalog);
		if (!typeId) {
			if (ordered.delete(entity.uuid)) changed = true;
			continue;
		}

		const previous = ordered.get(entity.uuid);
		const next: LevelEntry = {
			id: entity.uuid,
			typeId,
			pose: mergePose(previous?.pose, entity),
		};
		if (!previous || !sameEntry(previous, next)) {
			ordered.set(entity.uuid, next);
			changed = true;
		}
	}

	if (!changed) return buffer;
	return { version: 1, entries: [...ordered.values()] };
}

/** Drop entries by id. The same buffer is returned when nothing matched. */
export function removeLevelEntries(buffer: LevelBuffer, ids: readonly string[]): LevelBuffer {
	if (ids.length === 0 || buffer.entries.length === 0) return buffer;
	const drop = new Set(ids);
	const entries = buffer.entries.filter((entry) => !drop.has(entry.id));
	if (entries.length === buffer.entries.length) return buffer;
	return { version: 1, entries };
}

function mergePose(previous: BridgePose | undefined, entity: LevelSourceEntity): BridgePose {
	const pose: BridgePose = { ...previous };
	if (entity.position) pose.position = { ...entity.position };
	if (entity.rotation) pose.rotation = { ...entity.rotation };
	if (entity.quaternion) pose.quaternion = { ...entity.quaternion };
	if (entity.scale) pose.scale = { ...entity.scale };
	return pose;
}

function sameEntry(a: LevelEntry, b: LevelEntry): boolean {
	return a.typeId === b.typeId && samePose(a.pose, b.pose);
}

function samePose(a: BridgePose, b: BridgePose): boolean {
	return (
		sameVec3(a.position, b.position) &&
		sameVec3(a.rotation, b.rotation) &&
		sameQuat(a.quaternion, b.quaternion) &&
		sameVec3(a.scale, b.scale)
	);
}

function sameVec3(a: BridgeVec3 | undefined, b: BridgeVec3 | undefined): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.x === b.x && a.y === b.y && a.z === b.z;
}

function sameQuat(a: BridgeQuat | undefined, b: BridgeQuat | undefined): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;
}
