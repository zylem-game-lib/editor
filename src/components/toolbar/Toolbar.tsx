import { type Component, For, Show } from 'solid-js';
import { debugStore } from '../editor-store';
import { levelStore } from '../level/level-state';
import { AddButton } from './AddButton';
import { BuildButton } from './BuildButton';
import {
	type ContextAction,
	contextActionStartsGroup,
	contextToolbarActions,
} from './context-actions';
import { DebugButton } from './DebugButton';
import { DeleteButton } from './DeleteButton';
import { GridButton, SnapButton } from './GridButton';
import { RedoButton, UndoButton } from './HistoryButtons';
import { PerspectiveButton } from './PerspectiveButton';
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
export const MainToolbar: Component = () => {
	return (
		<div class="zylem-toolbar-group">
			<SelectButton />
			<PerspectiveButton />
			<DebugButton />
			<BuildButton />
			<PlayPauseButton />
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
		case 'add-actor':
			return <AddButton placement="actor" label="Add actor" registerPaletteShortcut={false} />;
		case 'add-level':
			return <AddButton placement="level" label="Add level" registerPaletteShortcut={false} />;
		case 'add-primitive':
			return <AddButton placement="doodad" label="Add primitive" />;
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
			perspective: viewStore.perspective,
			debug: debugStore.debug,
			build: levelStore.active,
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
 * One strip. Top and bottom docks lay the buttons out in a row; a side dock
 * stacks them in a column as wide as one button.
 */
export const Toolbar: Component<{ orientation?: 'row' | 'column' }> = (props) => {
	return (
		<div
			class="zylem-toolbar"
			classList={{ 'zylem-toolbar--vertical': (props.orientation ?? 'row') === 'column' }}
		>
			<MainToolbar />
			<span class="zylem-toolbar-divider" />
			<ContextToolbar />
		</div>
	);
};
