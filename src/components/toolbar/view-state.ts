/**
 * Editor camera view.
 *
 * Game is the camera the game is already rendering. The cube's edges and
 * corners are locked orthographic cameras. Perspective is a locked perspective
 * camera, and free orbits. Holding Space borrows free and gives the latched
 * camera back on release. `connectViewState` sends `camera:activate` only
 * after the latch changes, so attaching the editor leaves the game camera in
 * place.
 *
 * Right and iso right/top keep the original `side` and `isometric` presets,
 * so the cameras already in use do not move.
 */

import { EDITOR_CAMERAS, GAME_CAMERA_ID } from '@zylem/bridge';
import type { CameraToggleId } from '@zylem/ui/components';
import { proxy, subscribe } from 'valtio/vanilla';
import { sendCameraActivate } from '../../bridge/commands';
import { mirrorProxy } from '../common/proxy-mirror';

export type ViewPreset =
	| 'game'
	| 'perspective'
	| 'free'
	| 'left'
	| 'side'
	| 'top'
	| 'bottom'
	| 'iso-left-top'
	| 'isometric'
	| 'iso-right-bottom'
	| 'iso-left-bottom';
/** The cameras the editor drives, as opposed to the one the game renders. */
export type EditorViewPreset = Exclude<ViewPreset, 'game'>;

const CAMERA_IDS: Record<ViewPreset, string> = {
	game: GAME_CAMERA_ID,
	perspective: EDITOR_CAMERAS.perspective,
	free: EDITOR_CAMERAS.free,
	left: EDITOR_CAMERAS.left,
	side: EDITOR_CAMERAS.side,
	top: EDITOR_CAMERAS.top,
	bottom: EDITOR_CAMERAS.bottom,
	'iso-left-top': EDITOR_CAMERAS.isoLeftTop,
	isometric: EDITOR_CAMERAS.isometric,
	'iso-right-bottom': EDITOR_CAMERAS.isoRightBottom,
	'iso-left-bottom': EDITOR_CAMERAS.isoLeftBottom,
};

/** Cube cell for a preset. Right and iso right/top reuse the original presets. */
const TOGGLE_IDS: Record<ViewPreset, CameraToggleId> = {
	game: 'game',
	perspective: 'perspective',
	free: 'free',
	left: 'left',
	side: 'right',
	top: 'top',
	bottom: 'bottom',
	'iso-left-top': 'iso-left-top',
	isometric: 'iso-right-top',
	'iso-right-bottom': 'iso-right-bottom',
	'iso-left-bottom': 'iso-left-bottom',
};

const PRESETS: Record<CameraToggleId, ViewPreset> = {
	game: 'game',
	perspective: 'perspective',
	free: 'free',
	left: 'left',
	right: 'side',
	top: 'top',
	bottom: 'bottom',
	'iso-left-top': 'iso-left-top',
	'iso-right-top': 'isometric',
	'iso-left-bottom': 'iso-left-bottom',
	'iso-right-bottom': 'iso-right-bottom',
};

/** Preset a cube cell latches. */
export function presetForToggle(id: CameraToggleId): ViewPreset {
	return PRESETS[id];
}

/** Cube cell showing a preset. */
export function toggleIdForPreset(preset: ViewPreset): CameraToggleId {
	return TOGGLE_IDS[preset];
}

/** Bridge id for a toolbar camera. */
export function cameraIdForPreset(preset: ViewPreset): string {
	return CAMERA_IDS[preset];
}

export interface ViewState {
	/** Camera layer. Off hides the camera buttons; it does not change the camera. */
	camera: boolean;
	/** Camera restored when Space is released. */
	preset: ViewPreset;
	/** The editor camera the Camera button turns back on. */
	editorPreset: EditorViewPreset;
	spaceHeld: boolean;
}

export const viewState = proxy<ViewState>({
	camera: false,
	preset: 'game',
	editorPreset: 'free',
	spaceHeld: false,
});

/** Solid-reactive view of {@link viewState}. */
export const viewStore = mirrorProxy(viewState);

/** The camera the view is using right now. Space wins over the latched one. */
export function effectiveViewPreset(preset: ViewPreset, spaceHeld: boolean): ViewPreset {
	return spaceHeld ? 'free' : preset;
}

export function setViewPreset(preset: ViewPreset): void {
	viewState.preset = preset;
	if (preset !== 'game') viewState.editorPreset = preset;
}

/** Switch between the game camera and the editor camera used last. */
export function toggleEditorCamera(): void {
	setViewPreset(viewState.preset === 'game' ? viewState.editorPreset : 'game');
}

export function setSpaceHeld(held: boolean): void {
	viewState.spaceHeld = held;
}

let viewStateConnected = false;

/**
 * Mirror camera changes to the game. The camera already rendering at connect
 * time is the game camera, so the current latch is not sent until it changes.
 *
 * @returns An unsubscribe function.
 */
export function connectViewState(): () => void {
	if (viewStateConnected) return () => {};
	viewStateConnected = true;

	let last = effectiveViewPreset(viewState.preset, viewState.spaceHeld);

	const unsubscribe = subscribe(viewState, () => {
		const next = effectiveViewPreset(viewState.preset, viewState.spaceHeld);
		if (next === last) return;
		last = next;
		sendCameraActivate(cameraIdForPreset(next));
	});

	return () => {
		viewStateConnected = false;
		unsubscribe();
	};
}
