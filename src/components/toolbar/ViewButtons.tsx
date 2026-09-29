import { ToolbarButton } from '@zylem/ui/components';
import Box from 'lucide-solid/icons/box';
import Camera from 'lucide-solid/icons/camera';
import LayerArrowDown from 'lucide-solid/icons/layer-arrow-down';
import SquareArrowRightEnter from 'lucide-solid/icons/square-arrow-right-enter';
import type { Component, JSX } from 'solid-js';
import {
	effectiveViewPreset,
	setViewPreset,
	type ViewPreset,
	viewStore,
} from './view-state';

interface ViewPresetButtonProps {
	preset: ViewPreset;
	label: string;
	children: JSX.Element;
}

/**
 * Latches a camera preset. While Space is held the effective preset is custom,
 * so only that button reads as selected until the key comes up.
 */
const ViewPresetButton: Component<ViewPresetButtonProps> = (props) => (
	<ToolbarButton
		label={props.label}
		selected={
			effectiveViewPreset(viewStore.preset, viewStore.spaceHeld) ===
			props.preset
		}
		onClick={() => setViewPreset(props.preset)}
	>
		{props.children}
	</ToolbarButton>
);

export const TopViewButton: Component = () => (
	<ViewPresetButton preset="top" label="Top">
		<LayerArrowDown class="zylem-icon" />
	</ViewPresetButton>
);

export const SideViewButton: Component = () => (
	<ViewPresetButton preset="side" label="Side">
		<SquareArrowRightEnter class="zylem-icon" />
	</ViewPresetButton>
);

export const IsometricViewButton: Component = () => (
	<ViewPresetButton preset="isometric" label="Isometric">
		<Box class="zylem-icon" />
	</ViewPresetButton>
);

export const CustomViewButton: Component = () => (
	<ViewPresetButton preset="custom" label="Custom camera">
		<Camera class="zylem-icon" />
	</ViewPresetButton>
);
