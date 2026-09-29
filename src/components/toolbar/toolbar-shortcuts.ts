/**
 * Keyboard shortcuts for the toolbar.
 *
 * The tool row follows the Godot/Unreal layout — Q select, W move, E rotate,
 * R scale — with mnemonics for the rest: A add, B build, X delete, D debug,
 * S snap, G grid. Every key sits under the left hand on a QWERTY board, so
 * the right hand can stay on the mouse.
 *
 * The keys are live whenever the editor panel is open, playing or paused: the
 * panel being up is the signal that the keyboard is addressing the editor. The
 * same letters are gameplay input — game-lib's keyboard provider listens on the
 * same `window`, maps `a`, `s`, `q`, `e`, `x`, `z` and `Enter` for its default
 * pad, and pays no attention to `preventDefault` — so while the panel is open
 * the shortcuts are stopped here, in the capture phase, before any other
 * listener sees them. Close the panel and the keys are the game's again.
 *
 * Undo and redo keep Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z from `history-shortcuts`,
 * behind their own option; they are listed here so the tooltips can show them.
 */

import { isEditableTarget } from '../history/history-shortcuts';
import {
	armAddTool,
	openAddPalette,
	selectTransformTool,
	toggleDebug,
	toggleGrid,
	toggleLevelEditor,
	togglePlayback,
	toggleSnap,
	toggleTool,
} from './toolbar-actions';
import { setSpaceHeld } from './view-state';

export interface ShortcutChord {
	/** `KeyboardEvent.key`, matched case-insensitively so Caps Lock changes nothing. */
	key: string;
	shift?: boolean;
	/** Cmd on macOS, Ctrl elsewhere; either is accepted. */
	mod?: boolean;
}

/** Every toolbar action's chord, keyed by the button it belongs to. */
export const TOOLBAR_SHORTCUTS = {
	debug: { key: 'd' },
	build: { key: 'b' },
	select: { key: 'q' },
	translate: { key: 'w' },
	rotate: { key: 'e' },
	scale: { key: 'r' },
	add: { key: 'a' },
	addPalette: { key: 'a', shift: true },
	delete: { key: 'x' },
	snap: { key: 's' },
	grid: { key: 'g' },
	undo: { key: 'z', mod: true },
	redo: { key: 'z', mod: true, shift: true },
	playback: { key: 'Enter', mod: true },
} as const satisfies Record<string, ShortcutChord>;

export type ToolbarShortcutId = keyof typeof TOOLBAR_SHORTCUTS;

/** The shortcuts this module runs; undo and redo are `history-shortcuts`'. */
const TOOLBAR_ACTIONS = [
	'debug',
	'build',
	'select',
	'translate',
	'rotate',
	'scale',
	'add',
	'addPalette',
	'delete',
	'snap',
	'grid',
	'playback',
] as const satisfies readonly ToolbarShortcutId[];

export type ToolbarAction = (typeof TOOLBAR_ACTIONS)[number];

/** Whether a keydown is exactly this chord: same key, same modifiers, no Alt. */
export function matchesChord(event: KeyboardEvent, chord: ShortcutChord): boolean {
	// Alt is the free-transform modifier during a drag, and on macOS it changes
	// the reported key anyway.
	if (event.altKey) return false;
	if ((event.metaKey || event.ctrlKey) !== Boolean(chord.mod)) return false;
	if (event.shiftKey !== Boolean(chord.shift)) return false;
	return event.key.toLowerCase() === chord.key.toLowerCase();
}

/** Which toolbar action a keydown asks for, if any. */
export function classifyToolbarShortcut(event: KeyboardEvent): ToolbarAction | null {
	for (const action of TOOLBAR_ACTIONS) {
		if (matchesChord(event, TOOLBAR_SHORTCUTS[action])) return action;
	}
	return null;
}

/** Roles whose contents own the keyboard while open: popovers, dialogs, menus. */
const OVERLAY_ROLES = new Set(['dialog', 'alertdialog', 'menu']);

/**
 * Whether a keydown comes from inside an open overlay — the Add palette, a dock
 * menu — which has keyboard handling of its own and must not lose a keystroke
 * to the toolbar. Typing a search into the palette would otherwise toggle snap
 * on the `s`. Walks the composed path, as `isEditableTarget` does, so the
 * overlay is found through the editor's shadow root.
 */
export function isOverlayTarget(event: Event): boolean {
	const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
	const nodes = path.length ? path : [event.target];

	for (const node of nodes) {
		if (!(node instanceof HTMLElement)) continue;
		const role = node.getAttribute('role');
		if (role && OVERLAY_ROLES.has(role)) return true;
	}
	return false;
}

const isApplePlatform = (): boolean =>
	typeof navigator !== 'undefined' &&
	/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/**
 * A chord as tooltip text: `W`, `Shift+A`, `Cmd+Enter`.
 *
 * Words rather than ⌘ and ⇧, because the toolbar buttons use one string for
 * both the tooltip and the accessible name.
 */
export function formatShortcut(chord: ShortcutChord, apple: boolean = isApplePlatform()): string {
	const parts: string[] = [];
	if (chord.mod) parts.push(apple ? 'Cmd' : 'Ctrl');
	if (chord.shift) parts.push('Shift');
	parts.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
	return parts.join('+');
}

/** A button label with its shortcut appended, for the tooltip: `Move (W)`. */
export function withShortcut(label: string, id: ToolbarShortcutId): string {
	return `${label} (${formatShortcut(TOOLBAR_SHORTCUTS[id])})`;
}

/**
 * Run the action a shortcut stands for.
 *
 * The tool keys select rather than toggle: W in Move stays in Move, and Escape
 * is the way out. The buttons keep their toggle, since a lit button is its own
 * "press again to leave" affordance. Everything else is a toggle by nature.
 *
 * @returns Whether anything happened. `false` mirrors a disabled button: Move
 * with nothing to move, Add with an empty catalog, the palette with no toolbar.
 */
export function runToolbarAction(action: ToolbarAction): boolean {
	switch (action) {
		case 'debug':
			toggleDebug();
			return true;
		case 'build':
			toggleLevelEditor();
			return true;
		case 'select':
		case 'delete':
			toggleTool(action);
			return true;
		case 'translate':
		case 'rotate':
		case 'scale':
			return selectTransformTool(action);
		case 'add':
			return armAddTool();
		case 'addPalette':
			return openAddPalette();
		case 'snap':
			toggleSnap();
			return true;
		case 'grid':
			toggleGrid();
			return true;
		case 'playback':
			togglePlayback();
			return true;
	}
}

export interface ToolbarShortcutOptions {
	/** @default true */
	enabled?: boolean;
	/**
	 * Whether the keys belong to the editor right now — the web component passes
	 * "the panel is open". Read per keystroke, so it can follow UI state.
	 * @default always
	 */
	isActive?: () => boolean;
	target?: Window;
}

/**
 * Install the toolbar shortcuts.
 *
 * @returns An uninstall function.
 */
export function installToolbarShortcuts(options: ToolbarShortcutOptions = {}): () => void {
	if (options.enabled === false) return () => {};

	const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);
	if (!target) return () => {};

	const isActive = options.isActive ?? (() => true);

	const isSpace = (event: KeyboardEvent) => event.key === ' ' || event.key === 'Spacebar';

	// Hold Space for a temporary custom camera. Release restores the latched preset.
	// Keyup always clears, including after the panel closes mid-hold.
	const onSpaceDown = (event: KeyboardEvent) => {
		if (!isSpace(event) || event.repeat) return;
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		if (isEditableTarget(event) || isOverlayTarget(event)) return;
		if (!isActive()) return;

		event.preventDefault();
		event.stopImmediatePropagation();
		setSpaceHeld(true);
	};

	const onSpaceUp = (event: KeyboardEvent) => {
		if (!isSpace(event)) return;
		setSpaceHeld(false);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const action = classifyToolbarShortcut(event);
		if (!action) return;
		if (isEditableTarget(event) || isOverlayTarget(event)) return;
		if (!isActive()) return;

		/*
		 * The key is the editor's from here on, whether or not its button is
		 * enabled — while the panel is open, W with nothing to move does nothing
		 * rather than firing whatever the game bound to it. The game's keyboard
		 * provider polls key state off this same `window` and ignores
		 * `preventDefault`, so the event has to be stopped outright; and it is
		 * stopped here, in the capture phase, so it never matters whether the game
		 * or the editor registered its listener first. Repeats are swallowed too,
		 * without acting: a held key must neither flicker its tool nor register in
		 * the game one repeat later.
		 */
		event.preventDefault();
		event.stopImmediatePropagation();
		if (event.repeat) return;
		runToolbarAction(action);
	};

	target.addEventListener('keydown', onSpaceDown, true);
	target.addEventListener('keyup', onSpaceUp, true);
	target.addEventListener('keydown', onKeyDown, true);
	return () => {
		target.removeEventListener('keydown', onSpaceDown, true);
		target.removeEventListener('keyup', onSpaceUp, true);
		target.removeEventListener('keydown', onKeyDown, true);
	};
}
