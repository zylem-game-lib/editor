import { ToolbarButton } from '@zylem/ui/components';
import Box from 'lucide-solid/icons/box';
import Crosshair from 'lucide-solid/icons/crosshair';
import Scissors from 'lucide-solid/icons/scissors';
import Spline from 'lucide-solid/icons/spline';
import SquareDashed from 'lucide-solid/icons/square-dashed';
import type { Component } from 'solid-js';
import { debugStore } from '..';
import { levelStore } from '../level/level-state';
import { armSolidTool, armSpawnTool, armTriggerTool } from './toolbar-actions';

/** Draw a grid-snapped box in the Top or Side view. */
export const DrawBrushButton: Component = () => (
	<ToolbarButton
		label="Draw brush. Top or Side view; the third axis is one grid step."
		selected={debugStore.tool === 'brush'}
		onClick={() => armSolidTool('brush')}
	>
		<Box class="zylem-icon" />
	</ToolbarButton>
);

/** Split the selected brush with two clicks. */
export const ClipBrushButton: Component = () => (
	<ToolbarButton
		label="Clip the selected brush. Two clicks in the Top or Side view."
		selected={debugStore.tool === 'clip'}
		disabled={levelStore.selectedIds.length === 0}
		onClick={() => armSolidTool('clip')}
	>
		<Scissors class="zylem-icon" />
	</ToolbarButton>
);

/** Drag one corner of the selected brush. A move that breaks the solid is rejected. */
export const VertexBrushButton: Component = () => (
	<ToolbarButton
		label="Vertex. A move that breaks the solid snaps back."
		selected={debugStore.tool === 'vertex'}
		disabled={levelStore.selectedIds.length === 0}
		onClick={() => armSolidTool('vertex')}
	>
		<Spline class="zylem-icon" />
	</ToolbarButton>
);

/** Place a player, enemy, or item marker. The kind is edited in the level panel. */
export const AddSpawnButton: Component = () => (
	<ToolbarButton
		label="Add spawn"
		selected={debugStore.tool === 'add' && levelStore.placement?.kind === 'spawn'}
		onClick={() => armSpawnTool()}
	>
		<Crosshair class="zylem-icon" />
	</ToolbarButton>
);

/** Place a named trigger volume. Callbacks stay in game code, bound by that name. */
export const AddTriggerButton: Component = () => (
	<ToolbarButton
		label="Add trigger"
		selected={debugStore.tool === 'add' && levelStore.placement?.kind === 'trigger'}
		onClick={() => armTriggerTool()}
	>
		<SquareDashed class="zylem-icon" />
	</ToolbarButton>
);
