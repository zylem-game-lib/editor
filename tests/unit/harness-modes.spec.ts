// @vitest-environment happy-dom

import { getZylemBridge } from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { debugStore, setDebugStore } from '../../src/components/editor-store';
import { getDebugTool, setDebugTool } from '../../src/components/entities/entities-state';
import { levelState, resetLevelEditor } from '../../src/components/level/level-state';
import {
	catalogState,
	setArmedType,
	setEntityCatalog,
} from '../../src/components/toolbar/catalog-state';
import { setViewPreset, viewState } from '../../src/components/toolbar/view-state';
import {
	applyHarnessMode,
	HARNESS_MODES,
	harnessModeProfile,
	harnessModeState,
	isHarnessSlot,
} from '../../src/dev/harness-modes';

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

	it('gives Game Preview play, debug, and the game camera', () => {
		expect(harnessModeProfile('game-preview')).toMatchObject({
			label: 'Game Preview',
			camera: 'game',
			debug: false,
			level: false,
			captureKeys: false,
			layer: null,
			main: ['play', 'debug'],
			context: [],
		});
	});

	it('gives Stage Editor debug, select, a camera menu, play, and the stage tools', () => {
		expect(harnessModeProfile('stage-editor')).toMatchObject({
			camera: 'game',
			cameraLayer: false,
			debug: true,
			level: false,
			captureKeys: true,
			layer: null,
			main: ['debug', 'select', 'camera', 'play'],
			context: ['translate', 'rotate', 'scale', 'snap', 'add-object', 'delete', 'undo', 'redo'],
		});
	});

	it('gives Level Mesh the solid layer and the geometry tools', () => {
		expect(harnessModeProfile('level-builder-mesh')).toMatchObject({
			label: 'Level Mesh',
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
				'edge-brush',
				'face-brush',
				'shear-brush',
				'subdivide-brush',
				'translate',
				'rotate',
				'scale',
				'duplicate-selection',
				'delete',
				'undo',
				'redo',
			],
		});
	});

	it('makes Edge, Face, and Shear real buttons rather than slots', () => {
		for (const action of ['edge', 'face', 'shear', 'edge-brush', 'face-brush', 'shear-brush']) {
			expect(isHarnessSlot(action)).toBe(false);
		}
		expect(isHarnessSlot('navmesh')).toBe(true);
	});

	it('gives Map Navigation the entity layer and the game tools', () => {
		expect(harnessModeProfile('level-builder-navigation')).toMatchObject({
			label: 'Map Navigation',
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

	it('gives Decorations the doodad layer and the look tools', () => {
		expect(harnessModeProfile('level-builder-decoration')).toMatchObject({
			label: 'Decorations',
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

	it('gives HUD View and Entity Inspector their slots', () => {
		expect(harnessModeProfile('hud-view')).toMatchObject({
			label: 'HUD View',
			camera: 'game',
			captureKeys: false,
			layer: null,
			main: ['select', 'camera'],
			context: ['place-hud', 'bind-variable'],
		});
		expect(harnessModeProfile('entity-editor').label).toBe('Entity Inspector');
		expect(harnessModeProfile('entity-editor').context).toEqual([
			'translate',
			'rotate',
			'scale',
			'geometry',
			'collision',
		]);
	});
});

describe('applyHarnessMode', () => {
	let toolMessages: string[];
	let addTypeMessages: Array<string | null>;
	let stopCapture: Array<() => void> = [];

	beforeEach(() => {
		const { channel } = getZylemBridge();
		channel.reset();
		resetLevelEditor();
		setDebugTool('none');
		setEntityCatalog([{ id: 'box', label: 'Box' }]);
		setArmedType(null);
		toolMessages = [];
		addTypeMessages = [];
		stopCapture = [
			channel.on('tool:set', ({ tool }) => toolMessages.push(tool)),
			channel.on('add:type:set', ({ typeId }) => addTypeMessages.push(typeId)),
		];
	});

	afterEach(() => {
		for (const stop of stopCapture) stop();
		stopCapture = [];
	});

	it('opens Level Builder - Mesh with nothing armed', () => {
		applyHarnessMode('stage-editor');
		setDebugTool('add');
		setArmedType('box');
		toolMessages = [];

		applyHarnessMode('level-builder-mesh');
		expect(levelState.active).toBe(true);
		expect(levelState.activeLayer).toBe('solid');
		expect(getDebugTool()).toBe('none');
		expect(toolMessages).toEqual(['none']);
		expect(catalogState.armedTypeId).toBeNull();
		expect(addTypeMessages).toEqual([null]);
		expect(levelState.placement).toBeNull();
	});

	it('tells the game nothing is armed even when the editor already thought so', () => {
		applyHarnessMode('level-builder-mesh');
		expect(toolMessages).toEqual(['none']);
	});

	it('disarms a level tool when switching between level modes', () => {
		applyHarnessMode('level-builder-navigation');
		setDebugTool('add');
		levelState.placement = { kind: 'spawn' };
		levelState.elementMode = 'face';

		applyHarnessMode('level-builder-mesh');
		expect(getDebugTool()).toBe('none');
		expect(levelState.placement).toBeNull();
		expect(levelState.elementMode).toBe('object');

		setDebugTool('brush');
		applyHarnessMode('level-builder-decoration');
		expect(getDebugTool()).toBe('none');
		expect(levelState.activeLayer).toBe('doodad');
	});

	it('releases a tool the next mode has no button for to no tool', () => {
		applyHarnessMode('level-builder-mesh');
		setDebugTool('brush');
		toolMessages = [];

		applyHarnessMode('stage-editor');
		expect(levelState.active).toBe(false);
		expect(getDebugTool()).toBe('none');
		expect(toolMessages).toEqual(['none']);
	});

	it('keeps the camera and the debug flag when the mode changes', () => {
		harnessModeState.id = null;
		applyHarnessMode('stage-editor');
		expect(viewState.preset).toBe('game');
		expect(debugStore.debug).toBe(true);

		setViewPreset('perspective');
		viewState.camera = true;
		setDebugStore('debug', false);
		const { channel } = getZylemBridge();
		channel.reset();
		const debugMessages: boolean[] = [];
		const stop = channel.on('debug:set', ({ enabled }) => debugMessages.push(enabled));

		applyHarnessMode('level-builder-mesh');
		expect(viewState.preset).toBe('perspective');
		expect(viewState.camera).toBe(true);
		expect(debugStore.debug).toBe(false);
		expect(debugMessages).toEqual([]);
		expect(levelState.active).toBe(true);
		stop();
	});

	it('forces the game camera and debug off for the hidden fallback', () => {
		harnessModeState.id = null;
		applyHarnessMode('stage-editor');
		expect(viewState.preset).toBe('game');
		expect(debugStore.debug).toBe(true);

		setViewPreset('free');
		applyHarnessMode('game-preview', { resetView: true });
		expect(harnessModeState.id).toBe('game-preview');
		expect(harnessModeState.captureKeys).toBe(false);
		expect(viewState.preset).toBe('game');
		expect(viewState.camera).toBe(false);
		expect(debugStore.debug).toBe(false);
	});

	it('leaves the camera and debug flag when Game Preview is selected', () => {
		harnessModeState.id = null;
		applyHarnessMode('stage-editor');
		setViewPreset('perspective');
		setDebugStore('debug', true);

		applyHarnessMode('game-preview');
		expect(viewState.preset).toBe('perspective');
		expect(debugStore.debug).toBe(true);
		expect(harnessModeState.captureKeys).toBe(false);
	});

	it('keeps a tool the next mode still shows', () => {
		applyHarnessMode('stage-editor');
		setDebugTool('rotate');
		toolMessages = [];

		applyHarnessMode('entity-editor');
		expect(getDebugTool()).toBe('rotate');
		expect(toolMessages).toEqual([]);
	});
});
