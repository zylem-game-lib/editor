/**
 * Game→editor sync: the editing session. Selection, the entity catalog the
 * Add tool offers, and committed scene operations (the undo stack).
 */

import type {
	EntitySelectionPayload,
	EntityTypeDescriptor,
	SceneOperationPayload,
} from '@zylem/bridge';
import {
	debugState as editorDebugState,
	noteTouchedEntity,
} from '../components/entities/entities-state';
import { pushOperation } from '../components/history/history-store';
import { setEntityCatalog } from '../components/toolbar/catalog-state';
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
}
