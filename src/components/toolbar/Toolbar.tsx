import { ToolbarButton } from '@zylem/ui/components';
import Box from 'lucide-solid/icons/box';
import Image from 'lucide-solid/icons/image';
import Link from 'lucide-solid/icons/link';
import Map from 'lucide-solid/icons/map';
import Pentagon from 'lucide-solid/icons/pentagon';
import RectangleHorizontal from 'lucide-solid/icons/rectangle-horizontal';
import Shield from 'lucide-solid/icons/shield';
import { type Accessor, type Component, For, Show } from 'solid-js';
import { DockMenu } from '../common/DockMenu';
import type { DockSide } from '../common/dock-layout';
import {
	type HarnessContextAction,
	type HarnessMainAction,
	type HarnessSlotId,
	HARNESS_SLOT_LABELS,
	harnessModeProfile,
	harnessModeStore,
	isHarnessSlot,
} from '../../dev/harness-modes';
import { debugStore } from '../editor-store';
import { levelStore } from '../level/level-state';
import { AddButton } from './AddButton';
import { BuildButton } from './BuildButton';
import { CameraButton } from './CameraButton';
import { contextActionStartsGroup, contextToolbarActions } from './context-actions';
import { DebugButton } from './DebugButton';
import { DeleteButton } from './DeleteButton';
import { GridButton, SnapButton } from './GridButton';
import { RedoButton, UndoButton } from './HistoryButtons';
import {
	AddSpawnButton,
	AddTriggerButton,
	ClipBrushButton,
	DrawBrushButton,
	VertexBrushButton,
} from './LevelToolButtons';
import { PlayPauseButton } from './PlayPauseButton';
import { SelectButton } from './SelectButton';
import { RotateButton, ScaleButton, TranslateButton } from './TransformButtons';
import {
	FreeViewButton,
	GameViewButton,
	IsometricViewButton,
	SideViewButton,
	TopViewButton,
} from './ViewButtons';
import { viewStore } from './view-state';

const DEFAULT_MAIN: readonly HarnessMainAction[] = ['select', 'build', 'camera', 'debug', 'play'];

/** Exclusive editing stays Select. The other main buttons are layers or session toggles. */
export const MainToolbar: Component<{
	dockedSide: Accessor<DockSide | null>;
	onDock: (side: DockSide) => void;
}> = (props) => {
	const tools = (): readonly HarnessMainAction[] => {
		const id = harnessModeStore.id;
		if (!id) return DEFAULT_MAIN;
		return harnessModeProfile(id).main ?? DEFAULT_MAIN;
	};
	const show = (action: HarnessMainAction) => tools().includes(action);

	return (
		<div class="zylem-toolbar-group">
			<Show when={show('select')}>
				<SelectButton />
			</Show>
			<Show when={show('build')}>
				<BuildButton />
			</Show>
			<Show when={show('camera')}>
				<CameraButton />
			</Show>
			<Show when={show('debug')}>
				<DebugButton />
			</Show>
			<Show when={show('play')}>
				<PlayPauseButton />
			</Show>
			<DockMenu dockedSide={props.dockedSide} onDock={props.onDock} variant="toolbar" />
		</div>
	);
};

const ContextActionButton: Component<{ action: HarnessContextAction }> = (props) => {
	if (isHarnessSlot(props.action)) {
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
			return <DrawBrushButton />;
		case 'clip-brush':
			return <ClipBrushButton />;
		case 'vertex-brush':
			return <VertexBrushButton />;
		case 'add-doodad':
			return <AddButton label="Add doodad" />;
		case 'add-spawn':
			return <AddSpawnButton />;
		case 'add-trigger':
			return <AddTriggerButton />;
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
	navmesh: Map,
	decal: Image,
	'map-mesh': Pentagon,
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
	return (
		isHarnessSlot(action)
			? action === 'navmesh' || action === 'place-hud' || action === 'geometry'
			: contextActionStartsGroup(action)
	);
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
			<span class="zylem-toolbar-divider" />
			<For each={actions()}>
				{(action, index) => (
					<>
						<Show when={index() > 0 && actionStartsGroup(action)}>
							<span class="zylem-toolbar-divider" />
						</Show>
						<ContextActionButton action={action} />
					</>
				)}
			</For>
		</Show>
	);
};

/**
 * One strip. Top and bottom docks lay the buttons out in a row. A side dock
 * lays them in two columns, under the window controls that head those columns.
 */
export const Toolbar: Component<{
	orientation?: 'row' | 'column';
	dockedSide: Accessor<DockSide | null>;
	onDock: (side: DockSide) => void;
}> = (props) => {
	return (
		<div
			class="zylem-toolbar"
			classList={{
				'zylem-toolbar--vertical': (props.orientation ?? 'row') === 'column',
			}}
		>
			<MainToolbar dockedSide={props.dockedSide} onDock={props.onDock} />
			<ContextToolbar />
		</div>
	);
};
