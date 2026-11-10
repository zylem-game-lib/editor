/**
 * Saving.
 *
 * The editor writes no files. A save hands the host the current stage and level
 * document, and the host decides where they go; Creator relays them to its
 * shell. "Unsaved" means the scene history or the level document has moved off
 * the point the last save captured, so undoing back to it reads as saved again.
 *
 * Off until a host turns it on, so an embed that never listens does not get a
 * Save button that goes nowhere.
 */

import type { LevelDocument, SceneOperationPayload } from '@zylem/bridge';
import { proxy, subscribe } from 'valtio/vanilla';
import { mirrorProxy } from '../common/proxy-mirror';
import {
	historyHasUnsavedChanges,
	historyHead,
	historyState,
	markHistorySaved,
	unsavedOperations,
} from '../history/history-store';
import {
	levelDocumentFingerprint,
	levelHasUnsavedChanges,
	levelState,
	markLevelSaved,
	snapshotLevelDocument,
} from '../level/level-state';
import { buildStageExport, type StageExport } from '../stages/stage-export';

/** What a save hands the host. Plain JSON, so it can be posted to another window. */
export interface EditorSave {
	/** Unique per save, for matching a host's reply. */
	saveId: string;
	/** Stage settings and every entity's pose, as Export Stage writes them. */
	stage: StageExport;
	/**
	 * Scene operations still applied since the last save. Creates carry the
	 * catalog id. Undone operations are not included.
	 */
	operations: SceneOperationPayload[];
	/** The Level Builder document. Empty if the level was never edited. */
	level: LevelDocument;
}

/** Fired on `<zylem-editor>` for each save. Bubbles and crosses shadow roots. */
export const EDITOR_SAVE_EVENT = 'zylem-editor-save';

/** `detail` of {@link EDITOR_SAVE_EVENT}. */
export interface EditorSaveEventDetail {
	save: EditorSave;
	/**
	 * Keep the editor on "Saving…" until `promise` settles. A rejection marks the
	 * save failed, with its message. Call it while the event is being dispatched;
	 * without it, the save is done as soon as the event returns.
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}

/** Delivers a save to the host. Rejects with the reason the host could not take it. */
export type SaveDispatcher = (save: EditorSave) => Promise<void>;

export type SaveStatus = 'idle' | 'saving' | 'failed';

export interface SaveState {
	/** Whether a host listens for saves. Shows the Save button and claims Cmd/Ctrl+S. */
	enabled: boolean;
	/** Whether the scene or the level document has moved off the last save. */
	dirty: boolean;
	status: SaveStatus;
	/** Why the last save failed, while `status` is `'failed'`. */
	error: string | null;
}

export const saveState = proxy<SaveState>({
	enabled: false,
	dirty: false,
	status: 'idle',
	error: null,
});

/** Solid-reactive view of {@link saveState}, for components. */
export const saveStore = mirrorProxy(saveState);

let dispatcher: SaveDispatcher | null = null;
let saveCount = 0;

/** Whether anything has changed since the last save. */
export function hasUnsavedChanges(): boolean {
	return historyHasUnsavedChanges() || levelHasUnsavedChanges();
}

function refreshSaveState(): void {
	const dirty = hasUnsavedChanges();
	if (saveState.dirty !== dirty) saveState.dirty = dirty;
	// Undoing back to the saved point leaves nothing for the failure to be about.
	if (!dirty && saveState.status === 'failed') {
		saveState.status = 'idle';
		saveState.error = null;
	}
}

/** Turn saving on or off. The web component calls this for its `enableSave` option. */
export function setSaveEnabled(enabled: boolean): void {
	if (saveState.enabled !== enabled) saveState.enabled = enabled;
}

function buildEditorSave(): EditorSave {
	saveCount += 1;
	return {
		saveId: `save-${Date.now().toString(36)}-${saveCount}`,
		stage: buildStageExport(),
		operations: unsavedOperations(),
		level: snapshotLevelDocument().document,
	};
}

function describeFailure(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === 'string' && error) return error;
	return 'The host did not save.';
}

/** Whether {@link requestSave} would do anything: saving is on, something changed, and no save is in flight. */
export function canSave(): boolean {
	return (
		saveState.enabled && dispatcher !== null && saveState.status !== 'saving' && hasUnsavedChanges()
	);
}

/**
 * Save the current state.
 *
 * Does nothing unless {@link canSave}. The saved points are captured before the
 * host sees the payload, so an edit that lands while the host is still writing
 * stays unsaved.
 *
 * @returns Whether the host took the save.
 */
export async function requestSave(): Promise<boolean> {
	const dispatch = dispatcher;
	if (!dispatch || !canSave()) return false;

	const head = historyHead();
	const fingerprint = levelDocumentFingerprint();
	const save = buildEditorSave();
	saveState.status = 'saving';
	saveState.error = null;

	try {
		await dispatch(save);
	} catch (error) {
		saveState.status = 'failed';
		saveState.error = describeFailure(error);
		return false;
	}

	markHistorySaved(head);
	markLevelSaved(fingerprint);
	saveState.status = 'idle';
	refreshSaveState();
	return true;
}

/**
 * Keep {@link SaveState.dirty} current and send saves to `dispatch`.
 *
 * @returns A function that disconnects both.
 */
export function connectSaveTracking(dispatch: SaveDispatcher): () => void {
	dispatcher = dispatch;
	refreshSaveState();
	const unsubscribes = [
		subscribe(historyState, () => refreshSaveState()),
		subscribe(levelState, () => refreshSaveState()),
	];

	return () => {
		if (dispatcher === dispatch) dispatcher = null;
		for (const unsubscribe of unsubscribes) unsubscribe();
	};
}
