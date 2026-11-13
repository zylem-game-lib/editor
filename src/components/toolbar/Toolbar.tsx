import { Toolbar as CommandStrip, Separator, ToolbarButton } from '@zylem/ui/components';
import Box from 'lucide-solid/icons/box';
import BrickWall from 'lucide-solid/icons/brick-wall';
import Image from 'lucide-solid/icons/image';
import Link from 'lucide-solid/icons/link';
import MapIcon from 'lucide-solid/icons/map';
import MoveRight from 'lucide-solid/icons/move-right';
import Paintbrush from 'lucide-solid/icons/paintbrush';
import RectangleHorizontal from 'lucide-solid/icons/rectangle-horizontal';
import Shield from 'lucide-solid/icons/shield';
import SprayCan from 'lucide-solid/icons/spray-can';
import { type Component, createContext, For, Show, useContext } from 'solid-js';
import {
	HARNESS_SLOT_LABELS,
	type HarnessContextAction,
	type HarnessMainAction,
	type HarnessSlotId,
	harnessModeProfile,
	harnessModeStore,
	isHarnessSlot,
} from '../../dev/harness-modes';
import { debugStore } from '../editor-store';
import { levelStore } from '../level/level-state';
import { armNavigationTool, bakeNavigation, navigationStore } from '../navigation/navigation-state';
import { saveStore } from '../save/save-state';
import { AddButton } from './AddButton';
import { BuildButton } from './BuildButton';
import { CameraMenu } from './CameraMenu';
import { contextActionStartsGroup, contextToolbarActions } from './context-actions';
import { DebugButton } from './DebugButton';
import { DeleteButton } from './DeleteButton';
import { GridButton, SnapButton } from './GridButton';
import { RedoButton, UndoButton } from './HistoryButtons';
import {
	AddSpawnButton,
	ClipBrushButton,
	DeleteSelectionButton,
	DuplicateSelectionButton,
	EdgeModeButton,
	FaceModeButton,
	MeshBrushMenu,
	ShearBrushButton,
	SubdivideBrushButton,
	TriggerMenu,
	VertexModeButton,
} from './LevelToolButtons';
import { PanelsButton } from './PanelsButton';
import { PlayPauseButton } from './PlayPauseButton';
import { SaveButton } from './SaveButton';
import { SelectButton } from './SelectButton';
import { RotateButton, ScaleButton, TranslateButton } from './TransformButtons';
import { toolbarModeFor } from './toolbar-mode';
import {
	FreeViewButton,
	GameViewButton,
	IsometricViewButton,
	SideViewButton,
	TopViewButton,
} from './ViewButtons';
import { viewStore } from './view-state';

const DEFAULT_MAIN: readonly HarnessMainAction[] = ['select', 'build', 'camera', 'debug', 'play'];

const mainActions = (): readonly HarnessMainAction[] => {
	const id = harnessModeStore.id;
	if (!id) return DEFAULT_MAIN;
	return harnessModeProfile(id).main ?? DEFAULT_MAIN;
};

/** Whether the strip runs down the screen. A rule between groups turns with it. */
const StripIsVertical = createContext<() => boolean>(() => false);

/** The rule between two groups of tools, across the strip's direction. */
const Rule: Component = () => {
	const vertical = useContext(StripIsVertical);
	return <Separator orientation={vertical() ? 'horizontal' : 'vertical'} />;
};

/** First in every mode except Game Preview, which hides Save. */
const SaveGroup: Component = () => (
	<Show when={saveStore.enabled && harnessModeStore.id !== 'game-preview'}>
		<SaveButton />
		<Show when={mainActions().length > 0}>
			<Rule />
		</Show>
	</Show>
);

const MainActionButton: Component<{ action: HarnessMainAction }> = (props) => {
	switch (props.action) {
		case 'select':
			return <SelectButton />;
		case 'build':
			return <BuildButton />;
		case 'camera':
			return <CameraMenu />;
		case 'debug':
			return <DebugButton />;
		case 'play':
			return <PlayPauseButton />;
	}
};

export interface MainToolbarProps {
	panelsOpen: boolean;
	onTogglePanels: () => void;
}

/** Exclusive editing stays Select. The other main buttons are layers or session toggles. */
export const MainToolbar: Component<MainToolbarProps> = (props) => {
	return (
		<>
			<For each={mainActions()}>{(action) => <MainActionButton action={action} />}</For>
			<Show when={mainActions().length > 0}>
				<PanelsButton open={props.panelsOpen} onToggle={props.onTogglePanels} />
			</Show>
		</>
	);
};

const ContextActionButton: Component<{ action: HarnessContextAction }> = (props) => {
	if (isHarnessSlot(props.action)) {
		if (props.action === 'navmesh')
			return (
				<ToolbarButton
					label="Bake navmesh"
					disabled={navigationStore.state === 'building'}
					onClick={bakeNavigation}
				>
					<MapIcon class="zylem-icon" />
				</ToolbarButton>
			);
		if (props.action === 'directional-vector')
			return (
				<ToolbarButton
					label="Traversal link"
					selected={navigationStore.tool === 'link'}
					onClick={() => armNavigationTool('link')}
				>
					<MoveRight class="zylem-icon" />
				</ToolbarButton>
			);
		if (props.action === 'obstacle-brush')
			return (
				<ToolbarButton
					label="Obstacle volume"
					selected={navigationStore.tool === 'obstacle'}
					onClick={() => armNavigationTool('obstacle')}
				>
					<BrickWall class="zylem-icon" />
				</ToolbarButton>
			);
		return <HarnessSlotButton slot={props.action} />;
	}
	switch (props.action) {
		case 'translate':
			return <TranslateButton />;
		case 'rotate':
			return <RotateButton />;
		case 'scale':
			return <ScaleButton />;
		case 'view-game':
			return <GameViewButton />;
		case 'view-side':
			return <SideViewButton />;
		case 'view-top':
			return <TopViewButton />;
		case 'view-isometric':
			return <IsometricViewButton />;
		case 'view-free':
			return <FreeViewButton />;
		case 'grid':
			return <GridButton />;
		case 'draw-brush':
			return <MeshBrushMenu />;
		case 'clip-brush':
			return <ClipBrushButton />;
		case 'vertex-brush':
			return <VertexModeButton />;
		case 'edge-brush':
			return <EdgeModeButton />;
		case 'face-brush':
			return <FaceModeButton />;
		case 'shear-brush':
			return <ShearBrushButton />;
		case 'subdivide-brush':
			return <SubdivideBrushButton />;
		case 'duplicate-selection':
			return <DuplicateSelectionButton />;
		case 'delete-selection':
			return <DeleteSelectionButton />;
		case 'add-doodad':
			return <AddButton label="Add doodad" />;
		case 'add-object':
			return <AddButton label="Add object" />;
		case 'add-spawn':
			return <AddSpawnButton />;
		case 'add-trigger':
			return <TriggerMenu />;
		case 'delete':
			return <DeleteButton />;
		case 'snap':
			return <SnapButton />;
		case 'undo':
			return <UndoButton />;
		case 'redo':
			return <RedoButton />;
	}
};

const SLOT_ICONS: Record<HarnessSlotId, Component<{ class?: string }>> = {
	navmesh: MapIcon,
	decal: Image,
	'uv-brush': Paintbrush,
	splat: SprayCan,
	'directional-vector': MoveRight,
	'obstacle-brush': BrickWall,
	'place-hud': RectangleHorizontal,
	'bind-variable': Link,
	geometry: Box,
	collision: Shield,
};

/** A mode tool that is named on the toolbar and does not change the scene yet. */
const HarnessSlotButton: Component<{ slot: HarnessSlotId }> = (props) => {
	const Icon = SLOT_ICONS[props.slot];
	return (
		<ToolbarButton label={HARNESS_SLOT_LABELS[props.slot]}>
			<Icon class="zylem-icon" />
		</ToolbarButton>
	);
};

function actionStartsGroup(action: HarnessContextAction): boolean {
	// Stage Editor keeps Snap with the gizmos, then groups Add and Undo.
	if (harnessModeStore.id === 'stage-editor') {
		return action === 'add-object' || action === 'undo';
	}
	// Level Builder: grid, then the mode's tools, then undo. Mesh and Decoration
	// also group Move with Rotate and Scale.
	if (harnessModeStore.id === 'level-builder-mesh') {
		return action === 'draw-brush' || action === 'translate' || action === 'undo';
	}
	if (harnessModeStore.id === 'level-builder-navigation') {
		return action === 'navmesh' || action === 'undo';
	}
	if (harnessModeStore.id === 'level-builder-decoration') {
		return action === 'uv-brush' || action === 'translate' || action === 'undo';
	}
	return isHarnessSlot(action)
		? action === 'navmesh' || action === 'place-hud' || action === 'geometry'
		: contextActionStartsGroup(action);
}

/** One row. A harness mode uses its profile; otherwise layers append their actions. */
export const ContextToolbar: Component = () => {
	const actions = (): HarnessContextAction[] => {
		const id = harnessModeStore.id;
		if (id) {
			const context = harnessModeProfile(id).context;
			if (context !== null) return context;
		}
		return contextToolbarActions({
			camera: viewStore.camera,
			debug: debugStore.debug,
			build: levelStore.active,
			levelLayer: levelStore.activeLayer,
		});
	};

	return (
		<Show when={actions().length > 0}>
			<Rule />
			<For each={actions()}>
				{(action, index) => (
					<>
						<Show when={index() > 0 && actionStartsGroup(action)}>
							<Rule />
						</Show>
						<ContextActionButton action={action} />
					</>
				)}
			</For>
		</Show>
	);
};

/**
 * One strip. A top or bottom dock lays the buttons out in a row. Free, they
 * fill two columns under the window controls.
 */
export const Toolbar: Component<
	MainToolbarProps & {
		orientation?: 'row' | 'column';
	}
> = (props) => {
	const vertical = () => props.orientation === 'column';
	return (
		<StripIsVertical.Provider value={vertical}>
			<CommandStrip
				orientation={vertical() ? 'vertical' : 'horizontal'}
				mode={toolbarModeFor(harnessModeStore.id)}
			>
				<SaveGroup />
				<MainToolbar panelsOpen={props.panelsOpen} onTogglePanels={props.onTogglePanels} />
				<ContextToolbar />
			</CommandStrip>
		</StripIsVertical.Provider>
	);
};
