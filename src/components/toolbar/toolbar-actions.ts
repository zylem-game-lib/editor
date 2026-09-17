/**
 * What each toolbar button does when pressed, as plain functions.
 *
 * Kept out of the components so the keyboard shortcuts run the same code. Where
 * a key and its button differ — the tool keys select, the tool buttons toggle —
 * both variants live here over one shared primitive, so the two cannot drift.
 * The components keep the reactive reads that drive `selected` and `disabled`,
 * and call in here on click.
 *
 * Everything reads the valtio proxies rather than their Solid mirrors. These run
 * outside any tracking scope — from a `keydown` on `window` as often as from a
 * click — and the mirrors lag the proxies by a microtask.
 */

import { snapshot } from 'valtio/vanilla';
import {
	sendAddType,
	sendDebugEnabled,
	sendEntitySelect,
	sendPlayback,
	sendTool,
} from '../../bridge/editor-bridge';
import { debugStore, setDebugStore } from '../editor-store';
import {
	type DebugTools,
	debugState,
	setDebugTool,
	setPaused,
	setSelectedEntityId,
} from '../entities/entities-state';
import { stageState } from '../stages/stage-state';
import { setGridVisible, setSnapEnabled, transformState } from '../transform/transform-state';
import { resolvePlacementTarget } from './add-button-state';
import { catalogState, getEntityDescriptor, setArmedType } from './catalog-state';
import { resolveTransformTarget } from './transform-button-state';

export type TransformTool = Extract<DebugTools, 'translate' | 'rotate' | 'scale'>;
export type ClickTool = Extract<DebugTools, 'select' | 'delete'>;

/** Debug mode on or off, in the editor and the game. */
export function toggleDebug(): void {
	const enabled = !debugStore.debug;
	setDebugStore('debug', enabled);
	sendDebugEnabled(enabled);
}

/** Make a tool the active one, in the editor and the game. */
function activateTool(tool: DebugTools): void {
	setDebugTool(tool);
	sendTool(tool);
}

/**
 * Make a click tool the active one. Pressing the key of the tool already active
 * keeps it, so the keyboard behaves like a row of radio buttons; Escape is the
 * way out.
 */
export function selectTool(tool: ClickTool): void {
	if (debugState.tool !== tool) activateTool(tool);
}

/** Toggle a click tool from its button: a second press returns to the neutral tool. */
export function toggleTool(tool: ClickTool): void {
	activateTool(debugState.tool === tool ? 'none' : tool);
}

/** The entity a gizmo tool would act on right now, or null when there is none. */
export function transformTarget(): string | null {
	return resolveTransformTarget(
		debugState.selectedEntityIds,
		debugState.lastTouchedEntityId,
		stageState.entities.map((entity) => entity.uuid).filter((uuid): uuid is string => Boolean(uuid))
	);
}

/**
 * Enter a gizmo mode, or leave with `'none'`. Entering disarms the Add tool,
 * since a click would otherwise be ambiguous between placing and grabbing a
 * handle.
 *
 * @returns `false` when there is nothing to act on — the state the button is
 * disabled for.
 */
function applyTransformTool(next: TransformTool | 'none'): boolean {
	const uuid = transformTarget();
	if (!uuid) return false;

	setArmedType(null);
	sendAddType(null);

	/*
	 * Selection first, and both writes in one synchronous run. The transform
	 * guard drops a gizmo tool whose selection is empty, and it only ever sees
	 * the state a batch of `debugState` writes leaves behind — so what keeps
	 * this safe is that nothing awaits in between, rather than the order alone.
	 * Sent to the game as well as set here, because the gizmo's pivot is
	 * computed game-side from its own copy of the selection.
	 */
	if (next !== 'none' && debugState.selectedEntityIds.length === 0) {
		setSelectedEntityId(uuid);
		sendEntitySelect(uuid);
	}

	activateTool(next);
	return true;
}

/**
 * Enter a gizmo mode from its key. Pressing the key of the mode already active
 * keeps it — and still counts as handled, so the keystroke goes nowhere else.
 */
export function selectTransformTool(tool: TransformTool): boolean {
	if (debugState.tool === tool) return true;
	return applyTransformTool(tool);
}

/** Toggle a gizmo mode from its button: a second press returns to the neutral tool. */
export function toggleTransformTool(tool: TransformTool): boolean {
	return applyTransformTool(debugState.tool === tool ? 'none' : tool);
}

/**
 * Arm placement with a catalog type. Arming an armed tool leaves it armed —
 * Escape is the way out — so placing ten of something is one arm and ten clicks.
 *
 * @returns `false` when the catalog has no such type.
 */
export function armAddType(typeId: string): boolean {
	const descriptor = getEntityDescriptor(typeId);
	if (!descriptor) return false;

	setArmedType(descriptor.id);
	// Snapshotted: the props cross the bridge into the game, which should not
	// receive a live handle on the editor's store.
	sendAddType(descriptor.id, descriptor.defaultProps && snapshot(descriptor.defaultProps));
	setDebugTool('add');
	sendTool('add');
	return true;
}

/**
 * Arm placement with what the Add button's face shows.
 *
 * @returns `false` on an empty catalog, the one state with nothing to arm.
 */
export function armAddTool(): boolean {
	const descriptor = resolvePlacementTarget(
		catalogState.entities,
		catalogState.armedTypeId,
		catalogState.lastTypeId
	);
	return descriptor ? armAddType(descriptor.id) : false;
}

/*
 * The Add palette is component-owned UI rather than store state, so the
 * shortcut reaches it through a callback the button registers while mounted.
 * Nothing registered — the toolbar is closed — means nothing to open, and the
 * shortcut is inert. A flag in a store would instead pop the palette open the
 * moment a toolbar next appeared.
 */
let paletteOpener: (() => boolean) | null = null;

/**
 * Register the mounted Add button's palette. A later registration replaces an
 * earlier one, and the returned unregister function only clears its own.
 */
export function registerAddPaletteOpener(open: () => boolean): () => void {
	paletteOpener = open;
	return () => {
		if (paletteOpener === open) paletteOpener = null;
	};
}

/** Open the Add palette, if a toolbar is showing one. */
export function openAddPalette(): boolean {
	return paletteOpener?.() ?? false;
}

export function toggleSnap(): void {
	setSnapEnabled(!transformState.enabled);
}

export function toggleGrid(): void {
	setGridVisible(!transformState.gridVisible);
}

/** Pause or resume the simulation, in the editor and the game. */
export function togglePlayback(): void {
	const paused = !debugState.paused;
	setPaused(paused);
	sendPlayback(paused);
}
