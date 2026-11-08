/**
 * The level tool buttons' decisions, kept out of the components so they can be
 * tested without a DOM — the same split as `add-button-state.ts`.
 */

import type {
	LevelDocument,
	LevelElementMode,
	LevelElementRef,
	LevelPlacementArm,
} from '@zylem/bridge';
import type { DebugTools } from '../entities/entities-state';

/** The Brush dropdown's face is lit only while a shape is armed. */
export function isBrushArmed(tool: DebugTools): boolean {
	return tool === 'brush';
}

/** The Trigger dropdown's face is lit only while a trigger placement is armed. */
export function isTriggerArmed(tool: DebugTools, placement: LevelPlacementArm | null): boolean {
	return tool === 'add' && placement?.kind === 'trigger';
}

/** Whether any selected id is a solid: what Clip and Subdivide cut. */
export function selectionHasSolid(
	document: LevelDocument,
	selectedIds: readonly string[]
): boolean {
	if (selectedIds.length === 0) return false;
	const selected = new Set(selectedIds);
	return document.solids.some((solid) => selected.has(solid.id));
}

/** Clip arms on a solid selection, and stays pressable while armed so it can be disarmed. */
export function canClip(
	tool: DebugTools,
	document: LevelDocument,
	selectedIds: readonly string[]
): boolean {
	return tool === 'clip' || selectionHasSolid(document, selectedIds);
}

/** Shear slides faces: it arms in face mode with faces selected, and stays pressable while armed. */
export function canShear(
	tool: DebugTools,
	mode: LevelElementMode,
	elements: readonly LevelElementRef[]
): boolean {
	return tool === 'shear' || (mode === 'face' && elements.length > 0);
}
