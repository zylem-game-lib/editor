import { ToolbarButton } from '@zylem/ui/components';
import View from 'lucide-solid/icons/view';
import type { Component } from 'solid-js';
import { togglePerspective, viewStore } from './view-state';

/** Perspective layer. Shows the camera presets; it does not replace Select. */
export const PerspectiveButton: Component = () => (
	<ToolbarButton
		label={viewStore.perspective ? 'Perspective on' : 'Perspective'}
		selected={viewStore.perspective}
		onClick={togglePerspective}
	>
		<View class="zylem-icon" />
	</ToolbarButton>
);
