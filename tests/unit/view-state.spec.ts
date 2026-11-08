import { EDITOR_CAMERAS, GAME_CAMERA_ID, getZylemBridge } from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	connectViewState,
	effectiveViewPreset,
	presetForToggle,
	setSpaceHeld,
	setViewPreset,
	toggleEditorCamera,
	toggleIdForPreset,
	viewState,
} from '../../src/components/toolbar/view-state';

/** Valtio batches its notifications, so changes land a microtask later. */
async function settle(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('effectiveViewPreset', () => {
	it('uses the latched camera until Space is held', () => {
		expect(effectiveViewPreset('isometric', false)).toBe('isometric');
		expect(effectiveViewPreset('isometric', true)).toBe('free');
	});

	it('does not change the latched camera when Space is released', () => {
		setViewPreset('top');
		setSpaceHeld(true);
		expect(effectiveViewPreset(viewState.preset, viewState.spaceHeld)).toBe('free');
		setSpaceHeld(false);
		expect(viewState.preset).toBe('top');
		expect(effectiveViewPreset(viewState.preset, viewState.spaceHeld)).toBe('top');
	});
});

describe('toggleEditorCamera', () => {
	beforeEach(() => {
		viewState.preset = 'game';
		viewState.editorPreset = 'free';
		viewState.spaceHeld = false;
	});

	it('turns on the free camera before any editor camera has been picked', () => {
		toggleEditorCamera();
		expect(viewState.preset).toBe('free');
	});

	it('switches back to the game camera, then to the editor camera picked last', () => {
		setViewPreset('isometric');

		toggleEditorCamera();
		expect(viewState.preset).toBe('game');

		toggleEditorCamera();
		expect(viewState.preset).toBe('isometric');
	});

	it('keeps the editor camera in mind while the game camera is picked', () => {
		setViewPreset('top');
		setViewPreset('game');
		expect(viewState.editorPreset).toBe('top');
	});
});

describe('connectViewState', () => {
	let messages: string[];
	let stopCapture: (() => void) | null = null;
	let disconnect: (() => void) | null = null;

	beforeEach(() => {
		const { channel } = getZylemBridge();
		channel.reset();
		viewState.preset = 'game';
		viewState.spaceHeld = false;
		viewState.camera = false;
		messages = [];
		stopCapture = channel.on('camera:activate', ({ id }) => messages.push(id));
	});

	afterEach(() => {
		disconnect?.();
		disconnect = null;
		stopCapture?.();
		stopCapture = null;
		setSpaceHeld(false);
		setViewPreset('game');
	});

	it('does not send on connect, so the game camera stays put', () => {
		setViewPreset('side');
		disconnect = connectViewState();
		expect(messages).toEqual([]);
	});

	it('sends when the effective camera changes, including Space borrowing free', async () => {
		disconnect = connectViewState();

		setViewPreset('side');
		await settle();
		expect(messages).toEqual([EDITOR_CAMERAS.side]);

		setSpaceHeld(true);
		await settle();
		expect(messages.at(-1)).toBe(EDITOR_CAMERAS.free);

		setSpaceHeld(false);
		await settle();
		expect(messages.at(-1)).toBe(EDITOR_CAMERAS.side);
		expect(viewState.preset).toBe('side');
	});

	it('sends each cube angle on its camera id', async () => {
		disconnect = connectViewState();
		const cases = [
			['left', EDITOR_CAMERAS.left],
			['side', EDITOR_CAMERAS.side],
			['bottom', EDITOR_CAMERAS.bottom],
			['iso-left-top', EDITOR_CAMERAS.isoLeftTop],
			['isometric', EDITOR_CAMERAS.isometric],
			['iso-right-bottom', EDITOR_CAMERAS.isoRightBottom],
			['iso-left-bottom', EDITOR_CAMERAS.isoLeftBottom],
			['perspective', EDITOR_CAMERAS.perspective],
			['top', EDITOR_CAMERAS.top],
			['free', EDITOR_CAMERAS.free],
		] as const;

		for (const [preset, id] of cases) {
			setViewPreset(preset);
			await settle();
			expect(messages.at(-1)).toBe(id);
		}

		expect(toggleIdForPreset('side')).toBe('right');
		expect(toggleIdForPreset('isometric')).toBe('iso-right-top');
		expect(presetForToggle('right')).toBe('side');
		expect(presetForToggle('iso-right-top')).toBe('isometric');
		expect(presetForToggle('bottom')).toBe('bottom');
	});

	it('does not send when the effective camera stays the same', async () => {
		disconnect = connectViewState();
		messages.length = 0;

		setViewPreset('game');
		await settle();
		expect(messages).toEqual([]);
		expect(GAME_CAMERA_ID).toBe('game');
	});
});
