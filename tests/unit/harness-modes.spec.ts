import { describe, expect, it } from 'vitest';
import { HARNESS_MODES, harnessModeProfile } from '../../src/dev/harness-modes';

describe('harness modes', () => {
	it('names the five modes', () => {
		expect(HARNESS_MODES.map((mode) => mode.id)).toEqual([
			'game-preview',
			'stage-editor',
			'level-builder',
			'hud-view',
			'entity-editor',
		]);
	});

	it('gives Game Preview the game camera and Play, and releases the keyboard', () => {
		expect(harnessModeProfile('game-preview')).toMatchObject({
			camera: 'game',
			debug: false,
			level: false,
			captureKeys: false,
			main: ['play'],
			context: [],
		});
	});

	it('keeps Stage Editor on the live toolbar', () => {
		expect(harnessModeProfile('stage-editor')).toMatchObject({
			camera: 'free',
			debug: true,
			level: false,
			captureKeys: true,
			main: null,
			context: null,
		});
	});

	it('gives Level Builder the existing brushes plus the new slots', () => {
		expect(harnessModeProfile('level-builder').context).toEqual(
			expect.arrayContaining([
				'draw-brush',
				'clip-brush',
				'vertex-brush',
				'add-spawn',
				'add-trigger',
				'navmesh',
				'decal',
				'map-mesh',
			])
		);
	});

	it('gives HUD View and Entity Editor their slots', () => {
		expect(harnessModeProfile('hud-view')).toMatchObject({
			camera: 'game',
			captureKeys: false,
			context: ['place-hud', 'bind-variable'],
		});
		expect(harnessModeProfile('entity-editor').context).toEqual([
			'translate',
			'rotate',
			'scale',
			'geometry',
			'collision',
		]);
	});
});
