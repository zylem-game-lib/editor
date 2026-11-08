/**
 * Modes for the dev harness.
 *
 * The gear outside the editor picks one. Applying it sets the camera, whether
 * the editor keeps the keyboard, and which toolbar buttons are visible. Tools
 * that do not exist yet are slots: they render with a label and do nothing.
 */

import type { LevelLayerId } from '@zylem/bridge';
import { proxy } from 'valtio/vanilla';
import { sendDebugEnabled, sendTool } from '../bridge/commands';
import { mirrorProxy } from '../components/common/proxy-mirror';
import { setDebugStore } from '../components/editor-store';
import { debugState, setDebugTool } from '../components/entities/entities-state';
import {
	levelState,
	setActiveLayer,
	setLevelEditorActive,
	setLevelPlacement,
} from '../components/level/level-state';
import type { ContextAction } from '../components/toolbar/context-actions';
import { setViewPreset, type ViewPreset, viewState } from '../components/toolbar/view-state';

export type HarnessModeId =
	| 'game-preview'
	| 'stage-editor'
	| 'level-builder-mesh'
	| 'level-builder-navigation'
	| 'level-builder-decoration'
	| 'hud-view'
	| 'entity-editor';

/** Buttons that already live on the main toolbar group. */
export type HarnessMainAction = 'select' | 'build' | 'camera' | 'debug' | 'play';

/** Labeled toolbar slots. Pressing one does not change the scene. */
export type HarnessSlotId =
	| 'navmesh'
	| 'decal'
	| 'edge'
	| 'face'
	| 'shear'
	| 'uv-brush'
	| 'splat'
	| 'directional-vector'
	| 'obstacle-brush'
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
	/** Document layer a level-builder mode edits. Null for every other mode. */
	layer: LevelLayerId | null;
	/**
	 * Main-row buttons. `null` keeps today's row (select, build, camera, debug, play).
	 */
	main: HarnessMainAction[] | null;
	/**
	 * Context-row buttons. `null` keeps today's layer row (gizmos, views, level tools).
	 */
	context: HarnessContextAction[] | null;
}

export const HARNESS_MODES: readonly HarnessModeProfile[] = [
	{
		id: 'game-preview',
		label: 'Game Preview',
		camera: 'game',
		cameraLayer: false,
		debug: false,
		level: false,
		captureKeys: false,
		layer: null,
		main: [],
		context: [],
	},
	{
		id: 'stage-editor',
		label: 'Stage Editor',
		camera: 'free',
		cameraLayer: false,
		debug: true,
		level: false,
		captureKeys: true,
		layer: null,
		main: ['debug', 'select', 'camera'],
		context: ['translate', 'rotate', 'scale', 'snap', 'add-object', 'delete', 'undo', 'redo'],
	},
	levelBuilderMode('level-builder-mesh', 'Level Builder - Mesh', 'solid', [
		'draw-brush',
		'clip-brush',
		'vertex-brush',
		'edge',
		'face',
		'shear',
	]),
	levelBuilderMode('level-builder-navigation', 'Level Builder - Navigation', 'entity', [
		'navmesh',
		'add-spawn',
		'add-trigger',
		'directional-vector',
		'obstacle-brush',
		'delete',
	]),
	levelBuilderMode('level-builder-decoration', 'Level Builder - Decoration', 'doodad', [
		'uv-brush',
		'decal',
		'splat',
		'translate',
		'rotate',
		'scale',
	]),
	{
		id: 'hud-view',
		label: 'HUD View',
		camera: 'game',
		cameraLayer: false,
		debug: false,
		level: false,
		captureKeys: false,
		layer: null,
		main: ['select', 'camera'],
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
		layer: null,
		main: ['select', 'camera'],
		context: ['translate', 'rotate', 'scale', 'geometry', 'collision'],
	},
];

/** Level Builder shares one header. The tools between grid and undo differ. */
function levelBuilderMode(
	id: HarnessModeId,
	label: string,
	layer: LevelLayerId,
	tools: HarnessContextAction[]
): HarnessModeProfile {
	return {
		id,
		label,
		camera: 'top',
		cameraLayer: false,
		debug: true,
		level: true,
		captureKeys: true,
		layer,
		main: ['debug', 'select', 'camera'],
		context: ['snap', 'grid', ...tools, 'undo', 'redo'],
	};
}

export const HARNESS_SLOT_LABELS: Record<HarnessSlotId, string> = {
	navmesh: 'Navigation brush',
	decal: 'Environment decal',
	edge: 'Edge',
	face: 'Face',
	shear: 'Shear',
	'uv-brush': 'UV brush',
	splat: 'Splat',
	'directional-vector': 'Directional vector',
	'obstacle-brush': 'Obstacle brush',
	'place-hud': 'Place HUD',
	'bind-variable': 'Bind variable',
	geometry: 'Geometry',
	collision: 'Collision',
};

export function isHarnessSlot(action: string): action is HarnessSlotId {
	return Object.hasOwn(HARNESS_SLOT_LABELS, action);
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

	if (profile.level && profile.layer) {
		if (levelState.active) setActiveLayer(profile.layer);
		else levelState.activeLayer = profile.layer;
	}
	setLevelEditorActive(profile.level);
	releaseArmedToolOutside(profile.context);
}

/**
 * The toolbar action the current tool corresponds to.
 *
 * Select and the idle tool have no context button, so they stay put when the
 * mode changes. Add maps through the armed placement: a spawn is not the stage
 * Add button.
 */
function armedContextAction(): HarnessContextAction | null {
	const tool = debugState.tool;
	switch (tool) {
		case 'brush':
			return 'draw-brush';
		case 'clip':
			return 'clip-brush';
		case 'shear':
			return 'shear';
		case 'translate':
		case 'rotate':
		case 'scale':
		case 'delete':
			return tool;
		case 'add': {
			const kind = levelState.placement?.kind;
			if (kind === 'spawn') return 'add-spawn';
			if (kind === 'trigger') return 'add-trigger';
			if (kind === 'doodad') return 'add-doodad';
			return 'add-object';
		}
		default:
			return null;
	}
}

/** Return to Select when the armed tool is absent from the mode being applied. */
function releaseArmedToolOutside(context: readonly HarnessContextAction[] | null): void {
	if (!context) return;
	const armed = armedContextAction();
	if (!armed || context.includes(armed)) return;
	setDebugTool('select');
	sendTool('select');
	setLevelPlacement(null);
}
