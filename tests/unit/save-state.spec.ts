import {
	DEFAULT_DRAW_SHAPE,
	frameForPlane,
	getZylemBridge,
	type SceneOperationPayload,
} from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	canUndo,
	clearHistory,
	MAX_HISTORY_DEPTH,
	pushOperation,
	redo,
	undo,
} from '../../src/components/history/history-store';
import {
	applyIncomingGesture,
	resetLevelEditor,
	setLevelEditorActive,
	undoLevel,
} from '../../src/components/level/level-state';
import {
	connectSaveTracking,
	type EditorSave,
	hasUnsavedChanges,
	requestSave,
	type SaveDispatcher,
	saveState,
	setSaveEnabled,
} from '../../src/components/save/save-state';

function operation(opId: string): SceneOperationPayload {
	return {
		opId,
		kind: 'transform',
		label: `Move ${opId}`,
		entries: [
			{
				uuid: `entity-${opId}`,
				before: { position: { x: 0, y: 0, z: 0 } },
				after: { position: { x: 1, y: 0, z: 0 } },
			},
		],
	};
}

function undoAll(): void {
	while (canUndo()) undo();
}

function drawBrush(): void {
	applyIncomingGesture({
		kind: 'primitive',
		frame: frameForPlane({ x: 0, y: 1, z: 0 }, 0),
		footprint: { u0: 0, v0: 0, u1: 1, v1: 1 },
		height: 1,
		shape: { ...DEFAULT_DRAW_SHAPE },
	});
}

let saves: EditorSave[];
let disconnect: (() => void) | null = null;

/** A host that stores every save straight away. */
const storeSave: SaveDispatcher = async (save) => {
	saves.push(save);
};

function connectHost(dispatch: SaveDispatcher = storeSave): void {
	disconnect?.();
	disconnect = connectSaveTracking(dispatch);
}

beforeEach(() => {
	resetLevelEditor();
	getZylemBridge().channel.reset();
	clearHistory();
	saves = [];
	saveState.status = 'idle';
	saveState.error = null;
	setSaveEnabled(true);
	connectHost();
});

afterEach(() => {
	disconnect?.();
	disconnect = null;
	setSaveEnabled(false);
});

describe('unsaved changes', () => {
	it('starts with nothing to save', async () => {
		expect(hasUnsavedChanges()).toBe(false);
		expect(await requestSave()).toBe(false);
		expect(saves).toHaveLength(0);
	});

	it('marks a scene edit unsaved until the host takes it', async () => {
		pushOperation(operation('a'));
		expect(hasUnsavedChanges()).toBe(true);

		expect(await requestSave()).toBe(true);
		expect(saves).toHaveLength(1);
		expect(hasUnsavedChanges()).toBe(false);
	});

	it('reads as saved again after undoing back to the saved point', async () => {
		pushOperation(operation('a'));
		await requestSave();
		pushOperation(operation('b'));
		expect(hasUnsavedChanges()).toBe(true);

		undo();
		expect(hasUnsavedChanges()).toBe(false);

		undo();
		expect(hasUnsavedChanges()).toBe(true);

		redo();
		expect(hasUnsavedChanges()).toBe(false);

		redo();
		expect(hasUnsavedChanges()).toBe(true);
	});

	it('reads as saved after undoing a level edit back to the saved document', async () => {
		setLevelEditorActive(true);
		drawBrush();
		expect(hasUnsavedChanges()).toBe(true);

		undoLevel();
		expect(hasUnsavedChanges()).toBe(false);

		drawBrush();
		expect(await requestSave()).toBe(true);
		expect(hasUnsavedChanges()).toBe(false);
	});

	it('treats a freshly loaded stage as saved', () => {
		pushOperation(operation('a'));
		expect(hasUnsavedChanges()).toBe(true);

		clearHistory();
		expect(hasUnsavedChanges()).toBe(false);
	});

	it('keeps the saved point honest once the depth cap drops old edits', async () => {
		// The first edit falls off the bottom, so undoing everything stops after
		// it: that is not the stage as loaded.
		for (let i = 0; i <= MAX_HISTORY_DEPTH; i += 1) pushOperation(operation(`op-${i}`));
		undoAll();
		expect(hasUnsavedChanges()).toBe(true);

		// Saved there, it is the saved point, even with the edit gone from history.
		await requestSave();
		pushOperation(operation('after'));
		undoAll();
		expect(hasUnsavedChanges()).toBe(false);
	});

	it('mirrors the flag for the toolbar', async () => {
		pushOperation(operation('a'));
		await Promise.resolve();
		expect(saveState.dirty).toBe(true);

		await requestSave();
		expect(saveState.dirty).toBe(false);
	});
});

describe('requestSave', () => {
	it('hands the host the stage and the level document', async () => {
		setLevelEditorActive(true);
		drawBrush();
		await requestSave();
		pushOperation(operation('a'));
		await requestSave();

		expect(saves).toHaveLength(2);
		expect(saves[0]?.stage.version).toBe(1);
		expect(saves[0]?.level.version).toBe(2);
		expect(saves[0]?.level.solids).toHaveLength(1);
		expect(saves[0]?.saveId).not.toBe(saves[1]?.saveId);
	});

	it('keeps the changes and says why when the host fails', async () => {
		connectHost(async () => {
			throw new Error('Disk full');
		});
		pushOperation(operation('a'));

		expect(await requestSave()).toBe(false);
		expect(saveState.status).toBe('failed');
		expect(saveState.error).toBe('Disk full');
		expect(hasUnsavedChanges()).toBe(true);

		connectHost();
		expect(await requestSave()).toBe(true);
		expect(saveState.status).toBe('idle');
		expect(saveState.error).toBeNull();
	});

	it('leaves an edit made while the host is writing unsaved', async () => {
		let finish: () => void = () => {};
		connectHost(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		pushOperation(operation('a'));

		const pending = requestSave();
		expect(saveState.status).toBe('saving');
		pushOperation(operation('b'));
		expect(await requestSave()).toBe(false);

		finish();
		expect(await pending).toBe(true);
		expect(hasUnsavedChanges()).toBe(true);

		undo();
		expect(hasUnsavedChanges()).toBe(false);
	});

	it('does nothing while saving is off', async () => {
		setSaveEnabled(false);
		pushOperation(operation('a'));

		expect(await requestSave()).toBe(false);
		expect(saves).toHaveLength(0);
	});

	it('does nothing with no host connected', async () => {
		disconnect?.();
		disconnect = null;
		pushOperation(operation('a'));

		expect(await requestSave()).toBe(false);
	});
});
