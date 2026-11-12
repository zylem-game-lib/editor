import '@zylem/ui/styles.css';
import { ZYLEM_PACKAGE_VERSIONS } from 'virtual:zylem-versions';
import './web-components/zylem-editor';
import { printToConsole } from './components/console/console-state';
import { EDITOR_SAVE_EVENT, type EditorSaveEventDetail } from './components/save/save-state';
import { mountHarnessGear } from './dev/harness-chrome';
import { bootstrapHarnessGame, createHarnessGameElement } from './dev/harness-game';
import type { ZylemEditorElement } from './web-components/zylem-editor';

const root = document.getElementById('root');

if (!root) {
	throw new Error('Root element not found');
}

root.style.position = 'relative';
root.style.width = '100%';
root.style.height = '100vh';
root.style.overflow = 'hidden';

const game = createHarnessGameElement();
root.appendChild(game);

const editor = document.createElement('zylem-editor') as ZylemEditorElement;
editor.setAttribute('launcher-mode', 'floating');
// No host stores saves here, so each one is summarized in the editor's console.
editor.setAttribute('enable-save', '');
editor.addEventListener(EDITOR_SAVE_EVENT, (event) => {
	const { save } = (event as CustomEvent<EditorSaveEventDetail>).detail;
	const { solids, doodads, entities } = save.level;
	printToConsole(
		`Saved ${save.stage.entities.length} stage entities; level: ${solids.length} solids, ${doodads.length} doodads, ${entities.length} entities`
	);
});
editor.style.display = 'block';
editor.style.position = 'absolute';
editor.style.inset = '0';
// The overlay covers the canvas, so it must not swallow the clicks the gizmo and
// placement tools need. Panels re-enable pointer events on themselves.
editor.style.pointerEvents = 'none';
editor.style.width = '100%';
editor.style.height = '100%';
root.appendChild(editor);

const editorVersion = ZYLEM_PACKAGE_VERSIONS['@zylem/editor'];
const buildLabel = editorVersion
	? editorVersion.startsWith('v')
		? editorVersion
		: `v${editorVersion}`
	: '';
const buildTitle = Object.entries(ZYLEM_PACKAGE_VERSIONS)
	.map(([name, version]) => `${name} ${version}`)
	.join('\n');

mountHarnessGear(root, {
	initial: 'stage-editor',
	apply: (mode) => editor.setMode(mode),
	build: buildLabel ? { label: buildLabel, title: buildTitle || undefined } : undefined,
});

// Started after both elements are mounted: the game element sizes the renderer
// from its own bounds when `game` is assigned. Stage Editor then turns debug
// on and leaves the game camera in place.
bootstrapHarnessGame(game);
editor.setMode('stage-editor');
