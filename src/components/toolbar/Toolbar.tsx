import { type Accessor, type Component, For, Show } from 'solid-js';
import { DockMenu } from '../common/DockMenu';
import type { DockSide } from '../common/dock-layout';
import { debugStore } from '../editor-store';
import { levelStore } from '../level/level-state';
import { AddButton } from './AddButton';
import { BuildButton } from './BuildButton';
import { CameraButton } from './CameraButton';
import {
	type ContextAction,
	contextActionStartsGroup,
	contextToolbarActions,
} from './context-actions';
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

/** Exclusive editing stays Select. The other main buttons are layers or session toggles. */
export const MainToolbar: Component<{
	dockedSide: Accessor<DockSide | null>;
	onDock: (side: DockSide) => void;
}> = (props) => {
	return (
		<div class="zylem-toolbar-group">
			<SelectButton />
			<BuildButton />
			<CameraButton />
			<DebugButton />
			<PlayPauseButton />
			<DockMenu dockedSide={props.dockedSide} onDock={props.onDock} variant="toolbar" />
		</div>
	);
};

const ContextActionButton: Component<{ action: ContextAction }> = (props) => {
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

/** One row. Layers append actions; shared ones (snap, undo, redo) appear once. */
export const ContextToolbar: Component = () => {
	const actions = () =>
		contextToolbarActions({
			camera: viewStore.camera,
			debug: debugStore.debug,
			build: levelStore.active,
			levelLayer: levelStore.activeLayer,
		});

	return (
		<For each={actions()}>
			{(action, index) => (
				<>
					<Show when={index() > 0 && contextActionStartsGroup(action)}>
						<span class="zylem-toolbar-divider" />
					</Show>
					<ContextActionButton action={action} />
				</>
			)}
		</For>
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
			<span class="zylem-toolbar-divider" />
			<ContextToolbar />
		</div>
	);
};
