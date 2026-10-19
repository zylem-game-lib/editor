import { Perspective, ToolbarButton } from '@zylem/ui/components';
import type { Component } from 'solid-js';
import { toggleCamera, viewStore } from './view-state';

/** Camera layer. Shows the camera buttons; it does not replace Select. */
export const CameraButton: Component = () => (
	<ToolbarButton
		label={viewStore.camera ? 'Camera on' : 'Camera'}
		selected={viewStore.camera}
		onClick={toggleCamera}
	>
		<Perspective />
	</ToolbarButton>
);
