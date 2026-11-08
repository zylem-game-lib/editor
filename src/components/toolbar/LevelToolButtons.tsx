import { ToolbarButton, ToolbarDropdownMenu } from '@zylem/ui/components';
import Box from 'lucide-solid/icons/box';
import Circle from 'lucide-solid/icons/circle';
import Crosshair from 'lucide-solid/icons/crosshair';
import Cylinder from 'lucide-solid/icons/cylinder';
import Pyramid from 'lucide-solid/icons/pyramid';
import Scissors from 'lucide-solid/icons/scissors';
import Spline from 'lucide-solid/icons/spline';
import SquareDashed from 'lucide-solid/icons/square-dashed';
import Torus from 'lucide-solid/icons/torus';
import { type Component, createSignal } from 'solid-js';
import { debugStore } from '..';
import { debugState } from '../entities/entities-state';
import { levelState, levelStore } from '../level/level-state';
import { armSolidTool, armSpawnTool, armTriggerTool, returnToSelect } from './toolbar-actions';

const MESH_SHAPES = [
	{ id: 'box', label: 'Box', icon: Box },
	{ id: 'wedge', label: 'Wedge', icon: Pyramid },
	{ id: 'cylinder', label: 'Cylinder', icon: Cylinder },
	{ id: 'arch', label: 'Arch', icon: Torus },
] as const;

const TRIGGER_SHAPES = [
	{ id: 'box', label: 'Box', icon: SquareDashed },
	{ id: 'sphere', label: 'Sphere', icon: Circle },
	{ id: 'cylinder', label: 'Cylinder', icon: Cylinder },
] as const;

const [meshShape, setMeshShape] = createSignal<(typeof MESH_SHAPES)[number]['id']>('box');
const [triggerShape, setTriggerShape] = createSignal<(typeof TRIGGER_SHAPES)[number]['id']>('box');

/**
 * Mesh brush. Box draws the existing grid-snapped solid. The other shapes are
 * listed and remembered, and they do not arm a tool.
 */
export const MeshBrushMenu: Component = () => (
	<ToolbarDropdownMenu
		items={MESH_SHAPES}
		value={meshShape()}
		onChange={(id) => {
			const shape = id as (typeof MESH_SHAPES)[number]['id'];
			setMeshShape(shape);
			if (shape === 'box') {
				armSolidTool('brush');
				return;
			}
			if (debugState.tool === 'brush') returnToSelect();
		}}
	/>
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
		label="Spawn point"
		selected={debugStore.tool === 'add' && levelStore.placement?.kind === 'spawn'}
		onClick={() => armSpawnTool()}
	>
		<Crosshair class="zylem-icon" />
	</ToolbarButton>
);

/**
 * Trigger point. Box places the current cube volume. Sphere and Cylinder are
 * listed and remembered, and they do not arm a tool.
 */
export const TriggerMenu: Component = () => (
	<ToolbarDropdownMenu
		items={TRIGGER_SHAPES}
		value={triggerShape()}
		onChange={(id) => {
			const shape = id as (typeof TRIGGER_SHAPES)[number]['id'];
			setTriggerShape(shape);
			if (shape === 'box') {
				armTriggerTool();
				return;
			}
			if (debugState.tool === 'add' && levelState.placement?.kind === 'trigger') {
				returnToSelect();
			}
		}}
	/>
);
