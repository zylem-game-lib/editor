/**
 * Editor camera view.
 *
 * Game is the camera the game is already rendering. Side, top, and isometric
 * are locked orthographic cameras; free is a perspective orbit camera.
 * Holding Space borrows free and gives the latched camera back on release.
 * `connectViewState` sends `camera:activate` only after the latch changes, so
 * attaching the editor leaves the game camera in place.
 */

import { EDITOR_CAMERAS, GAME_CAMERA_ID } from '@zylem/bridge';
import { proxy, subscribe } from 'valtio/vanilla';
import { sendCameraActivate } from '../../bridge/commands';
import { mirrorProxy } from '../common/proxy-mirror';

export type ViewPreset = 'game' | 'side' | 'top' | 'isometric' | 'free';

const CAMERA_IDS: Record<ViewPreset, string> = {
	game: GAME_CAMERA_ID,
	side: EDITOR_CAMERAS.side,
	top: EDITOR_CAMERAS.top,
	isometric: EDITOR_CAMERAS.isometric,
	free: EDITOR_CAMERAS.free,
};

/** Bridge id for a toolbar camera. */
export function cameraIdForPreset(preset: ViewPreset): string {
	return CAMERA_IDS[preset];
}

export interface ViewState {
	/** Perspective layer. Off hides the camera buttons; it does not change the camera. */
	perspective: boolean;
	/** Camera restored when Space is released. */
	preset: ViewPreset;
	spaceHeld: boolean;
}

export const viewState = proxy<ViewState>({
	perspective: false,
	preset: 'game',
	spaceHeld: false,
});

/** Solid-reactive view of {@link viewState}. */
export const viewStore = mirrorProxy(viewState);

/** The camera the view is using right now. Space wins over the latched one. */
export function effectiveViewPreset(preset: ViewPreset, spaceHeld: boolean): ViewPreset {
	return spaceHeld ? 'free' : preset;
}

export function togglePerspective(): void {
	viewState.perspective = !viewState.perspective;
}

export function setViewPreset(preset: ViewPreset): void {
	viewState.preset = preset;
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
