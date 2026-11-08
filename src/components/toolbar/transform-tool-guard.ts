/**
 * Keeps the active tool in step with the selection.
 *
 * Select is spent by one pick: a pick hands off to Move, and a click that
 * clears the selection leaves no tool. A gizmo mode is dropped once nothing is
 * left for it to act on, because the game keeps the simulation paused for the
 * whole time a transform tool is held (see `StageTransformTool.setMode`).
 * Escape already offers a manual way out via `disarmTools`; this is the
 * automatic one.
 */

import { subscribe } from 'valtio/vanilla';
import { sendTool } from '../../bridge/editor-bridge';
import { type DebugTools, debugState, setDebugTool } from '../entities/entities-state';
import { levelState } from '../level/level-state';
import { selectTransformTool } from './toolbar-actions';

const TRANSFORM_TOOLS = new Set<DebugTools>(['translate', 'rotate', 'scale']);

/** Whether a tool acts on the current selection. */
export function isTransformTool(tool: DebugTools): boolean {
	return TRANSFORM_TOOLS.has(tool);
}

/** Entities, or level objects while level mode is on. */
function hasSelection(): boolean {
	return (
		debugState.selectedEntityIds.length > 0 ||
		(levelState.active && levelState.selectedIds.length > 0)
	);
}

/**
 * Leave Select for Move once it has picked something.
 *
 * Select is for choosing. With one or more entities chosen, Move is the tool,
 * so the transform controls are the ones that read as active. Level objects
 * count too, since Move drags the level selection.
 *
 * @returns `true` when the tool changed.
 */
export function promoteSelectToTransform(): boolean {
	if (debugState.tool !== 'select') return false;
	if (!hasSelection()) return false;
	return selectTransformTool('translate');
}

/**
 * End Select after its one use: Move for a pick, no tool for a click that
 * cleared the selection.
 *
 * @returns `true` when the tool changed.
 */
export function endSelectAfterPick(): boolean {
	if (debugState.tool !== 'select') return false;
	if (hasSelection()) return promoteSelectToTransform();
	setDebugTool('none');
	sendTool('none');
	return true;
}

/**
 * Drop an active transform tool when nothing is selected.
 *
 * @returns `true` when a tool was reset.
 */
export function releaseOrphanedTransformTool(): boolean {
	if (debugState.selectedEntityIds.length > 0) return false;
	if (levelState.active && levelState.selectedIds.length > 0 && debugState.tool === 'translate') {
		return false;
	}
	if (!isTransformTool(debugState.tool)) return false;

	setDebugTool('none');
	sendTool('none');
	return true;
}

/** Both selections as one value, so a change to either can be seen. */
function selectionKey(): string {
	return `${debugState.selectedEntityIds.join(',')}|${levelState.selectedIds.join(',')}`;
}

export interface TransformToolGuardOptions {
	/** @default true */
	enabled?: boolean;
}

/**
 * Watch the selection: end Select after a pick, and release orphaned transform
 * tools.
 *
 * A pick only shows up as a different selection — the game also reports hover
 * through the same message. Pressing Select over an existing selection is not a
 * pick, so Select stays active until the next one.
 *
 * @returns An uninstall function.
 */
export function installTransformToolGuard(options: TransformToolGuardOptions = {}): () => void {
	if (options.enabled === false) return () => {};

	let lastSelection = selectionKey();
	const onChange = () => {
		releaseOrphanedTransformTool();
		const selection = selectionKey();
		if (selection === lastSelection) return;
		lastSelection = selection;
		endSelectAfterPick();
	};

	releaseOrphanedTransformTool();
	const stopDebug = subscribe(debugState, onChange);
	const stopLevel = subscribe(levelState, onChange);
	return () => {
		stopDebug();
		stopLevel();
	};
}
