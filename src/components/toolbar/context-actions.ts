/**
 * What the context toolbar shows.
 *
 * Select's gizmos are always there. Perspective, Debug, and Build are layers,
 * so each one appends its own actions instead of replacing the row. Magnet,
 * undo, and redo sit once at the end because Select and Build both want them.
 */

export type ContextAction =
	| 'translate'
	| 'rotate'
	| 'scale'
	| 'view-top'
	| 'view-side'
	| 'view-isometric'
	| 'view-custom'
	| 'grid'
	| 'add-actor'
	| 'add-level'
	| 'add-primitive'
	| 'delete'
	| 'snap'
	| 'undo'
	| 'redo';

export interface ContextToolbarInput {
	perspective: boolean;
	debug: boolean;
	build: boolean;
}

export function contextToolbarActions(input: ContextToolbarInput): ContextAction[] {
	const actions: ContextAction[] = ['translate', 'rotate', 'scale'];
	if (input.perspective) {
		actions.push('view-top', 'view-side', 'view-isometric', 'view-custom');
	}
	if (input.debug) actions.push('grid');
	if (input.build) actions.push('add-actor', 'add-level', 'add-primitive', 'delete');
	actions.push('snap', 'undo', 'redo');
	return actions;
}

/** Actions that open a new group, so the toolbar can draw a divider in front. */
export function contextActionStartsGroup(action: ContextAction): boolean {
	return action === 'view-top' || action === 'grid' || action === 'add-actor' || action === 'snap';
}
