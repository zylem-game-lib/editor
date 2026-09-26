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

export interface LevelState {
	active: boolean;
	/** Present after Build has been turned on at least once. Frozen while inactive. */
	buffer: LevelBuffer | null;
}

/** A plain copy of the buffer, safe to post across a frame or write to a file. */
export interface LevelSnapshot {
	buffer: LevelBuffer;
	/** Stage id the buffer was recorded against, when the game has published one. */
	stageId: string | null;
}

export const levelState = proxy<LevelState>({
	active: false,
	buffer: null,
});

/** Solid-reactive view of {@link levelState}, for components. */
export const levelStore = mirrorProxy(levelState);

/** Enter or leave Build mode. Entering reseeds the buffer from the live stage. */
export function setLevelEditorActive(active: boolean): void {
	levelState.active = active;
	if (active) {
		levelState.buffer = seedLevelBuffer(stageState.entities, catalogState.entities);
	}
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
		stageId: stageState.config?.id ?? null,
	};
}

/** Merge entity summaries into the buffer. No-op while Build mode is off. */
export function recordLevelUpsert(entities: readonly LevelSourceEntity[]): void {
	if (!levelState.active || !levelState.buffer) return;
	levelState.buffer = upsertLevelEntries(levelState.buffer, entities, catalogState.entities);
}

/** Drop entities from the buffer. No-op while Build mode is off. */
export function recordLevelRemoved(ids: readonly string[]): void {
	if (!levelState.active || !levelState.buffer) return;
	levelState.buffer = removeLevelEntries(levelState.buffer, ids);
}

/**
 * Replace the buffer with a full stage snapshot.
 *
 * A stage change arrives as a wholesale list rather than a diff, so the buffer
 * is reseeded instead of patched. No-op while Build mode is off.
 */
export function recordLevelReplaced(entities: readonly LevelSourceEntity[]): void {
	if (!levelState.active) return;
	levelState.buffer = seedLevelBuffer(entities, catalogState.entities);
}
