import type { Component } from 'solid-js';
import { Editor, type EditorController, type EditorLauncherMode } from './components/Editor';
import type { EditorDockDefaults } from './components/editor-store';

export interface AppProps {
	launcherMode?: EditorLauncherMode | undefined;
	defaultDocks?: EditorDockDefaults | undefined;
	onControllerReady?: ((controller: EditorController | null) => void) | undefined;
	/** Game Preview's toolbar close. The host hides the editor. */
	onDismiss?: (() => void) | undefined;
}

const App: Component<AppProps> = (props) => {
	return (
		<Editor
			launcherMode={props.launcherMode}
			defaultDocks={props.defaultDocks}
			onControllerReady={props.onControllerReady}
			onDismiss={props.onDismiss}
		/>
	);
};

export default App;
export type { EditorController, EditorLauncherMode } from './components/Editor';
export type { EditorDockDefaults } from './components/editor-store';
