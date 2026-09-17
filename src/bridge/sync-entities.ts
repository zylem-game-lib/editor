/**
 * Game→editor sync: the entity list.
 *
 * Owns `stageState.entities` and the uuid index beside it, so upserts and
 * removals are direct lookups rather than scans, and thumbnails that arrive
 * inline on a summary are routed into the thumbnail store.
 */

import type { EntitySummaryPayload, EntityThumbnailPayload } from '@zylem/bridge';
import {
	removeEntityThumbnails,
	setEntityThumbnails,
} from '../components/entities/thumbnail-store';
import { stageState } from '../components/stages/stage-state';
import type { BaseEntityInterface } from '../types';

/**
 * uuid → index into `stageState.entities`. Kept alongside the array so an
 * upsert is a direct lookup instead of a full scan per message.
 */
const entityIndex = new Map<string, number>();

function toEntityInterface(payload: EntitySummaryPayload): BaseEntityInterface {
	const entity: BaseEntityInterface = {
		uuid: payload.uuid,
		name: payload.name,
		type: payload.type,
		position: payload.position,
		rotation: payload.rotation,
		scale: payload.scale,
	};
	if (payload.bounds) {
		entity.bounds = payload.bounds;
	}
	return entity;
}

/** Copy changed fields onto an existing entity, leaving untouched ones alone. */
function updateEntityInPlace(
	target: Partial<BaseEntityInterface>,
	payload: EntitySummaryPayload
): void {
	if (target.name !== payload.name) target.name = payload.name;
	if (target.type !== payload.type) target.type = payload.type;
	if (!isSameVec3(target.position, payload.position)) {
		target.position = payload.position;
	}
	if (!isSameVec3(target.rotation, payload.rotation)) {
		target.rotation = payload.rotation;
	}
	if (!isSameVec3(target.scale, payload.scale)) {
		target.scale = payload.scale;
	}
	if (payload.bounds && !isSameBounds(target.bounds, payload.bounds)) {
		target.bounds = payload.bounds;
	}
}

function isSameVec3(
	a: { x: number; y: number; z: number } | undefined,
	b: { x: number; y: number; z: number } | undefined
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.x === b.x && a.y === b.y && a.z === b.z;
}

function isSameBounds(
	a: { width: number; height: number; depth: number } | undefined,
	b: { width: number; height: number; depth: number } | undefined
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.width === b.width && a.height === b.height && a.depth === b.depth;
}

/** Rebuild the uuid index from whatever is currently in `stageState.entities`. */
export function rebuildEntityIndex(): void {
	entityIndex.clear();
	stageState.entities.forEach((entity, index) => {
		if (entity.uuid) entityIndex.set(entity.uuid, index);
	});
}

/** Replace the whole entity list (a new stage snapshot). */
export function replaceEntities(entities: EntitySummaryPayload[]): void {
	stageState.entities = entities.map(toEntityInterface);
	rebuildEntityIndex();
}

/**
 * Route thumbnails that arrived inline on an entity summary into the
 * side-channel store, so every consumer reads them from one place.
 */
export function adoptInlineThumbnails(entities: EntitySummaryPayload[]): void {
	const inline = entities
		.filter((payload) => Boolean(payload.thumbnail))
		.map((payload) => ({
			uuid: payload.uuid,
			url: payload.thumbnail as string,
			bounds: payload.bounds,
		}));
	if (inline.length > 0) setEntityThumbnails(inline);
}

/**
 * Merge entity updates by mutating changed entries in place. Replacing the
 * whole array on every message made each upsert cost O(entities) and forced
 * `reconcile` to re-diff the entire list, which is what turned a spawn-heavy
 * game into a frozen tab.
 */
export function applyEntityUpsert(entities: EntitySummaryPayload[]): void {
	const current = stageState.entities;
	for (const payload of entities) {
		const index = entityIndex.get(payload.uuid);
		const existing = index === undefined ? undefined : current[index];
		if (!existing) {
			entityIndex.set(payload.uuid, current.length);
			current.push(toEntityInterface(payload));
		} else {
			updateEntityInPlace(existing, payload);
		}
	}
	adoptInlineThumbnails(entities);
}

export function applyEntityRemoved(uuids: string[]): void {
	// Release thumbnails first, and unconditionally: a thumbnail can arrive
	// for an entity that never made it into the list (or already left it), and
	// its blob URL would otherwise be held until the next stage snapshot.
	removeEntityThumbnails(uuids);

	const removed = new Set(uuids);
	const current = stageState.entities;
	// Compact in place, then rebuild the index for the shifted positions.
	let write = 0;
	for (let read = 0; read < current.length; read += 1) {
		const entity = current[read]!;
		if (entity.uuid && removed.has(entity.uuid)) continue;
		current[write] = entity;
		write += 1;
	}
	if (write === current.length) return;

	current.length = write;
	rebuildEntityIndex();
}

export function applyThumbnails(thumbnails: EntityThumbnailPayload[]): void {
	setEntityThumbnails(thumbnails);
}
