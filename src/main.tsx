import '@zylem/ui/styles.css';
import { ZYLEM_PACKAGE_VERSIONS } from 'virtual:zylem-versions';
import { mountBuildLabel } from '@zylem/ui/build-label';
import './web-components/zylem-editor';
import { mountHarnessGear } from './dev/harness-chrome';
import { bootstrapHarnessGame, createHarnessGameElement } from './dev/harness-game';
import type { ZylemEditorElement } from './web-components/zylem-editor';

mountBuildLabel({
	packages: ZYLEM_PACKAGE_VERSIONS,
	prefer: '@zylem/editor',
});

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
editor.style.display = 'block';
editor.style.position = 'absolute';
editor.style.inset = '0';
// The overlay covers the canvas, so it must not swallow the clicks the gizmo and
// placement tools need. Panels re-enable pointer events on themselves.
editor.style.pointerEvents = 'none';
editor.style.width = '100%';
editor.style.height = '100%';
root.appendChild(editor);

mountHarnessGear(root, {
	initial: 'stage-editor',
	apply: (mode) => editor.setMode(mode),
});

// Started after both elements are mounted: the game element sizes the renderer
// from its own bounds when `game` is assigned. Stage Editor then turns debug
// and the free camera on.
bootstrapHarnessGame(game);
editor.setMode('stage-editor');
