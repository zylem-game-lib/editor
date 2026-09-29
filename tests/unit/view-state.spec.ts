import { getZylemBridge, type CameraViewPreset } from '@zylem/bridge';
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
	it('uses the latched preset until Space is held', () => {
		expect(effectiveViewPreset('isometric', false)).toBe('isometric');
		expect(effectiveViewPreset('isometric', true)).toBe('custom');
	});

	it('does not change the latched preset when Space is released', () => {
		setViewPreset('top');
		setSpaceHeld(true);
		expect(effectiveViewPreset(viewState.preset, viewState.spaceHeld)).toBe('custom');
		setSpaceHeld(false);
		expect(viewState.preset).toBe('top');
		expect(effectiveViewPreset(viewState.preset, viewState.spaceHeld)).toBe('top');
	});
});

describe('connectViewState', () => {
	let messages: CameraViewPreset[];
	let stopCapture: (() => void) | null = null;
	let disconnect: (() => void) | null = null;

	beforeEach(() => {
		const { channel } = getZylemBridge();
		channel.reset();
		viewState.preset = 'top';
		viewState.spaceHeld = false;
		viewState.perspective = false;
		messages = [];
		stopCapture = channel.on('camera:view:set', ({ preset }) => messages.push(preset));
	});

	afterEach(() => {
		disconnect?.();
		disconnect = null;
		stopCapture?.();
		stopCapture = null;
		setSpaceHeld(false);
		setViewPreset('top');
	});

	it('pushes the effective preset, including Space forcing custom', async () => {
		setViewPreset('side');
		disconnect = connectViewState();
		expect(messages).toEqual(['side']);

		setSpaceHeld(true);
		await settle();
		expect(messages.at(-1)).toBe('custom');

		setSpaceHeld(false);
		await settle();
		expect(messages.at(-1)).toBe('side');
		expect(viewState.preset).toBe('side');
	});

	it('does not send when the effective preset stays the same', async () => {
		disconnect = connectViewState();
		messages.length = 0;

		setViewPreset('top');
		await settle();
		expect(messages).toEqual([]);
	});
});
