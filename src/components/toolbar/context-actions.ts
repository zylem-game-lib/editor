/**
 * What the context toolbar shows.
 *
 * Select's gizmos are always there. Perspective, Debug, and Level are layers,
 * so each one appends its own actions instead of replacing the row. Magnet,
 * undo, and redo sit once at the end because Select and Level both want them.
 *
 * Level mode's row follows the active document layer: solids are drawn, doodads
 * are placed from the catalog, and the entity layer adds spawns and triggers.
 */

import type { LevelLayerId } from '../level/level-types';

export type ContextAction =
	| 'translate'
	| 'rotate'
	| 'scale'
	| 'view-game'
	| 'view-side'
	| 'view-top'
	| 'view-isometric'
	| 'view-free'
	| 'grid'
	| 'draw-brush'
	| 'clip-brush'
	| 'vertex-brush'
	| 'add-doodad'
	| 'add-spawn'
	| 'add-trigger'
	| 'delete'
	| 'snap'
	| 'undo'
	| 'redo';

export interface ContextToolbarInput {
	perspective: boolean;
	debug: boolean;
	build: boolean;
	/** Which level layer is showing tools. Ignored while level mode is off. */
	levelLayer?: LevelLayerId;
}

export function contextToolbarActions(input: ContextToolbarInput): ContextAction[] {
	const actions: ContextAction[] = ['translate', 'rotate', 'scale'];
	if (input.perspective) {
		actions.push('view-game', 'view-side', 'view-top', 'view-isometric', 'view-free');
	}
	if (input.debug) actions.push('grid');
	if (input.build) {
		const layer = input.levelLayer ?? 'solid';
		if (layer === 'solid') actions.push('draw-brush', 'clip-brush', 'vertex-brush', 'delete');
		else if (layer === 'doodad') actions.push('add-doodad', 'delete');
		else actions.push('add-spawn', 'add-trigger', 'delete');
	}
	actions.push('snap', 'undo', 'redo');
	return actions;
}

/** Actions that open a new group, so the toolbar can draw a divider in front. */
export function contextActionStartsGroup(action: ContextAction): boolean {
	return (
		action === 'view-game' ||
		action === 'grid' ||
		action === 'draw-brush' ||
		action === 'add-doodad' ||
		action === 'add-spawn' ||
		action === 'snap'
	);
}
