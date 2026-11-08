import type { BrushShape } from '@zylem/bridge';
import { ToolbarButton, ToolbarDropdownMenu } from '@zylem/ui/components';
import Box from 'lucide-solid/icons/box';
import Circle from 'lucide-solid/icons/circle';
import Copy from 'lucide-solid/icons/copy';
import Crosshair from 'lucide-solid/icons/crosshair';
import Cylinder from 'lucide-solid/icons/cylinder';
import Grid2x2 from 'lucide-solid/icons/grid-2x2';
import Pyramid from 'lucide-solid/icons/pyramid';
import Scissors from 'lucide-solid/icons/scissors';
import Spline from 'lucide-solid/icons/spline';
import SplinePointer from 'lucide-solid/icons/spline-pointer';
import Square from 'lucide-solid/icons/square';
import SquareDashed from 'lucide-solid/icons/square-dashed';
import Torus from 'lucide-solid/icons/torus';
import Trash from 'lucide-solid/icons/trash';
import UnfoldHorizontal from 'lucide-solid/icons/unfold-horizontal';
import { type Component, createSignal, type JSX } from 'solid-js';
import { debugStore } from '..';
import { debugState } from '../entities/entities-state';
import {
	deleteLevelSelection,
	levelState,
	levelStore,
	subdivideLevelSelection,
} from '../level/level-state';
import {
	canClip,
	canShear,
	isBrushArmed,
	isTriggerArmed,
	selectionHasSolid,
} from './level-tool-state';
import {
	armBrushShape,
	armSpawnTool,
	armTriggerTool,
	duplicateSelection,
	type ElementMode,
	returnToSelect,
	toggleBrushTool,
	toggleClipTool,
	toggleElementMode,
	toggleShearTool,
} from './toolbar-actions';
import { type ToolbarShortcutId, withShortcut } from './toolbar-shortcuts';

const MESH_SHAPES: ReadonlyArray<{
	id: BrushShape;
	label: string;
	icon: Component<{ class?: string }>;
}> = [
	{ id: 'box', label: 'Box', icon: Box },
	{ id: 'wedge', label: withShortcut('Wedge. Turn it', 'turnWedge'), icon: Pyramid },
	{ id: 'cylinder', label: 'Cylinder', icon: Cylinder },
	{ id: 'arch', label: 'Arch', icon: Torus },
];

const TRIGGER_SHAPES = [
	{ id: 'box', label: 'Box', icon: SquareDashed },
	{ id: 'sphere', label: 'Sphere', icon: Circle },
	{ id: 'cylinder', label: 'Cylinder', icon: Cylinder },
] as const;

const [triggerShape, setTriggerShape] = createSignal<(typeof TRIGGER_SHAPES)[number]['id']>('box');

/**
 * Mesh brush. Picking a shape arms the brush with it; the face arms the
 * current shape or disarms, and is lit only while the brush is armed.
 */
export const MeshBrushMenu: Component = () => (
	<ToolbarDropdownMenu
		items={MESH_SHAPES}
		value={levelStore.drawShape.shape}
		selected={isBrushArmed(debugStore.tool)}
		onAction={toggleBrushTool}
		onChange={(id) => {
			const shape = MESH_SHAPES.find((item) => item.id === id);
			if (shape) armBrushShape(shape.id);
		}}
	/>
);

/** Split the selected brushes. */
export const ClipBrushButton: Component = () => (
	<ToolbarButton
		label={withShortcut('Clip the selected brushes', 'clip')}
		selected={debugStore.tool === 'clip'}
		disabled={!canClip(debugStore.tool, levelStore.document, levelStore.selectedIds)}
		onClick={() => toggleClipTool()}
	>
		<Scissors class="zylem-icon" />
	</ToolbarButton>
);

interface ElementModeButtonProps {
	mode: ElementMode;
	label: string;
	shortcut: ToolbarShortcutId;
	children: JSX.Element;
}

/** Pick vertices, edges, or faces. Pressed while lit, it goes back to whole objects. */
const ElementModeButton: Component<ElementModeButtonProps> = (props) => {
	const active = () => levelStore.elementMode === props.mode;
	const label = () => {
		const own = withShortcut(props.label, props.shortcut);
		return active() ? `${own}. ${withShortcut('Back to objects', 'objectMode')}` : own;
	};
	return (
		<ToolbarButton
			label={label()}
			selected={active()}
			onClick={() => toggleElementMode(props.mode)}
		>
			{props.children}
		</ToolbarButton>
	);
};

export const VertexModeButton: Component = () => (
	<ElementModeButton mode="vertex" label="Vertex" shortcut="vertexMode">
		<Spline class="zylem-icon" />
	</ElementModeButton>
);

export const EdgeModeButton: Component = () => (
	<ElementModeButton mode="edge" label="Edge" shortcut="edgeMode">
		<SplinePointer class="zylem-icon" />
	</ElementModeButton>
);

export const FaceModeButton: Component = () => (
	<ElementModeButton mode="face" label="Face" shortcut="faceMode">
		<Square class="zylem-icon" />
	</ElementModeButton>
);

/** Slide the selected faces within their own planes. A shear that breaks a solid snaps back. */
export const ShearBrushButton: Component = () => (
	<ToolbarButton
		label="Shear the selected faces"
		selected={debugStore.tool === 'shear'}
		disabled={!canShear(debugStore.tool, levelStore.elementMode, levelStore.selectedElements)}
		onClick={() => toggleShearTool()}
	>
		<UnfoldHorizontal class="zylem-icon" />
	</ToolbarButton>
);

/** Cut the selected brushes on the subdivide grid set in the level panel. */
export const SubdivideBrushButton: Component = () => (
	<ToolbarButton
		label={`Subdivide the selected brushes into ${levelStore.subdivideTile}-unit tiles`}
		disabled={!selectionHasSolid(levelStore.document, levelStore.selectedIds)}
		onClick={() => subdivideLevelSelection()}
	>
		<Grid2x2 class="zylem-icon" />
	</ToolbarButton>
);

/** Copy the level selection one snap step along +X. */
export const DuplicateSelectionButton: Component = () => (
	<ToolbarButton
		label={withShortcut('Duplicate', 'duplicate')}
		disabled={levelStore.selectedIds.length === 0}
		onClick={() => duplicateSelection()}
	>
		<Copy class="zylem-icon" />
	</ToolbarButton>
);

/** Remove the whole level selection in one undo step. */
export const DeleteSelectionButton: Component = () => (
	<ToolbarButton
		label="Delete the selection"
		danger
		disabled={levelStore.selectedIds.length === 0}
		onClick={() => deleteLevelSelection()}
	>
		<Trash class="zylem-icon" />
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
 * listed and remembered, and they do not arm a tool. The face is lit only
 * while a trigger is armed.
 */
export const TriggerMenu: Component = () => (
	<ToolbarDropdownMenu
		items={TRIGGER_SHAPES}
		value={triggerShape()}
		selected={isTriggerArmed(debugStore.tool, levelStore.placement)}
		onChange={(id) => {
			const shape = id as (typeof TRIGGER_SHAPES)[number]['id'];
			setTriggerShape(shape);
			if (shape === 'box') {
				armTriggerTool();
				return;
			}
			if (isTriggerArmed(debugState.tool, levelState.placement)) returnToSelect();
		}}
	/>
);
