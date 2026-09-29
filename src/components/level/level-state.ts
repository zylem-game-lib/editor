/**
 * Level-editor mode.
 *
 * Build mode owns a buffer of catalog placements. Turning it on seeds that
 * buffer from the stage currently loaded; turning it off freezes the buffer
 * so later stage changes do not rewrite a level the user has stepped out of.
 * Turning it on again reseeds.
 */

import type { LevelBuffer } from '@zylem/bridge';
import { proxy } from 'valtio/vanilla';
import { mirrorProxy } from '../common/proxy-mirror';
import { stageState } from '../stages/stage-state';
import { catalogState } from '../toolbar/catalog-state';
import {
	type LevelSourceEntity,
	removeLevelEntries,
	seedLevelBuffer,
	upsertLevelEntries,
} from './level-buffer';

/**
 * How a recorded entry was placed.
 *
 * `level` is the only role marked for bake. The editor does not merge meshes;
 * the game bakes later. `actor` and `doodad` are recorded and left out of that set.
 */
export type LevelRole = 'actor' | 'level' | 'doodad';

/** Role and actor props, kept beside `LevelEntry` because the bridge entry has neither. */
export interface LevelAnnotation {
	role: LevelRole;
	props: Record<string, string>;
}

export interface LevelState {
	active: boolean;
	/** Present after Build has been turned on at least once. Frozen while inactive. */
	buffer: LevelBuffer | null;
	/** Keyed by entry id. Entries that leave the buffer lose their annotation. */
	annotations: Record<string, LevelAnnotation>;
	/**
	 * Role stamped on entries that appear while the Add tool is armed.
	 * Cleared when the tool leaves Add, so a later stage update is not mis-tagged.
	 */
	placementRole: LevelRole | null;
}

/** A plain copy of the buffer, safe to post across a frame or write to a file. */
export interface LevelSnapshot {
	buffer: LevelBuffer;
	annotations: Record<string, LevelAnnotation>;
	/** Stage id the buffer was recorded against, when the game has published one. */
	stageId: string | null;
}

export const levelState = proxy<LevelState>({
	active: false,
	buffer: null,
	annotations: {},
	placementRole: null,
});

/** Solid-reactive view of {@link levelState}, for components. */
export const levelStore = mirrorProxy(levelState);

/**
 * Keep annotations aligned with the buffer.
 *
 * An id that was already in the buffer keeps its role and props. An id that
 * just appeared takes `roleForNew`. Anything no longer in the buffer is dropped.
 */
export function reconcileAnnotations(
	previous: Record<string, LevelAnnotation>,
	previousIds: ReadonlySet<string>,
	entryIds: readonly string[],
	roleForNew: LevelRole
): Record<string, LevelAnnotation> {
	const next: Record<string, LevelAnnotation> = {};
	for (const id of entryIds) {
		const kept = previousIds.has(id) ? previous[id] : undefined;
		next[id] = kept
			? { role: kept.role, props: { ...kept.props } }
			: { role: roleForNew, props: {} };
	}
	return next;
}

function entryIds(buffer: LevelBuffer | null): string[] {
	return buffer?.entries.map((entry) => entry.id) ?? [];
}

function applyAnnotations(previousIds: ReadonlySet<string>, roleForNew: LevelRole): void {
	levelState.annotations = reconcileAnnotations(
		levelState.annotations,
		previousIds,
		entryIds(levelState.buffer),
		roleForNew
	);
}

/** Enter or leave Build mode. Entering reseeds the buffer from the live stage. */
export function setLevelEditorActive(active: boolean): void {
	levelState.active = active;
	if (!active) return;

	const previousIds = new Set(entryIds(levelState.buffer));
	levelState.buffer = seedLevelBuffer(stageState.entities, catalogState.entities);
	// A reseed is the stage as it is, not a placement, so new ids are doodads.
	applyAnnotations(previousIds, 'doodad');
}

/** Role applied to entities that show up while Add is armed. */
export function setPlacementRole(role: LevelRole | null): void {
	levelState.placementRole = role;
}

/** Toggle Build mode. */
export function toggleLevelEditor(): void {
	setLevelEditorActive(!levelState.active);
}

/**
 * Copy the recorded level out of the editor.
 *
 * `null` when Build has never been turned on. A buffer frozen by leaving Build
 * mode is still returned. The copy is plain data, not the live proxy.
 */
export function snapshotLevelBuffer(): LevelSnapshot | null {
	const buffer = levelState.buffer;
	if (!buffer) return null;
	return {
		buffer: JSON.parse(JSON.stringify(buffer)) as LevelBuffer,
		annotations: JSON.parse(JSON.stringify(levelState.annotations)) as Record<
			string,
			LevelAnnotation
		>,
		stageId: stageState.config?.id ?? null,
	};
}

/** Ids whose role is `level`. The editor records the rest and does not bake them. */
export function entriesMarkedForBake(
	entries: readonly { id: string }[],
	annotations: Record<string, LevelAnnotation>
): string[] {
	return entries
		.filter((entry) => annotations[entry.id]?.role === 'level')
		.map((entry) => entry.id);
}

/**
 * Write one actor field on a buffer entry.
 *
 * No-op unless that entry is an actor. This does not tell the game: props ride
 * along on the place command, and edits after that stay in the buffer.
 */
export function setActorProp(id: string, key: string, value: string): void {
	const current = levelState.annotations[id];
	if (current?.role !== 'actor') return;
	const trimmed = key.trim();
	if (!trimmed) return;

	levelState.annotations = {
		...levelState.annotations,
		[id]: { role: 'actor', props: { ...current.props, [trimmed]: value } },
	};
}

/** Merge entity summaries into the buffer. No-op while Build mode is off. */
export function recordLevelUpsert(entities: readonly LevelSourceEntity[]): void {
	if (!levelState.active || !levelState.buffer) return;
	const previousIds = new Set(entryIds(levelState.buffer));
	levelState.buffer = upsertLevelEntries(levelState.buffer, entities, catalogState.entities);
	applyAnnotations(previousIds, levelState.placementRole ?? 'doodad');
}

/** Drop entities from the buffer. No-op while Build mode is off. */
export function recordLevelRemoved(ids: readonly string[]): void {
	if (!levelState.active || !levelState.buffer) return;
	const previousIds = new Set(entryIds(levelState.buffer));
	levelState.buffer = removeLevelEntries(levelState.buffer, ids);
	applyAnnotations(previousIds, 'doodad');
}

/**
 * Replace the buffer with a full stage snapshot.
 *
 * A stage change arrives as a wholesale list rather than a diff, so the buffer
 * is reseeded instead of patched. No-op while Build mode is off.
 */
export function recordLevelReplaced(entities: readonly LevelSourceEntity[]): void {
	if (!levelState.active) return;
	const previousIds = new Set(entryIds(levelState.buffer));
	levelState.buffer = seedLevelBuffer(entities, catalogState.entities);
	applyAnnotations(previousIds, 'doodad');
}
