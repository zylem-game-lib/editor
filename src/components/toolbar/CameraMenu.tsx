import { CameraToggle } from '@zylem/ui/components';
import type { Component } from 'solid-js';
import {
	effectiveViewPreset,
	presetForToggle,
	setViewPreset,
	toggleEditorCamera,
	toggleIdForPreset,
	viewStore,
} from './view-state';

/**
 * One camera button. The face is the current view and turns the editor camera
 * on and off; the cube picks another. On while an editor camera is showing.
 */
export const CameraMenu: Component = () => {
	const current = () => effectiveViewPreset(viewStore.preset, viewStore.spaceHeld);
	return (
		<CameraToggle
			value={toggleIdForPreset(current())}
			on={current() !== 'game'}
			onAction={toggleEditorCamera}
			onChange={(id) => setViewPreset(presetForToggle(id))}
		/>
	);
};
