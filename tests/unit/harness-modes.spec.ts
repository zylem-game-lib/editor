// @vitest-environment happy-dom

import { boxBrush, getZylemBridge, type LevelDocument } from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { debugStore, setDebugStore } from '../../src/components/editor-store';
import { getDebugTool, setDebugTool } from '../../src/components/entities/entities-state';
import {
	deleteLevelSelection,
	levelState,
	loadLevelDocument,
	resetLevelEditor,
	selectLevelObject,
} from '../../src/components/level/level-state';
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
	onHarnessModeChange,
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

describe('the level document across modes', () => {
	/** What the game was last told to do with the level. */
	type LevelMessage =
		| { kind: 'sync'; tools: boolean | undefined; selectedIds: string[] }
		| { kind: 'play'; solids: number }
		| { kind: 'close' };

	let messages: LevelMessage[];
	let stopCapture: Array<() => void> = [];

	function oneSolid(): LevelDocument {
		return {
			version: 2,
			solids: [{ id: 'wall', planes: boxBrush({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }) }],
			doodads: [],
			entities: [],
		};
	}

	beforeEach(() => {
		const { channel } = getZylemBridge();
		channel.reset();
		resetLevelEditor();
		harnessModeState.id = null;
		setDebugTool('none');
		messages = [];
		stopCapture = [
			channel.on('level:sync', ({ tools, selectedIds }) =>
				messages.push({ kind: 'sync', tools, selectedIds })
			),
			channel.on('level:play', ({ document }) =>
				messages.push({ kind: 'play', solids: document.solids.length })
			),
			channel.on('level:close', () => messages.push({ kind: 'close' })),
		];
	});

	afterEach(() => {
		for (const stop of stopCapture) stop();
		stopCapture = [];
		harnessModeState.id = null;
	});

	it('is shown by the first mode, with the level tools off outside the level builders', () => {
		loadLevelDocument(oneSolid());
		expect(messages).toEqual([]);

		applyHarnessMode('stage-editor');
		expect(messages).toEqual([{ kind: 'sync', tools: false, selectedIds: [] }]);
	});

	it('stays in the game through every mode', () => {
		loadLevelDocument(oneSolid());
		for (const { id } of HARNESS_MODES) {
			applyHarnessMode(id);
			const expected: LevelMessage =
				id === 'game-preview'
					? { kind: 'play', solids: 1 }
					: { kind: 'sync', tools: harnessModeProfile(id).level, selectedIds: [] };
			// What the game was last told still holds when a change of mode sends nothing new.
			expect(messages.at(-1), id).toEqual(expected);
		}
		expect(messages.map((message) => message.kind)).not.toContain('close');
	});

	it('is sent once when a mode outside the level builders is entered', () => {
		loadLevelDocument(oneSolid());
		for (const from of ['game-preview', 'level-builder-mesh'] as const) {
			applyHarnessMode(from);
			messages = [];
			applyHarnessMode('stage-editor');
			expect(messages, from).toEqual([{ kind: 'sync', tools: false, selectedIds: [] }]);
		}
		harnessModeState.id = null;
		resetLevelEditor();
		loadLevelDocument(oneSolid());
		messages = [];
		applyHarnessMode('game-preview');
		expect(messages).toEqual([{ kind: 'play', solids: 1 }]);
	});

	it('keeps the preview when a level builder is left, and drops what its tools had selected', () => {
		loadLevelDocument(oneSolid());
		applyHarnessMode('level-builder-mesh');
		selectLevelObject('wall');
		levelState.elementMode = 'face';
		messages = [];

		applyHarnessMode('entity-editor');
		expect(levelState.active).toBe(false);
		expect(levelState.shown).toBe(true);
		expect(levelState.selectedIds).toEqual([]);
		expect(levelState.elementMode).toBe('object');
		expect(messages).toEqual([{ kind: 'sync', tools: false, selectedIds: [] }]);
	});

	it('is played in Game Preview and previewed again on the way out', () => {
		loadLevelDocument(oneSolid());
		applyHarnessMode('stage-editor');
		messages = [];

		applyHarnessMode('game-preview');
		expect(messages).toEqual([{ kind: 'play', solids: 1 }]);

		applyHarnessMode('hud-view');
		expect(messages.at(-1)).toEqual({ kind: 'sync', tools: false, selectedIds: [] });
	});

	it('follows a document loaded after the mode was applied', () => {
		applyHarnessMode('game-preview');
		loadLevelDocument(oneSolid());
		expect(messages).toEqual([{ kind: 'play', solids: 1 }]);

		applyHarnessMode('stage-editor');
		messages = [];
		loadLevelDocument({
			...oneSolid(),
			solids: [],
			doodads: [
				{ id: 'crate', typeId: 'box', pose: { position: { x: 0, y: 0, z: 0 } }, props: {} },
			],
		});
		expect(messages).toEqual([{ kind: 'sync', tools: false, selectedIds: [] }]);
	});

	it('is not sent while empty, so a level the game plays itself is left alone', () => {
		applyHarnessMode('stage-editor');
		applyHarnessMode('game-preview');
		applyHarnessMode('entity-editor');
		expect(messages).toEqual([]);

		// A level builder is where an empty document gets its first solid.
		applyHarnessMode('level-builder-mesh');
		expect(messages).toEqual([{ kind: 'sync', tools: true, selectedIds: [] }]);
	});

	it('is sent empty once the game holds it, so deleting the last solid shows', () => {
		loadLevelDocument(oneSolid());
		applyHarnessMode('level-builder-mesh');
		selectLevelObject('wall');
		deleteLevelSelection();
		messages = [];

		applyHarnessMode('stage-editor');
		expect(messages).toEqual([{ kind: 'sync', tools: false, selectedIds: [] }]);
	});

	it('keeps the tool and the level selection when asked to', () => {
		loadLevelDocument(oneSolid());
		applyHarnessMode('stage-editor');
		setDebugTool('select');
		levelState.selectedIds = ['wall'];
		messages = [];

		applyHarnessMode('level-builder-mesh', { keepTool: true });
		expect(getDebugTool()).toBe('select');
		expect(levelState.selectedIds).toEqual(['wall']);
		expect(messages).toEqual([{ kind: 'sync', tools: true, selectedIds: ['wall'] }]);
	});

	it('announces a change of mode, and not the same mode again', () => {
		const seen: string[] = [];
		const stop = onHarnessModeChange((id) => seen.push(id));
		applyHarnessMode('stage-editor');
		applyHarnessMode('stage-editor');
		applyHarnessMode('hud-view');
		stop();
		applyHarnessMode('entity-editor');
		expect(seen).toEqual(['stage-editor', 'hud-view']);
	});
});
