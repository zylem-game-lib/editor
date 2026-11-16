/**
 * A pick in the scene chooses the editor mode.
 *
 * Select picks the same things in every mode: HUD elements, entities, and the
 * parts of the level. What it picked decides which toolbar is the useful one,
 * so the mode follows the pick. Only one kind of thing is selected at a time:
 * picking an entity drops the level selection, and picking part of the level
 * drops the entities.
 *
 * Only picks made in the scene are followed. A selection the editor made
 * itself (a row in a panel, a gizmo button taking the last-touched entity)
 * leaves the mode alone. So does a click on empty space.
 *
 * Nothing here runs until a mode has been applied, so a host without modes
 * keeps the one toolbar it has. Game Preview is left alone too: the pointer
 * there belongs to the game.
 */

import type { LevelLayerId, LevelSelectPayload } from '@zylem/bridge';
import { sendEntitySelect } from '../../bridge/commands';
import { applyHarnessMode, type HarnessModeId, harnessModeState } from '../../dev/harness-modes';
import { debugState, setSelectedEntityId } from '../entities/entities-state';
import { clearLevelSelection, layerOf, levelState } from '../level/level-state';
import { stageState } from '../stages/stage-state';

/** The mode that edits each layer of the level document. */
const LAYER_MODES: Record<LevelLayerId, HarnessModeId> = {
	solid: 'level-builder-mesh',
	doodad: 'level-builder-decoration',
	entity: 'level-builder-navigation',
};

/** Whether picks choose the mode: a mode is applied, and it is not Game Preview. */
function followsPicks(): boolean {
	const id = harnessModeState.id;
	return id !== null && id !== 'game-preview';
}

/** Whether an entity is pinned to the viewport rather than placed in the world. */
export function isHudEntity(uuid: string): boolean {
	return stageState.entities.some((entity) => entity.uuid === uuid && entity.hud === true);
}

/** Whether entities are selected and every one of them is a HUD element. */
export function isHudSelection(): boolean {
	const ids = debugState.selectedEntityIds;
	return ids.length > 0 && ids.every(isHudEntity);
}

/**
 * The mode for the selected entities, or `null` with none selected. The entity
 * picked last decides when the selection mixes HUD elements with the rest.
 */
export function modeForEntitySelection(): HarnessModeId | null {
	const picked = debugState.selectedEntityId ?? debugState.selectedEntityIds[0];
	if (!picked) return null;
	return isHudEntity(picked) ? 'hud-view' : 'entity-editor';
}

/**
 * The mode for the level selection, or `null` with nothing selected. Vertices,
 * edges, and faces belong to solids. An object goes by its layer, and
 * `pickedId` decides when the selection spans layers.
 */
export function modeForLevelSelection(pickedId?: string | null): HarnessModeId | null {
	if (levelState.selectedElements.length > 0) return LAYER_MODES.solid;
	const ids = levelState.selectedIds;
	const id = pickedId && ids.includes(pickedId) ? pickedId : ids[ids.length - 1];
	const layer = id ? layerOf(levelState.document, id) : null;
	return layer ? LAYER_MODES[layer] : null;
}

function showMode(mode: HarnessModeId): void {
	if (harnessModeState.id !== mode) applyHarnessMode(mode, { keepTool: true });
}

/**
 * Follow a pick of entities in the scene: drop the level selection and show
 * HUD View for a HUD element, Entity Inspector for anything else. Call after
 * the selection is written.
 */
export function followEntityPick(): void {
	if (!followsPicks()) return;
	const mode = modeForEntitySelection();
	if (!mode) return;
	clearLevelSelection();
	showMode(mode);
}

/**
 * Follow a pick in the level preview: drop the entity selection, here and in
 * the game, and show the level mode that edits what was picked. Call after
 * the selection is written.
 */
export function followLevelPick(payload: LevelSelectPayload): void {
	if (!followsPicks()) return;
	const mode = modeForLevelSelection(payload.id);
	if (!mode) return;
	if (debugState.selectedEntityIds.length > 0) {
		setSelectedEntityId(null);
		sendEntitySelect(null);
	}
	showMode(mode);
}
