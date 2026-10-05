import { EDITOR_CAMERAS, GAME_CAMERA_ID, getZylemBridge } from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	connectViewState,
	effectiveViewPreset,
	setSpaceHeld,
	setViewPreset,
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

describe('connectViewState', () => {
	let messages: string[];
	let stopCapture: (() => void) | null = null;
	let disconnect: (() => void) | null = null;

	beforeEach(() => {
		const { channel } = getZylemBridge();
		channel.reset();
		viewState.preset = 'game';
		viewState.spaceHeld = false;
		viewState.perspective = false;
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

	it('does not send when the effective camera stays the same', async () => {
		disconnect = connectViewState();
		messages.length = 0;

		setViewPreset('game');
		await settle();
		expect(messages).toEqual([]);
		expect(GAME_CAMERA_ID).toBe('game');
	});
});
