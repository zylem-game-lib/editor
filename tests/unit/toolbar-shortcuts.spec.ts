// @vitest-environment happy-dom

import { getZylemBridge } from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { debugStore, setDebugStore } from '../../src/components/editor-store';
import {
	debugState,
	getDebugTool,
	setDebugTool,
	setPaused,
	setSelectedEntityId,
} from '../../src/components/entities/entities-state';
import { stageState } from '../../src/components/stages/stage-state';
import {
	catalogState,
	setArmedType,
	setEntityCatalog,
} from '../../src/components/toolbar/catalog-state';
import { registerAddPaletteOpener } from '../../src/components/toolbar/toolbar-actions';
import {
	classifyToolbarShortcut,
	formatShortcut,
	installToolbarShortcuts,
	isOverlayTarget,
	matchesChord,
	TOOLBAR_SHORTCUTS,
	withShortcut,
} from '../../src/components/toolbar/toolbar-shortcuts';
import { setSpaceHeld, viewState } from '../../src/components/toolbar/view-state';
import { transformState } from '../../src/components/transform/transform-state';

function keydown(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
	return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

/** Dispatch on `window` and report whether the shortcut claimed the key. */
function press(init: Partial<KeyboardEventInit> & { key: string }): boolean {
	const event = keydown(init);
	window.dispatchEvent(event);
	return event.defaultPrevented;
}

/**
 * A stand-in for game-lib's keyboard provider: a plain bubble-phase listener on
 * `window` that records every key it is handed and ignores `defaultPrevented`.
 */
function listenLikeTheGame(): string[] {
	const seen: string[] = [];
	const onKeyDown = (event: KeyboardEvent) => seen.push(event.key);
	window.addEventListener('keydown', onKeyDown);
	stopCapture.push(() => window.removeEventListener('keydown', onKeyDown));
	return seen;
}

let playbackMessages: boolean[];
let stopCapture: Array<() => void> = [];
let uninstall: (() => void) | null = null;

beforeEach(() => {
	const { channel } = getZylemBridge();
	channel.reset();

	setDebugTool('none');
	setSelectedEntityId(null);
	debugState.lastTouchedEntityId = null;
	// Playing, not paused: the keys no longer wait for the simulation to stop.
	setPaused(false);
	setDebugStore('debug', false);
	stageState.entities = [{ uuid: 'crate' }];
	setEntityCatalog([{ id: 'box', label: 'Box' }]);
	setArmedType(null);
	catalogState.lastTypeId = null;
	transformState.enabled = true;
	transformState.gridVisible = false;

	playbackMessages = [];
	stopCapture = [channel.on('playback:set', ({ paused }) => playbackMessages.push(paused))];
});

afterEach(() => {
	uninstall?.();
	uninstall = null;
	for (const stop of stopCapture) stop();
	stopCapture = [];
	document.body.innerHTML = '';
});

describe('matchesChord', () => {
	it('matches the bare key regardless of case', () => {
		// Caps Lock reports the upper-case letter with no shift.
		expect(matchesChord(keydown({ key: 'w' }), { key: 'w' })).toBe(true);
		expect(matchesChord(keydown({ key: 'W' }), { key: 'w' })).toBe(true);
	});

	it('tells a shifted key from the bare one', () => {
		expect(matchesChord(keydown({ key: 'A', shiftKey: true }), { key: 'a' })).toBe(false);
		expect(matchesChord(keydown({ key: 'A', shiftKey: true }), { key: 'a', shift: true })).toBe(
			true
		);
		expect(matchesChord(keydown({ key: 'a' }), { key: 'a', shift: true })).toBe(false);
	});

	it('leaves modifier chords to the browser and the host', () => {
		// Cmd+W closes the tab, Ctrl+S saves: a bare-letter shortcut must not
		// swallow either.
		expect(matchesChord(keydown({ key: 'w', metaKey: true }), { key: 'w' })).toBe(false);
		expect(matchesChord(keydown({ key: 's', ctrlKey: true }), { key: 's' })).toBe(false);
	});

	it('accepts either platform modifier for a mod chord', () => {
		expect(
			matchesChord(keydown({ key: 'Enter', metaKey: true }), { key: 'Enter', mod: true })
		).toBe(true);
		expect(
			matchesChord(keydown({ key: 'Enter', ctrlKey: true }), { key: 'Enter', mod: true })
		).toBe(true);
		expect(matchesChord(keydown({ key: 'Enter' }), { key: 'Enter', mod: true })).toBe(false);
	});

	it('ignores anything with Alt held', () => {
		expect(matchesChord(keydown({ key: 'w', altKey: true }), { key: 'w' })).toBe(false);
	});
});

describe('classifyToolbarShortcut', () => {
	it('maps the tool row Q W E R', () => {
		expect(classifyToolbarShortcut(keydown({ key: 'q' }))).toBe('select');
		expect(classifyToolbarShortcut(keydown({ key: 'w' }))).toBe('translate');
		expect(classifyToolbarShortcut(keydown({ key: 'e' }))).toBe('rotate');
		expect(classifyToolbarShortcut(keydown({ key: 'r' }))).toBe('scale');
	});

	it('maps the mnemonics', () => {
		expect(classifyToolbarShortcut(keydown({ key: 'a' }))).toBe('add');
		expect(classifyToolbarShortcut(keydown({ key: 'A', shiftKey: true }))).toBe('addPalette');
		expect(classifyToolbarShortcut(keydown({ key: 'x' }))).toBe('delete');
		expect(classifyToolbarShortcut(keydown({ key: 'd' }))).toBe('debug');
		expect(classifyToolbarShortcut(keydown({ key: 'b' }))).toBe('build');
		expect(classifyToolbarShortcut(keydown({ key: 's' }))).toBe('snap');
		expect(classifyToolbarShortcut(keydown({ key: 'g' }))).toBe('grid');
	});

	it('maps play/pause to the Enter chord only', () => {
		expect(classifyToolbarShortcut(keydown({ key: 'Enter', metaKey: true }))).toBe('playback');
		expect(classifyToolbarShortcut(keydown({ key: 'Enter', ctrlKey: true }))).toBe('playback');
		// Bare Enter is the game's Select button.
		expect(classifyToolbarShortcut(keydown({ key: 'Enter' }))).toBeNull();
	});

	it('leaves undo and redo to the history shortcuts', () => {
		// Both modules listen on window; handling the chord here too would undo
		// twice per press.
		expect(classifyToolbarShortcut(keydown({ key: 'z', metaKey: true }))).toBeNull();
		expect(
			classifyToolbarShortcut(keydown({ key: 'Z', metaKey: true, shiftKey: true }))
		).toBeNull();
	});

	it('has no answer for other keys', () => {
		expect(classifyToolbarShortcut(keydown({ key: 'p' }))).toBeNull();
		expect(classifyToolbarShortcut(keydown({ key: 'Escape' }))).toBeNull();
	});
});

describe('isOverlayTarget', () => {
	it('detects a keydown from inside a popover', () => {
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		const inner = document.createElement('div');
		dialog.append(inner);
		document.body.append(dialog);

		const event = keydown({ key: 's' });
		inner.dispatchEvent(event);

		expect(isOverlayTarget(event)).toBe(true);
	});

	it('detects a menu', () => {
		const menu = document.createElement('div');
		menu.setAttribute('role', 'menu');
		document.body.append(menu);

		const event = keydown({ key: 's' });
		menu.dispatchEvent(event);

		expect(isOverlayTarget(event)).toBe(true);
	});

	it('does not treat the toolbar or the canvas as an overlay', () => {
		const toolbar = document.createElement('div');
		toolbar.setAttribute('role', 'toolbar');
		const button = document.createElement('button');
		toolbar.append(button);
		document.body.append(toolbar);

		const event = keydown({ key: 's' });
		button.dispatchEvent(event);

		expect(isOverlayTarget(event)).toBe(false);
	});

	it('sees through a shadow root via the composed path', () => {
		// The Add palette is portaled inside the editor's shadow root, where
		// `event.target` alone is retargeted to the host.
		const host = document.createElement('div');
		document.body.append(host);
		const root = host.attachShadow({ mode: 'open' });
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		root.append(dialog);

		const event = keydown({ key: 's', composed: true });
		dialog.dispatchEvent(event);

		expect(isOverlayTarget(event)).toBe(true);
	});
});

describe('formatShortcut', () => {
	it('shows a bare letter upper-cased', () => {
		expect(formatShortcut({ key: 'w' }, true)).toBe('W');
	});

	it('spells the modifiers out, per platform', () => {
		expect(formatShortcut({ key: 'a', shift: true }, true)).toBe('Shift+A');
		expect(formatShortcut({ key: 'Enter', mod: true }, true)).toBe('Cmd+Enter');
		expect(formatShortcut({ key: 'Enter', mod: true }, false)).toBe('Ctrl+Enter');
		expect(formatShortcut({ key: 'z', mod: true, shift: true }, false)).toBe('Ctrl+Shift+Z');
	});

	it('appends to a label for the tooltip', () => {
		expect(withShortcut('Move', 'translate')).toBe('Move (W)');
	});

	it('covers every toolbar shortcut', () => {
		for (const chord of Object.values(TOOLBAR_SHORTCUTS)) {
			expect(formatShortcut(chord, true)).not.toBe('');
		}
	});
});

describe('installToolbarShortcuts', () => {
	it('switches tools from the keyboard while the simulation runs', () => {
		uninstall = installToolbarShortcuts();

		expect(press({ key: 'q' })).toBe(true);
		expect(getDebugTool()).toBe('select');

		press({ key: 'x' });
		expect(getDebugTool()).toBe('delete');
	});

	it('stops a claimed key before the game sees it, whichever listened first', () => {
		// The game registered first, as it does when the editor mounts into a
		// running game; a bubble-phase claim would come too late for it.
		const seen = listenLikeTheGame();
		uninstall = installToolbarShortcuts();

		press({ key: 'q' });
		press({ key: 'Enter', metaKey: true });
		press({ key: 'p' });

		expect(seen).toEqual(['p']);
		expect(getDebugTool()).toBe('select');
	});

	it('leaves every key to the game while the panel is closed', () => {
		let open = false;
		uninstall = installToolbarShortcuts({ isActive: () => open });
		const seen = listenLikeTheGame();

		expect(press({ key: 'q' })).toBe(false);
		expect(press({ key: 'Enter', metaKey: true })).toBe(false);
		expect(getDebugTool()).toBe('none');
		expect(playbackMessages).toEqual([]);
		expect(seen).toEqual(['q', 'Enter']);

		// Read per keystroke, so opening the panel needs no reinstall.
		open = true;
		expect(press({ key: 'q' })).toBe(true);
		expect(getDebugTool()).toBe('select');
		expect(seen).toEqual(['q', 'Enter']);
	});

	it('toggles like the button, so a second press returns to the neutral tool', () => {
		uninstall = installToolbarShortcuts();

		press({ key: 'q' });
		expect(getDebugTool()).toBe('select');

		// Still claimed: the key did what it says, and must not fall through.
		expect(press({ key: 'q' })).toBe(true);
		expect(getDebugTool()).toBe('none');
	});

	it('enters a gizmo mode on the last entity worked on', () => {
		uninstall = installToolbarShortcuts();
		debugState.lastTouchedEntityId = 'crate';

		expect(press({ key: 'w' })).toBe(true);

		expect(getDebugTool()).toBe('translate');
		expect(debugState.selectedEntityIds).toEqual(['crate']);
	});

	it('keeps a gizmo mode on a second press, and switches on another key', () => {
		uninstall = installToolbarShortcuts();
		setSelectedEntityId('crate');

		press({ key: 'w' });
		expect(press({ key: 'w' })).toBe(true);
		expect(getDebugTool()).toBe('translate');

		press({ key: 'e' });
		expect(getDebugTool()).toBe('rotate');
	});

	it('keeps a key from the game even when its button would be disabled', () => {
		uninstall = installToolbarShortcuts();
		const seen = listenLikeTheGame();
		stageState.entities = [];

		// Nothing to move: nothing happens, but the key was still addressed to
		// the editor and must not fire whatever the game bound to it.
		expect(press({ key: 'w' })).toBe(true);
		expect(getDebugTool()).toBe('none');
		expect(seen).toEqual([]);
	});

	it('arms placement and opens the palette', () => {
		uninstall = installToolbarShortcuts();
		let opened = 0;
		stopCapture.push(
			registerAddPaletteOpener(() => {
				opened += 1;
				return true;
			})
		);

		press({ key: 'a' });
		expect(getDebugTool()).toBe('add');
		expect(catalogState.armedTypeId).toBe('box');

		expect(press({ key: 'A', shiftKey: true })).toBe(true);
		expect(opened).toBe(1);
	});

	it('claims Shift+A even with no palette to open', () => {
		uninstall = installToolbarShortcuts();

		// Same rule as a disabled button: the chord is the editor's while the
		// panel is open, whether or not it has anything to do.
		expect(press({ key: 'A', shiftKey: true })).toBe(true);
	});

	it('toggles debug, snap and grid', () => {
		uninstall = installToolbarShortcuts();

		press({ key: 'd' });
		press({ key: 's' });
		press({ key: 'g' });

		expect(debugStore.debug).toBe(true);
		expect(transformState.enabled).toBe(false);
		expect(transformState.gridVisible).toBe(true);
	});

	it('toggles playback with the Enter chord', () => {
		uninstall = installToolbarShortcuts();

		expect(press({ key: 'Enter', metaKey: true })).toBe(true);
		expect(debugState.paused).toBe(true);

		expect(press({ key: 'Enter', ctrlKey: true })).toBe(true);
		expect(debugState.paused).toBe(false);

		expect(playbackMessages).toEqual([true, false]);
	});

	it('swallows key repeat without acting on it', () => {
		uninstall = installToolbarShortcuts();
		const seen = listenLikeTheGame();

		// A held D must not blink debug on and off at the key-repeat rate...
		press({ key: 'd' });
		expect(press({ key: 'd', repeat: true })).toBe(true);
		expect(press({ key: 'd', repeat: true })).toBe(true);
		expect(debugStore.debug).toBe(true);

		// ...nor register in the game as a held button one repeat later.
		expect(seen).toEqual([]);
	});

	it('leaves keys to a focused text field', () => {
		uninstall = installToolbarShortcuts();
		const seen = listenLikeTheGame();

		const input = document.createElement('input');
		document.body.append(input);
		const event = keydown({ key: 'q' });
		input.dispatchEvent(event);

		expect(getDebugTool()).toBe('none');
		expect(event.defaultPrevented).toBe(false);
		// Not the editor's key, so not stopped either.
		expect(seen).toEqual(['q']);
	});

	it('leaves keys to an open palette', () => {
		uninstall = installToolbarShortcuts();

		// Typing a search into the palette must not toggle snap on the `s`.
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		document.body.append(dialog);
		const event = keydown({ key: 's' });
		dialog.dispatchEvent(event);

		expect(transformState.enabled).toBe(true);
		expect(event.defaultPrevented).toBe(false);
	});

	it('ignores modifier chords on the letters', () => {
		uninstall = installToolbarShortcuts();

		expect(press({ key: 'w', metaKey: true })).toBe(false);
		expect(getDebugTool()).toBe('none');
	});

	it('installs nothing when disabled', () => {
		uninstall = installToolbarShortcuts({ enabled: false });

		press({ key: 'q' });
		press({ key: 'Enter', metaKey: true });

		expect(getDebugTool()).toBe('none');
		expect(playbackMessages).toEqual([]);
	});

	it('stops listening once uninstalled', () => {
		const stop = installToolbarShortcuts();
		stop();

		press({ key: 'q' });

		expect(getDebugTool()).toBe('none');
	});

	it('holds Space as a temporary custom camera and restores on release', () => {
		uninstall = installToolbarShortcuts();
		setSpaceHeld(false);
		viewState.preset = 'side';

		expect(press({ key: ' ' })).toBe(true);
		expect(viewState.spaceHeld).toBe(true);

		const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true });
		window.dispatchEvent(up);
		expect(viewState.spaceHeld).toBe(false);
		expect(viewState.preset).toBe('side');
	});
});
