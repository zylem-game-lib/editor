// @vitest-environment happy-dom
import {
	boxBrush,
	getZylemBridge,
	NAVIGATION_GENERATOR,
	type NavigationAsset,
	navigationSourceHash,
} from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectEditorBridge, disconnectEditorBridge } from '../../src/bridge/connect';
import { applyStageSnapshot } from '../../src/bridge/sync-stage';
import {
	levelHasUnsavedChanges,
	levelState,
	loadLevelDocument,
	redoLevel,
	resetLevelEditor,
	snapshotLevelDocument,
	undoLevel,
} from '../../src/components/level/level-state';
import {
	applyNavigationBake,
	applyNavigationEdit,
	applyNavigationStatus,
	armNavigationTool,
	bakeNavigation,
	navigationDisplayState,
	navigationState,
	resetNavigationState,
	setNavigationSetting,
} from '../../src/components/navigation/navigation-state';
import { stageState } from '../../src/components/stages/stage-state';
import { disarmTools } from '../../src/components/toolbar/tool-shortcuts';
import { selectTool } from '../../src/components/toolbar/toolbar-actions';

const { channel } = getZylemBridge();
function stage(id: string) {
	return {
		id,
		backgroundColor: '#000000',
		backgroundImage: null,
		gravity: { x: 0, y: -9.81, z: 0 },
		inputs: {},
		variables: {},
	};
}
beforeEach(() => {
	disconnectEditorBridge();
	channel.reset();
	resetLevelEditor();
	resetNavigationState();
	stageState.config = null;
	loadLevelDocument({
		version: 2,
		solids: [{ id: 'floor', planes: boxBrush({ x: -5, y: -1, z: -5 }, { x: 5, y: 0, z: 5 }) }],
		doodads: [],
		entities: [],
	});
});
afterEach(() => {
	disconnectEditorBridge();
	channel.reset();
});
function asset(): NavigationAsset {
	return {
		version: 1,
		generator: NAVIGATION_GENERATOR,
		sourceHash: navigationSourceHash(levelState.document),
		data: 'AQID',
	};
}
describe('navigation authoring', () => {
	it('keeps settings, annotations and baked data in save/load and undo history', () => {
		bakeNavigation();
		setNavigationSetting('agentRadius', 0.8);
		applyNavigationEdit({
			stageId: 'stage',
			edit: {
				kind: 'link',
				link: {
					id: 'jump',
					start: { x: 0, y: 0, z: 0 },
					end: { x: 2, y: 0, z: 0 },
					radius: 0.8,
					bidirectional: false,
				},
			},
		});
		const baked = asset();
		applyNavigationBake({ stageId: 'stage', requestId: navigationState.requestId, asset: baked });
		expect(levelHasUnsavedChanges()).toBe(true);
		expect(levelState.document.navigation?.baked).toEqual(baked);
		undoLevel();
		expect(levelState.document.navigation?.baked).toBeUndefined();
		redoLevel();
		expect(levelState.document.navigation?.baked).toEqual(baked);
		const saved = JSON.parse(JSON.stringify(snapshotLevelDocument().document));
		loadLevelDocument(saved);
		expect(levelState.document.navigation?.settings.agentRadius).toBe(0.8);
		expect(levelState.document.navigation?.links[0].bidirectional).toBe(false);
		expect(levelState.document.navigation?.baked).toEqual(baked);
		expect(levelHasUnsavedChanges()).toBe(false);
	});
	it('reports the bake the document holds, not just the navmesh the game holds', () => {
		// Undoing a bake takes the asset out of the document without changing the
		// sources, so the game keeps its navmesh and keeps reporting `ready`. Save
		// writes the document, so that is what the panel has to describe.
		const display = () => navigationDisplayState(navigationState, levelState.document);
		bakeNavigation();
		const first = asset();
		applyNavigationStatus({ stageId: 'stage', state: 'ready', sourceHash: first.sourceHash });
		applyNavigationBake({ stageId: 'stage', requestId: navigationState.requestId, asset: first });
		expect(display()).toBe('ready');

		undoLevel();
		expect(navigationState.state).toBe('ready');
		expect(display()).toBe('empty');
		redoLevel();
		expect(display()).toBe('ready');

		// An asset baked for other sources is stale even while the game is ready.
		setNavigationSetting('agentRadius', 0.8);
		applyNavigationStatus({
			stageId: 'stage',
			state: 'ready',
			sourceHash: navigationSourceHash(levelState.document),
		});
		expect(levelState.document.navigation?.baked).toEqual(first);
		expect(display()).toBe('stale');

		// The game's own status wins whenever it is anything other than ready.
		applyNavigationStatus({ stageId: 'stage', state: 'building', sourceHash: first.sourceHash });
		expect(display()).toBe('building');
	});
	it('rejects bake responses for old inputs, requests, and stages', () => {
		bakeNavigation();
		const old = asset();
		const requestId = navigationState.requestId;
		setNavigationSetting('agentRadius', 0.7);
		applyNavigationBake({ stageId: 'stage', requestId, asset: old });
		applyNavigationBake({ stageId: 'stage', requestId: 'obsolete', asset: asset() });
		expect(levelState.document.navigation?.baked).toBeUndefined();
		applyStageSnapshot({ stage: stage('new'), entities: [] });
		applyNavigationBake({ stageId: 'old', requestId: navigationState.requestId, asset: asset() });
		applyNavigationStatus({ stageId: 'old', state: 'ready', sourceHash: 'old' });
		expect(navigationState.state).toBe('empty');
	});
	it('disarms navigation on Escape and ordinary tool selection', () => {
		armNavigationTool('obstacle');
		expect(navigationState.tool).toBe('obstacle');
		expect(disarmTools()).toBe(true);
		expect(navigationState.tool).toBe('none');
		expect(channel.getState('navigation:tool')?.tool).toBe('none');
		armNavigationTool('link');
		selectTool('select');
		expect(navigationState.tool).toBe('none');
	});
	it('hydrates after the stage and releases every navigation subscription', () => {
		channel.send('stage:snapshot', { stage: stage('stage'), entities: [] });
		channel.send('navigation:status', { stageId: 'stage', state: 'ready', sourceHash: 'hash' });
		const a = connectEditorBridge();
		const b = connectEditorBridge();
		expect(navigationState.state).toBe('ready');
		a();
		expect(channel.hasSubscribers('navigation:edit')).toBe(true);
		b();
		expect(channel.hasSubscribers('navigation:edit')).toBe(false);
		expect(channel.hasSubscribers('navigation:status')).toBe(false);
		expect(navigationState.state).toBe('empty');
	});
	it('does not commit invalid settings', () => {
		setNavigationSetting('cellSize', 0);
		expect(levelState.document.navigation).toBeUndefined();
		expect(navigationState.message).toContain('positive');
	});
});
