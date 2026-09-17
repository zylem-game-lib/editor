/**
 * Game→editor sync: a full stage snapshot, which resets stage config, the
 * entity list, thumbnails, and the undo history together.
 */

import type { StageSnapshotPayload } from '@zylem/bridge';
import { clearEntityThumbnails } from '../components/entities/thumbnail-store';
import { clearHistory } from '../components/history/history-store';
import { stageState } from '../components/stages/stage-state';
import { adoptInlineThumbnails, replaceEntities } from './sync-entities';

export function applyStageSnapshot(snapshot: StageSnapshotPayload): void {
	if (snapshot.stage) {
		stageState.config = {
			id: snapshot.stage.id,
			backgroundColor: snapshot.stage.backgroundColor,
			backgroundImage: snapshot.stage.backgroundImage,
			gravity: snapshot.stage.gravity,
			inputs: snapshot.stage.inputs,
			variables: snapshot.stage.variables,
		};
		stageState.backgroundColor = snapshot.stage.backgroundColor;
		stageState.backgroundImage = snapshot.stage.backgroundImage;
		stageState.gravity = snapshot.stage.gravity;
		stageState.inputs = snapshot.stage.inputs;
		stageState.variables = snapshot.stage.variables;
	} else {
		// A null stage means "no stage loaded". Leaving the previous config in
		// place would show the old stage's background, gravity, and variables
		// next to an entity list from a different context.
		stageState.config = null;
		stageState.backgroundColor = null;
		stageState.backgroundImage = null;
		stageState.gravity = { x: 0, y: 0, z: 0 };
		stageState.inputs = {};
		stageState.variables = {};
	}
	replaceEntities(snapshot.entities);
	clearEntityThumbnails();
	adoptInlineThumbnails(snapshot.entities);
	// A new stage means every uuid in the history stack is dangling, so replaying
	// an entry would either no-op or hit an unrelated entity.
	clearHistory();
}
