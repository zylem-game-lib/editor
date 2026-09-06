import Box from 'lucide-solid/icons/box';
import GhostIcon from 'lucide-solid/icons/ghost';
import Globe from 'lucide-solid/icons/globe';
import Grid3x3 from 'lucide-solid/icons/grid-3x3';
import PersonStanding from 'lucide-solid/icons/person-standing';
import Square from 'lucide-solid/icons/square';
import SquareDashed from 'lucide-solid/icons/square-dashed';
import Torus from 'lucide-solid/icons/torus';
import Type from 'lucide-solid/icons/type';
import type { Component } from 'solid-js';

/**
 * Map entity type strings to lucide-solid icons.
 * Used as a fallback when a thumbnail preview is unavailable.
 */
const ICON_MAP: Record<string, Component<{ class?: string }>> = {
	Box: Box as Component<{ class?: string }>,
	Sphere: Globe as Component<{ class?: string }>,
	Disk: Torus as Component<{ class?: string }>,
	Sprite: GhostIcon as Component<{ class?: string }>,
	Actor: PersonStanding as Component<{ class?: string }>,
	Text: Type as Component<{ class?: string }>,
	Rect: Square as Component<{ class?: string }>,
	Plane: Grid3x3 as Component<{ class?: string }>,
	Zone: SquareDashed as Component<{ class?: string }>,
};

export interface EntityIconProps {
	type: string;
	class?: string;
}

/**
 * Renders an icon based on entity type.
 * Falls back to Box icon for unknown types.
 */
export const EntityIcon: Component<EntityIconProps> = (props) => {
	const IconComponent = ICON_MAP[props.type] ?? Box;
	return <IconComponent class={props.class ?? 'entity-icon'} />;
};
