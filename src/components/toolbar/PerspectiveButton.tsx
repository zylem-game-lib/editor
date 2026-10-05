import { Perspective, ToolbarButton } from '@zylem/ui/components';
import type { Component } from 'solid-js';
import { togglePerspective, viewStore } from './view-state';

/** Perspective layer. Shows the camera buttons; it does not replace Select. */
export const PerspectiveButton: Component = () => (
	<ToolbarButton
		label={viewStore.perspective ? 'Perspective on' : 'Perspective'}
		selected={viewStore.perspective}
		onClick={togglePerspective}
	>
		<Perspective />
	</ToolbarButton>
);
