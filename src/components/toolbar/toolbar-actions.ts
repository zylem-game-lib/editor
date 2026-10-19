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
import {
	levelState,
	playLevelDocument,
	setLevelPlacement,
	syncLevelDocument,
	toggleLevelEditor as toggleLevelMode,
} from '../level/level-state';
import { stageState } from '../stages/stage-state';
import { setGridVisible, setSnapEnabled, transformState } from '../transform/transform-state';
import { resolvePlacementTarget } from './add-button-state';
import { catalogState, getEntityDescriptor, setArmedType } from './catalog-state';
import { resolveTransformTarget } from './transform-button-state';
import { setViewPreset } from './view-state';

export type TransformTool = Extract<DebugTools, 'translate' | 'rotate' | 'scale'>;
export type ClickTool = Extract<DebugTools, 'select' | 'delete'>;

/**
 * Debug mode on or off, in the editor and the game.
 *
 * Turning it on latches the free camera. The game copies the gameplay camera
 * onto that view and switches to it. Turning it off leaves the camera alone.
 */
export function toggleDebug(): void {
	const enabled = !debugStore.debug;
	setDebugStore('debug', enabled);
	sendDebugEnabled(enabled);
	if (enabled) setViewPreset('free');
}

/**
 * Make a tool the active one, in the editor and the game.
 *
 * Leaving Add clears the level placement so the next click is not a doodad,
 * spawn, or trigger.
 */
function activateTool(tool: DebugTools): void {
	setDebugTool(tool);
	sendTool(tool);
	if (tool !== 'add') setLevelPlacement(null);
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
	if (
		levelState.active &&
		levelState.selectedIds.length > 0 &&
		(next === 'translate' || next === 'none')
	) {
		activateTool(next);
		return true;
	}

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
 * Arm placement with a catalog type and the role those new entries are tagged
 * with. Arming an armed tool leaves it armed — Escape is the way out — so
 * placing ten of something is one arm and ten clicks.
 *
 * @returns `false` when the catalog has no such type.
 */
export function armAddType(typeId: string): boolean {
	const descriptor = getEntityDescriptor(typeId);
	if (!descriptor) return false;

	const props = descriptor.defaultProps ? snapshot(descriptor.defaultProps) : undefined;
	setArmedType(descriptor.id);
	// Snapshotted: the props cross the bridge into the game, which should not
	// receive a live handle on the editor's store.
	sendAddType(descriptor.id, props);
	setDebugTool('add');
	sendTool('add');
	if (levelState.active) {
		levelState.activeLayer = 'doodad';
		setLevelPlacement({
			kind: 'doodad',
			typeId: descriptor.id,
			...(props ? { props } : {}),
		});
	}
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

/** Arm draw, clip, or vertex on the solids layer. */
export function armSolidTool(tool: 'brush' | 'clip' | 'vertex'): void {
	levelState.activeLayer = 'solid';
	activateTool(tool);
}

/** Arm a spawn marker on the entity layer. The click is recorded in the document. */
export function armSpawnTool(): void {
	levelState.activeLayer = 'entity';
	setArmedType(null);
	sendAddType(null);
	setDebugTool('add');
	sendTool('add');
	setLevelPlacement({ kind: 'spawn' });
}

/** Arm a trigger volume on the entity layer. */
export function armTriggerTool(): void {
	levelState.activeLayer = 'entity';
	setArmedType(null);
	sendAddType(null);
	setDebugTool('add');
	sendTool('add');
	setLevelPlacement({ kind: 'trigger', size: { x: 2, y: 2, z: 2 } });
}

/**
 * Enter or leave level mode.
 *
 * Entering shows the saved document. Leaving drops the preview and leaves the
 * stage's own entities in place. A level tool left armed is returned to Select
 * so the next click cannot spawn into the live stage.
 */
export function toggleLevelEditor(): void {
	const leaving = levelState.active;
	toggleLevelMode();
	if (!leaving) return;
	const tool = debugState.tool;
	if (tool === 'add' || tool === 'brush' || tool === 'clip' || tool === 'vertex') {
		activateTool('select');
	}
}

/** Pause or resume the simulation, in the editor and the game. */
export function togglePlayback(): void {
	const paused = !debugState.paused;
	setPaused(paused);
	sendPlayback(paused);
	if (!levelState.active) return;
	// Pausing returns to the edit preview. Resuming plays the document.
	if (paused) syncLevelDocument();
	else playLevelDocument();
}
