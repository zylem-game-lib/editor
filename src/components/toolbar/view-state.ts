/**
 * Editor camera view.
 *
 * Top, side, and isometric keep a fixed rotation; custom is free rotation.
 * Holding Space borrows custom and gives the latched preset back on release.
 * `connectViewState` mirrors the effective preset to the game on `camera:view:set`.
 */

import type { CameraViewPreset } from '@zylem/bridge';
import { proxy, subscribe } from 'valtio/vanilla';
import { sendCameraView } from '../../bridge/commands';
import { mirrorProxy } from '../common/proxy-mirror';

export type ViewPreset = CameraViewPreset;

export interface ViewState {
	/** Perspective layer. Off hides the preset buttons; it does not change the preset. */
	perspective: boolean;
	/** Preset restored when Space is released. */
	preset: ViewPreset;
	spaceHeld: boolean;
}

export const viewState = proxy<ViewState>({
	perspective: false,
	preset: 'top',
	spaceHeld: false,
});

/** Solid-reactive view of {@link viewState}. */
export const viewStore = mirrorProxy(viewState);

/** The preset the camera is using right now. Space wins over the latched one. */
export function effectiveViewPreset(preset: ViewPreset, spaceHeld: boolean): ViewPreset {
	return spaceHeld ? 'custom' : preset;
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
 * Mirror the effective view preset to the game, and push the current value
 * once so a game that started unlocked matches the toolbar.
 *
 * @returns An unsubscribe function.
 */
export function connectViewState(): () => void {
	if (viewStateConnected) return () => {};
	viewStateConnected = true;

	let last = effectiveViewPreset(viewState.preset, viewState.spaceHeld);
	sendCameraView(last);

	const unsubscribe = subscribe(viewState, () => {
		const next = effectiveViewPreset(viewState.preset, viewState.spaceHeld);
		if (next === last) return;
		last = next;
		sendCameraView(next);
	});

	return () => {
		viewStateConnected = false;
		unsubscribe();
	};
}
