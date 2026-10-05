import {
	FreePerspective,
	GameCamera,
	IsometricPerspective,
	SideviewPerspective,
	ToolbarButton,
	TopDownPerspective,
} from '@zylem/ui/components';
import type { Component } from 'solid-js';
import { effectiveViewPreset, setViewPreset, type ViewPreset, viewStore } from './view-state';

interface ViewPresetButtonProps {
	preset: ViewPreset;
	label: string;
	icon: Component<{ class?: string }>;
}

/**
 * Latches a camera. While Space is held the effective camera is free, so only
 * that button reads as selected until the key comes up.
 */
const ViewPresetButton: Component<ViewPresetButtonProps> = (props) => {
	const Icon = props.icon;
	return (
		<ToolbarButton
			label={props.label}
			selected={effectiveViewPreset(viewStore.preset, viewStore.spaceHeld) === props.preset}
			onClick={() => setViewPreset(props.preset)}
		>
			<Icon />
		</ToolbarButton>
	);
};

export const GameViewButton: Component = () => (
	<ViewPresetButton preset="game" label="Game camera" icon={GameCamera} />
);

export const TopViewButton: Component = () => (
	<ViewPresetButton preset="top" label="Top" icon={TopDownPerspective} />
);

export const SideViewButton: Component = () => (
	<ViewPresetButton preset="side" label="Side" icon={SideviewPerspective} />
);

export const IsometricViewButton: Component = () => (
	<ViewPresetButton preset="isometric" label="Isometric" icon={IsometricPerspective} />
);

export const FreeViewButton: Component = () => (
	<ViewPresetButton preset="free" label="Free camera" icon={FreePerspective} />
);
