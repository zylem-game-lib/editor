// @vitest-environment happy-dom

import {
	boxBrush,
	brushBounds,
	DEFAULT_DRAW_SHAPE,
	frameForPlane,
	getZylemBridge,
	type LevelDocument,
	type LevelElementRef,
} from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyLevelGesture, applySceneOperation } from '../../src/bridge/sync-editing';
import { debugStore, setDebugStore } from '../../src/components/editor-store';
import {
	debugState,
	getDebugTool,
	setDebugTool,
	setPaused,
	setSelectedEntityId,
} from '../../src/components/entities/entities-state';
import { clearHistory } from '../../src/components/history/history-store';
import {
	levelState,
	loadLevelDocument,
	resetLevelEditor,
	setLevelDrawShape,
	setLevelEditorActive,
} from '../../src/components/level/level-state';
import { stageState } from '../../src/components/stages/stage-state';
import {
	catalogState,
	setArmedType,
	setEntityCatalog,
} from '../../src/components/toolbar/catalog-state';
import { isBrushArmed, isTriggerArmed } from '../../src/components/toolbar/level-tool-state';
import {
	armAddTool,
	armAddType,
	armBrushShape,
	armClipTool,
	armSolidTool,
	armSpawnTool,
	armTriggerTool,
	duplicateSelection,
	endToolAfterUse,
	openAddPalette,
	registerAddPaletteOpener,
	selectElementMode,
	selectTool,
	selectTransformTool,
	toggleBrushTool,
	toggleClipTool,
	toggleDebug,
	toggleElementMode,
	toggleGrid,
	toggleLevelEditor,
	togglePlayback,
	toggleShearTool,
	toggleSnap,
	toggleTool,
	toggleTransformTool,
	transformTarget,
} from '../../src/components/toolbar/toolbar-actions';
import { setViewPreset, viewState } from '../../src/components/toolbar/view-state';
import { transformState } from '../../src/components/transform/transform-state';

let sent: Array<{ type: string; payload: unknown }>;
let stopCapture: Array<() => void> = [];

const sentOf = (type: string) => sent.filter((message) => message.type === type);

beforeEach(() => {
	const { channel } = getZylemBridge();
	channel.reset();

	setDebugTool('none');
	setSelectedEntityId(null);
	debugState.lastTouchedEntityId = null;
	setPaused(false);
	setDebugStore('debug', false);
	stageState.entities = [];
	setEntityCatalog([]);
	setArmedType(null);
	catalogState.lastTypeId = null;
	transformState.enabled = true;
	transformState.gridVisible = false;
	resetLevelEditor();
	setViewPreset('game');

	sent = [];
	const capture = (type: Parameters<typeof channel.on>[0]) =>
		channel.on(type, (payload) => sent.push({ type, payload }));
	stopCapture = [
		capture('tool:set'),
		capture('add:type:set'),
		capture('entity:select'),
		capture('debug:set'),
		capture('playback:set'),
	];
});

afterEach(() => {
	for (const stop of stopCapture) stop();
	stopCapture = [];
	clearHistory();
});

describe('toggleDebug', () => {
	it('flips debug mode and tells the game', () => {
		setViewPreset('side');
		toggleDebug();
		expect(debugStore.debug).toBe(true);
		expect(viewState.preset).toBe('free');
		expect(sentOf('debug:set').map((m) => m.payload)).toEqual([{ enabled: true }]);

		toggleDebug();
		expect(debugStore.debug).toBe(false);
		expect(viewState.preset).toBe('free');
	});
});

describe('toggleTool', () => {
	it('arms a click tool and disarms it on the second press', () => {
		toggleTool('select');
		expect(getDebugTool()).toBe('select');

		toggleTool('select');
		expect(getDebugTool()).toBe('none');
		expect(sentOf('tool:set').map((m) => m.payload)).toEqual([
			{ tool: 'select' },
			{ tool: 'none' },
		]);
	});

	it('switches straight from one tool to the other', () => {
		toggleTool('select');
		toggleTool('delete');
		expect(getDebugTool()).toBe('delete');
	});
});

describe('selectTool', () => {
	it('makes the tool active and keeps it on a second press', () => {
		selectTool('select');
		selectTool('select');

		expect(getDebugTool()).toBe('select');
		// Told the game once; the second press had nothing new to say.
		expect(sentOf('tool:set').map((m) => m.payload)).toEqual([{ tool: 'select' }]);
	});

	it('switches from one tool to another', () => {
		selectTool('select');
		selectTool('delete');
		expect(getDebugTool()).toBe('delete');
	});
});

describe('transformTarget', () => {
	it('prefers the selection', () => {
		stageState.entities = [{ uuid: 'a' }, { uuid: 'b' }];
		setSelectedEntityId('b');
		expect(transformTarget()).toBe('b');
	});

	it('falls back to the last entity worked on, while it still exists', () => {
		stageState.entities = [{ uuid: 'a' }];
		setSelectedEntityId('a');
		setSelectedEntityId(null);
		expect(transformTarget()).toBe('a');

		// Deleted, or its creation undone: the memory points at nothing.
		stageState.entities = [];
		expect(transformTarget()).toBeNull();
	});
});

describe('toggleTransformTool', () => {
	it('does nothing with nothing to act on', () => {
		expect(toggleTransformTool('translate')).toBe(false);
		expect(getDebugTool()).toBe('none');
		expect(sent).toEqual([]);
	});

	it('enters the mode on the selection and disarms the Add tool', () => {
		stageState.entities = [{ uuid: 'a' }];
		setSelectedEntityId('a');
		setArmedType('box');

		expect(toggleTransformTool('rotate')).toBe(true);
		expect(getDebugTool()).toBe('rotate');
		expect(catalogState.armedTypeId).toBeNull();
		expect(sentOf('add:type:set').map((m) => m.payload)).toEqual([{ typeId: null }]);
		expect(sentOf('tool:set').map((m) => m.payload)).toEqual([{ tool: 'rotate' }]);
		// Already selected, so the selection was left alone.
		expect(sentOf('entity:select')).toEqual([]);
	});

	it('selects the fallback target first when nothing is selected', () => {
		stageState.entities = [{ uuid: 'a' }];
		debugState.lastTouchedEntityId = 'a';

		toggleTransformTool('scale');

		expect(debugState.selectedEntityIds).toEqual(['a']);
		// The game computes the gizmo pivot from its own selection, so it hears too.
		expect(sentOf('entity:select').map((m) => m.payload)).toEqual([{ uuid: 'a' }]);
		expect(getDebugTool()).toBe('scale');
	});

	it('leaves the mode on the second press', () => {
		stageState.entities = [{ uuid: 'a' }];
		setSelectedEntityId('a');

		toggleTransformTool('translate');
		toggleTransformTool('translate');

		expect(getDebugTool()).toBe('none');
	});
});

describe('selectTransformTool', () => {
	it('does nothing with nothing to act on', () => {
		expect(selectTransformTool('translate')).toBe(false);
		expect(getDebugTool()).toBe('none');
	});

	it('enters the mode, and keeps it on a second press', () => {
		stageState.entities = [{ uuid: 'a' }];
		setSelectedEntityId('a');

		expect(selectTransformTool('translate')).toBe(true);
		// Handled, so the keystroke is claimed, but nothing is re-sent.
		expect(selectTransformTool('translate')).toBe(true);

		expect(getDebugTool()).toBe('translate');
		expect(sentOf('tool:set').map((m) => m.payload)).toEqual([{ tool: 'translate' }]);
	});

	it('switches between modes', () => {
		stageState.entities = [{ uuid: 'a' }];
		setSelectedEntityId('a');

		selectTransformTool('translate');
		selectTransformTool('scale');

		expect(getDebugTool()).toBe('scale');
	});
});

describe('armAddType', () => {
	beforeEach(() => {
		setEntityCatalog([
			{ id: 'box', label: 'Box', defaultProps: { size: 1 } },
			{ id: 'sphere', label: 'Sphere' },
		]);
	});

	it('arms placement with the type and tells the game', () => {
		expect(armAddType('box')).toBe(true);
		expect(catalogState.armedTypeId).toBe('box');
		expect(getDebugTool()).toBe('add');
		expect(sentOf('add:type:set').map((m) => m.payload)).toEqual([
			{ typeId: 'box', props: { size: 1 } },
		]);
		expect(sentOf('tool:set').map((m) => m.payload)).toEqual([{ tool: 'add' }]);
	});

	it('hands the game a copy of the props, not a live handle on the store', () => {
		armAddType('box');

		const payloads = sentOf('add:type:set').map((m) => m.payload as { props: object });
		expect(payloads).toHaveLength(1);
		const { props } = payloads[0] as { props: object };
		expect(props).toEqual({ size: 1 });
		expect(props).not.toBe(catalogState.entities[0]?.defaultProps);
	});

	it('sends no props for a type that has none', () => {
		armAddType('sphere');
		expect(sentOf('add:type:set').map((m) => m.payload)).toEqual([{ typeId: 'sphere' }]);
	});

	it('refuses a type the catalog does not have', () => {
		expect(armAddType('gone')).toBe(false);
		expect(getDebugTool()).toBe('none');
		expect(sent).toEqual([]);
	});

	it('arms a doodad placement while level mode is on, and clears it with the next tool', () => {
		setLevelEditorActive(true);
		armAddType('box');
		expect(levelState.placement).toEqual({ kind: 'doodad', typeId: 'box', props: { size: 1 } });
		expect(levelState.activeLayer).toBe('doodad');

		selectTool('select');
		expect(levelState.placement).toBeNull();
	});
});

describe('armAddTool', () => {
	it('has nothing to arm on an empty catalog', () => {
		expect(armAddTool()).toBe(false);
		expect(sent).toEqual([]);
	});

	it('arms what the button face shows', () => {
		setEntityCatalog([
			{ id: 'box', label: 'Box' },
			{ id: 'sphere', label: 'Sphere' },
		]);
		catalogState.lastTypeId = 'sphere';

		expect(armAddTool()).toBe(true);
		expect(catalogState.armedTypeId).toBe('sphere');
	});

	it('leaves an armed tool armed', () => {
		setEntityCatalog([{ id: 'box', label: 'Box' }]);
		armAddTool();
		armAddTool();

		expect(catalogState.armedTypeId).toBe('box');
		expect(getDebugTool()).toBe('add');
	});
});

describe('endToolAfterUse', () => {
	beforeEach(() => {
		setEntityCatalog([{ id: 'box', label: 'Box' }]);
	});

	it('disarms Add after a placement and keeps the type on the face', () => {
		armAddType('box');
		sent = [];

		expect(endToolAfterUse('place')).toBe(true);
		expect(getDebugTool()).toBe('none');
		expect(catalogState.armedTypeId).toBeNull();
		expect(catalogState.lastTypeId).toBe('box');
		expect(sentOf('add:type:set').map((m) => m.payload)).toEqual([{ typeId: null }]);
		expect(sentOf('tool:set').map((m) => m.payload)).toEqual([{ tool: 'none' }]);
	});

	it('drops the level placement along with Add', () => {
		setLevelEditorActive(true);
		armAddType('box');

		endToolAfterUse('place');
		expect(levelState.placement).toBeNull();
	});

	it('returns Delete to no tool after a deletion', () => {
		toggleTool('delete');

		expect(endToolAfterUse('delete')).toBe(true);
		expect(getDebugTool()).toBe('none');
	});

	it('only spends the tool that made the edit', () => {
		setDebugTool('translate');
		expect(endToolAfterUse('delete')).toBe(false);
		expect(endToolAfterUse('place')).toBe(false);
		expect(getDebugTool()).toBe('translate');

		toggleTool('delete');
		expect(endToolAfterUse('place')).toBe(false);
		expect(getDebugTool()).toBe('delete');
	});
});

describe('a tool spent by what the game reports', () => {
	it('disarms Add once its placement arrives as a scene operation', () => {
		setEntityCatalog([{ id: 'box', label: 'Box' }]);
		armAddType('box');

		applySceneOperation({
			opId: 'op-create',
			kind: 'create',
			label: 'Add Box',
			entries: [{ uuid: 'entity-1' }],
		});

		expect(getDebugTool()).toBe('none');
		expect(catalogState.armedTypeId).toBeNull();
	});

	it('returns Delete to no tool once its deletion arrives', () => {
		toggleTool('delete');

		applySceneOperation({
			opId: 'op-delete',
			kind: 'delete',
			label: 'Delete entity',
			entries: [{ uuid: 'entity-1' }],
		});

		expect(getDebugTool()).toBe('none');
	});

	it('disarms a level spawn once it is placed', () => {
		setLevelEditorActive(true);
		armSpawnTool();

		applyLevelGesture({ kind: 'spawn', pose: { position: { x: 0, y: 0, z: 0 } } });

		expect(getDebugTool()).toBe('none');
		expect(levelState.placement).toBeNull();
	});

	it('disarms the brush once the mesh is drawn', () => {
		setLevelEditorActive(true);
		armSolidTool('brush');

		applyLevelGesture({
			kind: 'primitive',
			frame: frameForPlane({ x: 0, y: 1, z: 0 }, 0),
			footprint: { u0: 0, v0: 0, u1: 1, v1: 1 },
			height: 1,
			shape: { ...DEFAULT_DRAW_SHAPE },
		});

		expect(getDebugTool()).toBe('none');
	});

	it('keeps the brush when the draw does not make a solid', () => {
		setLevelEditorActive(true);
		armSolidTool('brush');

		applyLevelGesture({
			kind: 'primitive',
			frame: frameForPlane({ x: 0, y: 1, z: 0 }, 0),
			footprint: { u0: 0, v0: 0, u1: 1, v1: 1 },
			height: 0,
			shape: { ...DEFAULT_DRAW_SHAPE },
		});

		expect(getDebugTool()).toBe('brush');
	});

	it('disarms Delete once an element is removed, and keeps it when the edit is refused', () => {
		setLevelEditorActive(true);
		loadLevelDocument(levelDocument());
		toggleTool('delete');

		applyLevelGesture({
			kind: 'element-delete',
			elements: [{ brushId: 'a', kind: 'face', planes: [2] }],
		});
		expect(getDebugTool()).toBe('delete');

		applyLevelGesture({
			kind: 'element-delete',
			elements: [{ brushId: 'a', kind: 'vertex', planes: [0, 2, 4] }],
		});
		expect(getDebugTool()).toBe('none');
	});
});

describe('the Add palette opener', () => {
	it('is inert with no toolbar mounted', () => {
		expect(openAddPalette()).toBe(false);
	});

	it('opens through the registered button and reports what it did', () => {
		let opened = 0;
		const unregister = registerAddPaletteOpener(() => {
			opened += 1;
			return true;
		});

		expect(openAddPalette()).toBe(true);
		expect(opened).toBe(1);

		unregister();
		expect(openAddPalette()).toBe(false);
		expect(opened).toBe(1);
	});

	it('passes a decline through, so a disabled button stays disabled', () => {
		const unregister = registerAddPaletteOpener(() => false);
		expect(openAddPalette()).toBe(false);
		unregister();
	});

	it('lets a newer registration outlive an older unregister', () => {
		const unregisterOld = registerAddPaletteOpener(() => false);
		const unregisterNew = registerAddPaletteOpener(() => true);

		// The old button unmounting must not take the new one's palette with it.
		unregisterOld();
		expect(openAddPalette()).toBe(true);
		unregisterNew();
	});
});

describe('snap and grid', () => {
	it('toggle their settings', () => {
		toggleSnap();
		expect(transformState.enabled).toBe(false);
		toggleGrid();
		expect(transformState.gridVisible).toBe(true);
	});
});

/** Solid `a`, doodad `d`. */
function levelDocument(): LevelDocument {
	return {
		version: 2,
		solids: [{ id: 'a', planes: boxBrush({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }) }],
		doodads: [{ id: 'd', typeId: 'box', pose: { position: { x: 3, y: 0, z: 0 } }, props: {} }],
		entities: [],
	};
}

const topFace: LevelElementRef = { brushId: 'a', kind: 'face', planes: [2] };
const toolMessages = () => sentOf('tool:set').map((message) => message.payload);

describe('the Brush dropdown', () => {
	beforeEach(() => {
		setLevelEditorActive(true);
	});

	it('arms the brush with every shape, and is lit only while armed', () => {
		expect(isBrushArmed(getDebugTool())).toBe(false);
		for (const shape of ['box', 'wedge', 'cylinder', 'arch'] as const) {
			armBrushShape(shape);
			expect(getDebugTool()).toBe('brush');
			expect(levelState.drawShape.shape).toBe(shape);
			expect(isBrushArmed(getDebugTool())).toBe(true);
		}
		expect(levelState.activeLayer).toBe('solid');

		toggleTool('select');
		expect(isBrushArmed(getDebugTool())).toBe(false);
	});

	it('arms the current shape from its face, and disarms on a second press', () => {
		setLevelDrawShape('cylinder');
		toggleBrushTool();
		expect(getDebugTool()).toBe('brush');
		expect(levelState.drawShape.shape).toBe('cylinder');

		toggleBrushTool();
		expect(getDebugTool()).toBe('none');
		expect(isBrushArmed(getDebugTool())).toBe(false);
		expect(toolMessages()).toEqual([{ tool: 'brush' }, { tool: 'none' }]);
	});
});

describe('the Trigger dropdown', () => {
	it('is lit only while its placement is armed', () => {
		setLevelEditorActive(true);
		expect(isTriggerArmed(getDebugTool(), levelState.placement)).toBe(false);
		armTriggerTool();
		expect(isTriggerArmed(getDebugTool(), levelState.placement)).toBe(true);
		armSpawnTool();
		expect(isTriggerArmed(getDebugTool(), levelState.placement)).toBe(false);
	});
});

describe('the element mode buttons', () => {
	beforeEach(() => {
		loadLevelDocument(levelDocument());
		setLevelEditorActive(true);
	});

	it('enter a mode, arming Select with nothing armed, and return to objects when pressed lit', () => {
		toggleElementMode('face');
		expect(levelState.elementMode).toBe('face');
		expect(getDebugTool()).toBe('select');

		toggleElementMode('face');
		expect(levelState.elementMode).toBe('object');
		expect(getDebugTool()).toBe('select');
		expect(toolMessages()).toEqual([{ tool: 'select' }]);
	});

	it('switch straight between modes and drop the element selection', () => {
		toggleElementMode('vertex');
		levelState.selectedElements = [{ brushId: 'a', kind: 'vertex', planes: [0, 2, 4] }];
		toggleElementMode('edge');
		expect(levelState.elementMode).toBe('edge');
		expect(levelState.selectedElements).toEqual([]);
	});

	it('leave an armed tool armed', () => {
		armBrushShape('box');
		toggleElementMode('vertex');
		expect(levelState.elementMode).toBe('vertex');
		expect(getDebugTool()).toBe('brush');
	});

	it('select from a key, and keep the mode on a second press', () => {
		selectElementMode('edge');
		selectElementMode('edge');
		expect(levelState.elementMode).toBe('edge');
		selectElementMode('object');
		expect(levelState.elementMode).toBe('object');
	});

	it('drop Shear once face mode ends', () => {
		selectElementMode('face');
		levelState.selectedElements = [topFace];
		toggleShearTool();
		selectElementMode('edge');
		expect(getDebugTool()).toBe('select');

		selectElementMode('face');
		levelState.selectedElements = [topFace];
		toggleShearTool();
		selectElementMode('object');
		expect(getDebugTool()).toBe('none');
	});
});

describe('Clip and Shear', () => {
	beforeEach(() => {
		loadLevelDocument(levelDocument());
		setLevelEditorActive(true);
	});

	it('arm Clip on a solid selection only, and toggle it from the button', () => {
		expect(armClipTool()).toBe(false);
		levelState.selectedIds = ['d'];
		expect(toggleClipTool()).toBe(false);
		expect(getDebugTool()).toBe('none');

		levelState.selectedIds = ['d', 'a'];
		expect(armClipTool()).toBe(true);
		expect(armClipTool()).toBe(true);
		expect(getDebugTool()).toBe('clip');

		levelState.selectedIds = [];
		expect(toggleClipTool()).toBe(true);
		expect(getDebugTool()).toBe('none');
		expect(toolMessages()).toEqual([{ tool: 'clip' }, { tool: 'none' }]);
	});

	it('arm Shear in face mode with faces selected, and disarm it while armed', () => {
		expect(toggleShearTool()).toBe(false);
		selectElementMode('face');
		expect(toggleShearTool()).toBe(false);
		expect(getDebugTool()).toBe('select');

		levelState.selectedElements = [topFace];
		expect(toggleShearTool()).toBe(true);
		expect(getDebugTool()).toBe('shear');
		expect(levelState.activeLayer).toBe('solid');

		levelState.selectedElements = [];
		expect(toggleShearTool()).toBe(true);
		expect(getDebugTool()).toBe('none');
	});
});

describe('duplicateSelection', () => {
	beforeEach(() => {
		loadLevelDocument(levelDocument());
		setLevelEditorActive(true);
		transformState.translate = 0.25;
	});

	const copyMinX = () => {
		const copy = levelState.document.solids.at(-1);
		return copy ? brushBounds(copy.planes)?.min.x : undefined;
	};

	it('moves the copies one snap step along +X', () => {
		transformState.translate = 0.5;
		levelState.selectedIds = ['a'];
		expect(duplicateSelection()).toBe(true);
		expect(copyMinX()).toBeCloseTo(0.5, 6);
		expect(levelState.selectedIds).toEqual([levelState.document.solids[1]?.id]);
	});

	it('moves the copies a whole unit with snap off or a zero step', () => {
		transformState.enabled = false;
		levelState.selectedIds = ['a'];
		duplicateSelection();
		expect(copyMinX()).toBeCloseTo(1, 6);

		transformState.enabled = true;
		transformState.translate = 0;
		levelState.selectedIds = ['a'];
		duplicateSelection();
		expect(copyMinX()).toBeCloseTo(1, 6);
	});

	it('does nothing with nothing selected', () => {
		expect(duplicateSelection()).toBe(false);
		expect(levelState.undoDepth).toBe(0);
	});
});

describe('toggleLevelEditor', () => {
	it('enters level mode with nothing armed, picking whole objects', () => {
		setEntityCatalog([{ id: 'box', label: 'Box' }]);
		armAddType('box');
		levelState.elementMode = 'face';
		sent = [];

		toggleLevelEditor();
		expect(levelState.active).toBe(true);
		expect(getDebugTool()).toBe('none');
		expect(catalogState.armedTypeId).toBeNull();
		expect(levelState.placement).toBeNull();
		expect(levelState.elementMode).toBe('object');
		expect(toolMessages()).toEqual([{ tool: 'none' }]);
		expect(sentOf('add:type:set').map((message) => message.payload)).toEqual([{ typeId: null }]);
	});

	it('returns a level tool to Select on the way out', () => {
		toggleLevelEditor();
		armBrushShape('wedge');
		toggleLevelEditor();
		expect(levelState.active).toBe(false);
		expect(getDebugTool()).toBe('select');
	});
});

describe('the gizmo tools on the level selection', () => {
	beforeEach(() => {
		loadLevelDocument(levelDocument());
		setLevelEditorActive(true);
	});

	it('enter Move, Rotate, or Scale on level objects', () => {
		levelState.selectedIds = ['a'];
		expect(toggleTransformTool('rotate')).toBe(true);
		expect(getDebugTool()).toBe('rotate');
		expect(selectTransformTool('scale')).toBe(true);
		expect(getDebugTool()).toBe('scale');
		expect(toggleTransformTool('scale')).toBe(true);
		expect(getDebugTool()).toBe('none');
	});

	it('enter a gizmo mode on selected elements', () => {
		levelState.selectedElements = [topFace];
		expect(selectTransformTool('scale')).toBe(true);
		expect(getDebugTool()).toBe('scale');
	});

	it('stay out with nothing selected in the level', () => {
		expect(toggleTransformTool('rotate')).toBe(false);
		expect(getDebugTool()).toBe('none');
	});
});

describe('togglePlayback', () => {
	it('pauses and resumes, telling the game each time', () => {
		togglePlayback();
		expect(debugState.paused).toBe(true);

		togglePlayback();
		expect(debugState.paused).toBe(false);
		expect(sentOf('playback:set').map((m) => m.payload)).toEqual([
			{ paused: true },
			{ paused: false },
		]);
	});
});
