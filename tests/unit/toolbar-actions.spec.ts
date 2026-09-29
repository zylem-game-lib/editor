// @vitest-environment happy-dom

import { getZylemBridge } from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { debugStore, setDebugStore } from '../../src/components/editor-store';
import {
	debugState,
	getDebugTool,
	setDebugTool,
	setPaused,
	setSelectedEntityId,
} from '../../src/components/entities/entities-state';
import { levelState, setPlacementRole } from '../../src/components/level/level-state';
import { stageState } from '../../src/components/stages/stage-state';
import {
	catalogState,
	setArmedType,
	setEntityCatalog,
} from '../../src/components/toolbar/catalog-state';
import {
	armAddTool,
	armAddType,
	openAddPalette,
	registerAddPaletteOpener,
	selectTool,
	selectTransformTool,
	toggleDebug,
	toggleGrid,
	togglePlayback,
	toggleSnap,
	toggleTool,
	toggleTransformTool,
	transformTarget,
} from '../../src/components/toolbar/toolbar-actions';
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
	setPlacementRole(null);

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
});

describe('toggleDebug', () => {
	it('flips debug mode and tells the game', () => {
		toggleDebug();
		expect(debugStore.debug).toBe(true);
		expect(sentOf('debug:set').map((m) => m.payload)).toEqual([{ enabled: true }]);

		toggleDebug();
		expect(debugStore.debug).toBe(false);
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

	it('tags the placement role and drops it when another tool takes over', () => {
		armAddType('box', 'actor');
		expect(levelState.placementRole).toBe('actor');

		selectTool('select');
		expect(levelState.placementRole).toBeNull();
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
