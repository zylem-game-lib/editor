import { describe, expect, it } from 'vitest';
import { HARNESS_MODES, harnessModeProfile } from '../../src/dev/harness-modes';

const LEVEL_MODES = [
	'level-builder-mesh',
	'level-builder-navigation',
	'level-builder-decoration',
] as const;

describe('harness modes', () => {
	it('names the seven modes', () => {
		expect(HARNESS_MODES.map((mode) => mode.id)).toEqual([
			'game-preview',
			'stage-editor',
			'level-builder-mesh',
			'level-builder-navigation',
			'level-builder-decoration',
			'hud-view',
			'entity-editor',
		]);
	});

	it('gives Game Preview the game camera and no toolbar tools', () => {
		expect(harnessModeProfile('game-preview')).toMatchObject({
			camera: 'game',
			debug: false,
			level: false,
			captureKeys: false,
			layer: null,
			main: [],
			context: [],
		});
	});

	it('gives Stage Editor debug, select, a camera menu, and the stage tools', () => {
		expect(harnessModeProfile('stage-editor')).toMatchObject({
			camera: 'free',
			cameraLayer: false,
			debug: true,
			level: false,
			captureKeys: true,
			layer: null,
			main: ['debug', 'select', 'camera'],
			context: ['translate', 'rotate', 'scale', 'snap', 'add-object', 'delete', 'undo', 'redo'],
		});
	});

	it('gives Level Builder - Mesh the solid layer and the geometry tools', () => {
		expect(harnessModeProfile('level-builder-mesh')).toMatchObject({
			label: 'Level Builder - Mesh',
			camera: 'top',
			cameraLayer: false,
			debug: true,
			level: true,
			layer: 'solid',
			main: ['debug', 'select', 'camera'],
			context: [
				'snap',
				'grid',
				'draw-brush',
				'clip-brush',
				'vertex-brush',
				'edge',
				'face',
				'shear',
				'undo',
				'redo',
			],
		});
	});

	it('gives Level Builder - Navigation the entity layer and the game tools', () => {
		expect(harnessModeProfile('level-builder-navigation')).toMatchObject({
			label: 'Level Builder - Navigation',
			layer: 'entity',
			main: ['debug', 'select', 'camera'],
			context: [
				'snap',
				'grid',
				'navmesh',
				'add-spawn',
				'add-trigger',
				'directional-vector',
				'obstacle-brush',
				'delete',
				'undo',
				'redo',
			],
		});
	});

	it('gives Level Builder - Decoration the doodad layer and the look tools', () => {
		expect(harnessModeProfile('level-builder-decoration')).toMatchObject({
			label: 'Level Builder - Decoration',
			layer: 'doodad',
			main: ['debug', 'select', 'camera'],
			context: [
				'snap',
				'grid',
				'uv-brush',
				'decal',
				'splat',
				'translate',
				'rotate',
				'scale',
				'undo',
				'redo',
			],
		});
	});

	it('gives every editing mode the camera menu', () => {
		for (const id of ['stage-editor', ...LEVEL_MODES, 'hud-view', 'entity-editor'] as const) {
			expect(harnessModeProfile(id).main).toContain('camera');
			expect(harnessModeProfile(id).cameraLayer).toBe(false);
		}
		for (const id of LEVEL_MODES) {
			expect(harnessModeProfile(id).context).not.toEqual(
				expect.arrayContaining(['view-game', 'view-side', 'view-top', 'view-free'])
			);
		}
	});

	it('gives HUD View and Entity Editor their slots', () => {
		expect(harnessModeProfile('hud-view')).toMatchObject({
			camera: 'game',
			captureKeys: false,
			layer: null,
			main: ['select', 'camera'],
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
