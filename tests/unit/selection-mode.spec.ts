// @vitest-environment happy-dom

import {
	boxBrush,
	type EntitySelectionPayload,
	getZylemBridge,
	type LevelDocument,
	type LevelSyncPayload,
} from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyEntitySelection, applyLevelSelect } from '../../src/bridge/sync-editing';
import { replaceEntities } from '../../src/bridge/sync-entities';
import {
	debugState,
	getDebugTool,
	setDebugTool,
	setSelectedEntityId,
} from '../../src/components/entities/entities-state';
import {
	levelState,
	loadLevelDocument,
	resetLevelEditor,
	setLevelElementMode,
} from '../../src/components/level/level-state';
import {
	isHudSelection,
	modeForEntitySelection,
	modeForLevelSelection,
} from '../../src/components/selection/selection-mode';
import { installTransformToolGuard } from '../../src/components/toolbar/transform-tool-guard';
import {
	applyHarnessMode,
	type HarnessModeId,
	harnessModeState,
	onHarnessModeChange,
} from '../../src/dev/harness-modes';

const ZERO = { x: 0, y: 0, z: 0 };
const ONE = { x: 1, y: 1, z: 1 };

/** Solid `wall`, doodad `crate`, spawn marker `spawn`. */
function level(): LevelDocument {
	return {
		version: 2,
		solids: [{ id: 'wall', planes: boxBrush({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }) }],
		doodads: [{ id: 'crate', typeId: 'box', pose: { position: { x: 4, y: 0, z: 0 } }, props: {} }],
		entities: [
			{
				id: 'spawn',
				typeId: 'spawn',
				name: 'spawn-1',
				pose: { position: { x: 0, y: 1, z: 4 } },
				props: { spawnKind: 'player', archetype: '' },
			},
		],
	};
}

function entity(uuid: string, hud = false) {
	return {
		uuid,
		name: uuid,
		type: hud ? 'Text' : 'Box',
		position: ZERO,
		rotation: ZERO,
		scale: ONE,
		...(hud ? { hud: true } : {}),
	};
}

/** What the game reports after a pick in the scene. */
function picked(...uuids: string[]): EntitySelectionPayload {
	return {
		selectedUuid: uuids[uuids.length - 1] ?? null,
		selectedUuids: uuids,
		hoveredUuid: null,
	} as EntitySelectionPayload;
}

/** Valtio batches notifications into a microtask. */
function settle(): Promise<void> {
	return Promise.resolve();
}

let syncs: LevelSyncPayload[];
let entitySelects: Array<string | null>;
let stops: Array<() => void> = [];

beforeEach(() => {
	const { channel } = getZylemBridge();
	channel.reset();
	resetLevelEditor();
	harnessModeState.id = null;
	setDebugTool('none');
	setSelectedEntityId(null);
	replaceEntities([
		entity('player'),
		entity('enemy'),
		entity('score', true),
		entity('lives', true),
	]);
	loadLevelDocument(level());
	applyHarnessMode('stage-editor');

	syncs = [];
	entitySelects = [];
	stops = [
		channel.on('level:sync', (payload) => syncs.push(payload)),
		channel.on('entity:select', ({ uuid }) => entitySelects.push(uuid)),
	];
});

afterEach(() => {
	for (const stop of stops) stop();
	stops = [];
	replaceEntities([]);
	harnessModeState.id = null;
});

describe('the mode a selection calls for', () => {
	it('is Entity Inspector for an entity and HUD View for a HUD element', () => {
		expect(modeForEntitySelection()).toBeNull();
		setSelectedEntityId('player');
		expect(modeForEntitySelection()).toBe('entity-editor');
		setSelectedEntityId('score');
		expect(modeForEntitySelection()).toBe('hud-view');
	});

	it('goes by the entity picked last in a mixed selection', () => {
		applyEntitySelection(picked('player', 'score'));
		expect(modeForEntitySelection()).toBe('hud-view');
		expect(isHudSelection()).toBe(false);
		applyEntitySelection(picked('score', 'lives'));
		expect(isHudSelection()).toBe(true);
	});

	it.each<[string, HarnessModeId]>([
		['wall', 'level-builder-mesh'],
		['crate', 'level-builder-decoration'],
		['spawn', 'level-builder-navigation'],
	])('is the mode that owns the layer of %s', (id, mode) => {
		levelState.selectedIds = [id];
		expect(modeForLevelSelection()).toBe(mode);
	});

	it('is Level Mesh for vertices, edges, and faces', () => {
		levelState.selectedIds = ['wall'];
		levelState.selectedElements = [{ brushId: 'wall', kind: 'face', planes: [2] }];
		expect(modeForLevelSelection()).toBe('level-builder-mesh');
	});

	it('is nothing with nothing selected', () => {
		expect(modeForLevelSelection()).toBeNull();
	});
});

describe('a pick of entities in the scene', () => {
	it('shows Entity Inspector', () => {
		applyEntitySelection(picked('player'));
		expect(harnessModeState.id).toBe('entity-editor');
		expect(debugState.selectedEntityIds).toEqual(['player']);
	});

	it('shows HUD View for a HUD element', () => {
		applyEntitySelection(picked('score'));
		expect(harnessModeState.id).toBe('hud-view');
	});

	it('moves between HUD View and Entity Inspector as the picks do', () => {
		applyEntitySelection(picked('score'));
		applyEntitySelection(picked('player'));
		expect(harnessModeState.id).toBe('entity-editor');
		applyEntitySelection(picked('lives'));
		expect(harnessModeState.id).toBe('hud-view');
	});

	it('keeps Select armed through the change of mode', () => {
		setDebugTool('select');
		applyEntitySelection(picked('player'));
		expect(getDebugTool()).toBe('select');
	});

	it('leaves a level mode and drops the level selection', () => {
		applyLevelSelect({ id: 'wall' });
		expect(levelState.active).toBe(true);

		applyEntitySelection(picked('player'));
		expect(harnessModeState.id).toBe('entity-editor');
		expect(levelState.active).toBe(false);
		expect(levelState.selectedIds).toEqual([]);
		expect(syncs.at(-1)).toMatchObject({ tools: false, selectedIds: [] });
	});

	it('leaves the mode alone when the selection is cleared', () => {
		applyEntitySelection(picked('player'));
		applyEntitySelection(picked());
		expect(harnessModeState.id).toBe('entity-editor');
	});

	it('leaves the mode alone for hover and for a selection the editor made', () => {
		// A row in the entity list selects here first; the game then echoes it.
		setSelectedEntityId('player');
		applyEntitySelection(picked('player'));
		applyEntitySelection({ ...picked('player'), hoveredUuid: 'enemy' });
		expect(harnessModeState.id).toBe('stage-editor');
	});
});

describe('a pick in the level preview', () => {
	it('shows Level Mesh for a solid, with the level tools on and the pick kept', () => {
		setDebugTool('select');
		applyLevelSelect({ id: 'wall' });

		expect(harnessModeState.id).toBe('level-builder-mesh');
		expect(levelState.active).toBe(true);
		expect(levelState.selectedIds).toEqual(['wall']);
		expect(getDebugTool()).toBe('select');
		expect(syncs.at(-1)).toMatchObject({ tools: true, selectedIds: ['wall'] });
	});

	it('shows Decorations for a doodad and Map Navigation for a marker', () => {
		applyLevelSelect({ id: 'crate' });
		expect(harnessModeState.id).toBe('level-builder-decoration');
		expect(levelState.activeLayer).toBe('doodad');

		applyLevelSelect({ id: 'spawn' });
		expect(harnessModeState.id).toBe('level-builder-navigation');
		expect(levelState.activeLayer).toBe('entity');
		expect(levelState.selectedIds).toEqual(['spawn']);
	});

	it('stays in Level Mesh for a face', () => {
		applyHarnessMode('level-builder-mesh');
		setLevelElementMode('face');
		applyLevelSelect({ id: 'wall', elements: [{ brushId: 'wall', kind: 'face', planes: [2] }] });

		expect(harnessModeState.id).toBe('level-builder-mesh');
		expect(levelState.elementMode).toBe('face');
		expect(levelState.selectedElements).toHaveLength(1);
	});

	it('drops the entity selection, here and in the game', () => {
		applyEntitySelection(picked('player'));
		entitySelects = [];

		applyLevelSelect({ id: 'wall' });
		expect(debugState.selectedEntityIds).toEqual([]);
		expect(debugState.selectedEntityId).toBeNull();
		expect(entitySelects).toEqual([null]);
		expect(harnessModeState.id).toBe('level-builder-mesh');

		// The game echoes the cleared selection; that is not a pick.
		applyEntitySelection(picked());
		expect(harnessModeState.id).toBe('level-builder-mesh');
	});

	it('leaves the mode alone for a click on empty space', () => {
		applyLevelSelect({ id: 'wall' });
		applyLevelSelect({ id: null });
		expect(levelState.selectedIds).toEqual([]);
		expect(harnessModeState.id).toBe('level-builder-mesh');

		applyHarnessMode('entity-editor');
		applyLevelSelect({ id: null });
		expect(harnessModeState.id).toBe('entity-editor');
	});
});

describe('where picks are not followed', () => {
	it('is a host that never applied a mode', () => {
		harnessModeState.id = null;
		applyEntitySelection(picked('player'));
		applyLevelSelect({ id: 'wall' });

		expect(harnessModeState.id).toBeNull();
		// Nothing is cleared either: such a host keeps both selections as before.
		expect(debugState.selectedEntityIds).toEqual(['player']);
		expect(levelState.selectedIds).toEqual(['wall']);
	});

	it('is Game Preview', () => {
		applyHarnessMode('game-preview');
		applyEntitySelection(picked('player'));
		applyLevelSelect({ id: 'wall' });
		expect(harnessModeState.id).toBe('game-preview');
	});
});

describe('the mode a pick chose', () => {
	it('is announced once per change', () => {
		const seen: HarnessModeId[] = [];
		const stop = onHarnessModeChange((id) => seen.push(id));

		applyEntitySelection(picked('player'));
		applyEntitySelection(picked('enemy'));
		applyLevelSelect({ id: 'wall' });
		applyHarnessMode('level-builder-mesh');
		applyHarnessMode('stage-editor');
		stop();
		applyHarnessMode('hud-view');

		expect(seen).toEqual(['entity-editor', 'level-builder-mesh', 'stage-editor']);
	});
});

describe('Select after a pick', () => {
	let uninstall: () => void = () => {};

	beforeEach(() => {
		uninstall = installTransformToolGuard();
		setDebugTool('select');
	});

	afterEach(() => {
		uninstall();
	});

	it('hands off to Move for an entity', async () => {
		applyEntitySelection(picked('player'));
		await settle();
		expect(harnessModeState.id).toBe('entity-editor');
		expect(getDebugTool()).toBe('translate');
	});

	it('hands off to Move for a solid, now that the level tools hold it', async () => {
		applyLevelSelect({ id: 'wall' });
		await settle();
		expect(harnessModeState.id).toBe('level-builder-mesh');
		expect(getDebugTool()).toBe('translate');
	});

	it('stays armed for a HUD element, which no gizmo moves', async () => {
		applyEntitySelection(picked('score'));
		await settle();
		expect(harnessModeState.id).toBe('hud-view');
		expect(getDebugTool()).toBe('select');

		applyEntitySelection(picked('lives'));
		await settle();
		expect(getDebugTool()).toBe('select');
	});

	it('ends with no tool when a click clears the selection', async () => {
		applyEntitySelection(picked('score'));
		await settle();
		applyEntitySelection(picked());
		await settle();
		expect(getDebugTool()).toBe('none');
	});
});
