/**
 * Game→editor sync: the editing session. Selection, the entity catalog the
 * Add tool offers, committed scene operations (the undo stack), and finished
 * level gestures.
 */

import type {
	EntitySelectionPayload,
	EntityTypeDescriptor,
	LevelGesture,
	SceneOperationPayload,
} from '@zylem/bridge';
import {
	debugState as editorDebugState,
	noteTouchedEntity,
} from '../components/entities/entities-state';
import { pushOperation } from '../components/history/history-store';
import { applyIncomingGesture } from '../components/level/level-state';
import { setEntityCatalog } from '../components/toolbar/catalog-state';
import { endToolAfterUse } from '../components/toolbar/toolbar-actions';
import { notifySceneOperation } from '../host/scene-operation-hook';

export function applyEntitySelection(selection: EntitySelectionPayload): void {
	editorDebugState.selectedEntityId = selection.selectedUuid;
	editorDebugState.hoveredEntityId = selection.hoveredUuid;
	editorDebugState.selectedEntityIds =
		selection.selectedUuids ?? (selection.selectedUuid ? [selection.selectedUuid] : []);
	// Written field by field rather than through `setSelectedEntityId`, so the
	// in-scene Select tool's picks have to be recorded here too.
	noteTouchedEntity(selection.selectedUuid);
}

export function applyCatalog(payload: { entities: EntityTypeDescriptor[] }): void {
	setEntityCatalog(payload.entities);
}

/** Record a committed game-side edit, and let the host observe it. */
export function applySceneOperation(op: SceneOperationPayload): void {
	// Placement leaves the new entity unselected, so this is the only signal that
	// it is now the thing being worked on. Undo of the create is not unwound here:
	// the entity simply stops existing, and the gizmo tools check for that.
	if (op.kind === 'create') {
		noteTouchedEntity(op.entries.at(-1)?.uuid ?? null);
	}
	pushOperation(op);
	notifySceneOperation(op);
	if (op.kind === 'create') endToolAfterUse('place');
	else if (op.kind === 'delete') endToolAfterUse('delete');
}

const PLACING_GESTURES = new Set<LevelGesture['kind']>(['doodad', 'spawn', 'trigger']);

/** Apply a finished level gesture to the document, and spend the tool that made it. */
export function applyLevelGesture(gesture: LevelGesture): void {
	const kept = applyIncomingGesture(gesture);
	if (!kept) return;
	if (gesture.kind === 'primitive') endToolAfterUse('draw');
	else if (PLACING_GESTURES.has(gesture.kind)) endToolAfterUse('place');
	else if (gesture.kind === 'delete' || gesture.kind === 'element-delete')
		endToolAfterUse('delete');
}
