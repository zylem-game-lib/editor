/**
 * Modes for the dev harness.
 *
 * The gear outside the editor picks one. Applying it sets the camera, whether
 * the editor keeps the keyboard, and which toolbar buttons are visible. Tools
 * that do not exist yet are slots: they render with a label and do nothing.
 */

import { proxy } from 'valtio/vanilla';
import { sendDebugEnabled, sendTool } from '../bridge/commands';
import { mirrorProxy } from '../components/common/proxy-mirror';
import { setDebugStore } from '../components/editor-store';
import { debugState, setDebugTool } from '../components/entities/entities-state';
import { levelState, setLevelEditorActive } from '../components/level/level-state';
import type { ContextAction } from '../components/toolbar/context-actions';
import { setViewPreset, viewState, type ViewPreset } from '../components/toolbar/view-state';

export type HarnessModeId =
	| 'game-preview'
	| 'stage-editor'
	| 'level-builder'
	| 'hud-view'
	| 'entity-editor';

/** Buttons that already live on the main toolbar group. */
export type HarnessMainAction = 'select' | 'build' | 'camera' | 'debug' | 'play';

/** Labeled toolbar slots. Pressing one does not change the scene. */
export type HarnessSlotId =
	| 'navmesh'
	| 'decal'
	| 'map-mesh'
	| 'place-hud'
	| 'bind-variable'
	| 'geometry'
	| 'collision';

export type HarnessContextAction = ContextAction | HarnessSlotId;

export interface HarnessModeProfile {
	id: HarnessModeId;
	label: string;
	camera: ViewPreset;
	/** Show the camera-view buttons through the live camera layer, as the toolbar does today. */
	cameraLayer: boolean;
	debug: boolean;
	level: boolean;
	/** When false, toolbar shortcuts leave the keyboard to the game. */
	captureKeys: boolean;
	/**
	 * Main-row buttons. `null` keeps today's row (select, build, camera, debug, play).
	 */
	main: HarnessMainAction[] | null;
	/**
	 * Context-row buttons. `null` keeps today's layer row (gizmos, views, level tools).
	 */
	context: HarnessContextAction[] | null;
}

const VIEW_ACTIONS: HarnessContextAction[] = [
	'view-game',
	'view-side',
	'view-top',
	'view-isometric',
	'view-free',
];

export const HARNESS_MODES: readonly HarnessModeProfile[] = [
	{
		id: 'game-preview',
		label: 'Game Preview',
		camera: 'game',
		cameraLayer: false,
		debug: false,
		level: false,
		captureKeys: false,
		main: ['play'],
		context: [],
	},
	{
		id: 'stage-editor',
		label: 'Stage Editor',
		camera: 'free',
		cameraLayer: true,
		debug: true,
		level: false,
		captureKeys: true,
		main: null,
		context: null,
	},
	{
		id: 'level-builder',
		label: 'Level Builder',
		camera: 'top',
		cameraLayer: true,
		debug: true,
		level: true,
		captureKeys: true,
		main: ['select'],
		context: [
			...VIEW_ACTIONS,
			'draw-brush',
			'clip-brush',
			'vertex-brush',
			'add-spawn',
			'add-trigger',
			'delete',
			'navmesh',
			'decal',
			'map-mesh',
			'snap',
			'undo',
			'redo',
		],
	},
	{
		id: 'hud-view',
		label: 'HUD View',
		camera: 'game',
		cameraLayer: false,
		debug: false,
		level: false,
		captureKeys: false,
		main: ['select'],
		context: ['place-hud', 'bind-variable'],
	},
	{
		id: 'entity-editor',
		label: 'Entity Editor',
		camera: 'free',
		cameraLayer: false,
		debug: true,
		level: false,
		captureKeys: true,
		main: ['select'],
		context: ['translate', 'rotate', 'scale', 'geometry', 'collision'],
	},
];

const LEVEL_TOOLS = new Set(['add', 'brush', 'clip', 'vertex']);

export const HARNESS_SLOT_LABELS: Record<HarnessSlotId, string> = {
	navmesh: 'Navigation mesh',
	decal: 'Environment decal',
	'map-mesh': 'Map mesh',
	'place-hud': 'Place HUD',
	'bind-variable': 'Bind variable',
	geometry: 'Geometry',
	collision: 'Collision',
};

export function isHarnessSlot(action: string): action is HarnessSlotId {
	return Object.prototype.hasOwnProperty.call(HARNESS_SLOT_LABELS, action);
}

export function harnessModeProfile(id: HarnessModeId): HarnessModeProfile {
	const profile = HARNESS_MODES.find((mode) => mode.id === id);
	if (!profile) {
		throw new Error(`Unknown harness mode "${id}"`);
	}
	return profile;
}

export const harnessModeState = proxy<{
	id: HarnessModeId | null;
	captureKeys: boolean;
}>({
	id: null,
	captureKeys: true,
});

/** Solid-reactive view of {@link harnessModeState}. */
export const harnessModeStore = mirrorProxy(harnessModeState);

/** Whether the editor should keep keyboard shortcuts. Unset mode keeps them. */
export function harnessCapturesKeys(): boolean {
	return harnessModeState.captureKeys;
}

/** Apply a harness mode to the editor's camera, debug flag, level editor, and toolbar. */
export function applyHarnessMode(id: HarnessModeId): void {
	const profile = harnessModeProfile(id);
	harnessModeState.id = id;
	harnessModeState.captureKeys = profile.captureKeys;

	setDebugStore('debug', profile.debug);
	sendDebugEnabled(profile.debug);
	viewState.camera = profile.cameraLayer;
	setViewPreset(profile.camera);

	if (profile.level) {
		levelState.activeLayer = 'solid';
	}
	setLevelEditorActive(profile.level);
	if (!profile.level && LEVEL_TOOLS.has(debugState.tool as string)) {
		setDebugTool('select');
		sendTool('select');
	}
}
