/**
 * Level mode.
 *
 * The document is the file. Turning the mode on shows it in the game; turning
 * it off removes that preview and leaves the stage's own entities alone.
 * Stage updates are not written back. Undo while the mode is on rewinds the
 * document, not the live scene.
 */

import { proxy } from 'valtio/vanilla';
import { sendLevelClose, sendLevelPlay, sendLevelSync } from '../../bridge/commands';
import { mirrorProxy } from '../common/proxy-mirror';
import {
	applyLevelGesture,
	cloneLevelDocument,
	createLevelDocument,
	createLevelId,
	type EntityFieldPatch,
	layerOf,
	resetLevelIds,
	withEntityFields,
} from './level-document';
import type { LevelDocument, LevelGesture, LevelLayerId, LevelPlacementArm } from './level-types';

export { invalidSolidIds, layerOf } from './level-document';
export type {
	LevelDocument,
	LevelGesture,
	LevelLayerId,
	LevelPlacementArm,
	SpawnKind,
} from './level-types';

const MAX_LEVEL_HISTORY = 100;

export interface LevelState {
	active: boolean;
	document: LevelDocument;
	/** Layers left out of the edit preview. Play streams every layer. */
	hiddenLayers: LevelLayerId[];
	activeLayer: LevelLayerId;
	selectedIds: string[];
	placement: LevelPlacementArm | null;
	undoDepth: number;
	redoDepth: number;
	undoLabel: string | null;
	redoLabel: string | null;
}

export interface LevelSnapshot {
	document: LevelDocument;
}

interface LevelHistoryEntry {
	label: string;
	document: LevelDocument;
	selectedIds: string[];
}

export const levelState = proxy<LevelState>({
	active: false,
	document: createLevelDocument(),
	hiddenLayers: [],
	activeLayer: 'solid',
	selectedIds: [],
	placement: null,
	undoDepth: 0,
	redoDepth: 0,
	undoLabel: null,
	redoLabel: null,
});

/** Solid-reactive view of {@link levelState}, for components. */
export const levelStore = mirrorProxy(levelState);

const undoStack: LevelHistoryEntry[] = [];
const redoStack: LevelHistoryEntry[] = [];

function publishHistory(): void {
	levelState.undoDepth = undoStack.length;
	levelState.redoDepth = redoStack.length;
	levelState.undoLabel = undoStack[undoStack.length - 1]?.label ?? null;
	levelState.redoLabel = redoStack[redoStack.length - 1]?.label ?? null;
}

function pushUndo(entry: LevelHistoryEntry): void {
	undoStack.push(entry);
	if (undoStack.length > MAX_LEVEL_HISTORY) undoStack.shift();
	redoStack.length = 0;
	publishHistory();
}

/** Whether level mode is on. Undo and redo read this and stay on the document. */
export function isLevelEditorActive(): boolean {
	return levelState.active;
}

export function levelCanUndo(): boolean {
	return undoStack.length > 0;
}

export function levelCanRedo(): boolean {
	return redoStack.length > 0;
}

export function levelUndoLabel(): string | null {
	return levelState.undoLabel;
}

export function levelRedoLabel(): string | null {
	return levelState.redoLabel;
}

/** Enter or leave level mode. Entering shows the current document; it does not reseed from the stage. */
export function setLevelEditorActive(active: boolean): void {
	if (levelState.active === active) return;
	levelState.active = active;
	if (!active) {
		levelState.placement = null;
		sendLevelClose();
		return;
	}
	syncLevelDocument();
}

export function toggleLevelEditor(): void {
	setLevelEditorActive(!levelState.active);
}

/** Push the edit preview. No-op while level mode is off. */
export function syncLevelDocument(): void {
	if (!levelState.active) return;
	sendLevelSync({
		document: cloneLevelDocument(levelState.document),
		hiddenLayers: [...levelState.hiddenLayers],
		selectedIds: [...levelState.selectedIds],
		activeLayer: levelState.activeLayer,
		placement: levelState.placement ? clonePlacement(levelState.placement) : null,
	});
}

/** Ask the game to spawn collision and live trigger zones from the document. */
export function playLevelDocument(): void {
	if (!levelState.active) return;
	sendLevelPlay(cloneLevelDocument(levelState.document));
}

export function setActiveLayer(layer: LevelLayerId): void {
	levelState.activeLayer = layer;
	if (levelState.active) syncLevelDocument();
}

export function toggleLevelLayerHidden(layer: LevelLayerId): void {
	const hidden = new Set(levelState.hiddenLayers);
	if (hidden.has(layer)) hidden.delete(layer);
	else hidden.add(layer);
	levelState.hiddenLayers = [...hidden];
	syncLevelDocument();
}

export function setLevelPlacement(placement: LevelPlacementArm | null): void {
	levelState.placement = placement;
	if (levelState.active) syncLevelDocument();
}

/** Select a document object. Empty clears. Not an undo step. */
export function selectLevelObject(id: string | null): void {
	levelState.selectedIds = id ? [id] : [];
	if (id) {
		const layer = layerOf(levelState.document, id);
		if (layer) levelState.activeLayer = layer;
	}
	if (levelState.active) syncLevelDocument();
}

const GESTURE_LABELS: Record<LevelGesture['kind'], string> = {
	brush: 'Draw brush',
	clip: 'Clip brush',
	vertex: 'Move vertex',
	translate: 'Move',
	doodad: 'Place doodad',
	spawn: 'Place spawn',
	trigger: 'Place trigger',
	delete: 'Delete',
};

/** Apply a gesture from the game. A rejected edit syncs the current document so the ghost resets. */
export function applyIncomingGesture(gesture: LevelGesture): void {
	if (!levelState.active) return;
	const edit = applyLevelGesture(
		levelState.document,
		gesture,
		createLevelId,
		levelState.selectedIds
	);
	if (!edit) {
		syncLevelDocument();
		return;
	}
	pushUndo({
		label: GESTURE_LABELS[gesture.kind],
		document: cloneLevelDocument(levelState.document),
		selectedIds: [...levelState.selectedIds],
	});
	levelState.document = edit.document;
	levelState.selectedIds = edit.selectIds;
	syncLevelDocument();
}

/** Document as it is now, for an inspector edit that commits on blur. */
export function captureLevelEdit(): LevelDocument {
	return cloneLevelDocument(levelState.document);
}

/** Write inspector fields immediately. Undo is {@link commitLevelEdit} on blur. */
export function patchLevelEntity(id: string, patch: EntityFieldPatch): void {
	const entities = levelState.document.entities.map((entity) =>
		entity.id === id ? withEntityFields(entity, patch) : entity
	);
	levelState.document = { ...levelState.document, entities };
	syncLevelDocument();
}

/** Record an inspector edit that already changed the document, if it differs from `before`. */
export function commitLevelEdit(before: LevelDocument, label: string): void {
	if (JSON.stringify(before) === JSON.stringify(cloneLevelDocument(levelState.document))) return;
	pushUndo({ label, document: before, selectedIds: [...levelState.selectedIds] });
}

export function undoLevel(): boolean {
	const entry = undoStack.pop();
	if (!entry) return false;
	redoStack.push({
		label: entry.label,
		document: cloneLevelDocument(levelState.document),
		selectedIds: [...levelState.selectedIds],
	});
	levelState.document = entry.document;
	levelState.selectedIds = entry.selectedIds;
	publishHistory();
	syncLevelDocument();
	return true;
}

export function redoLevel(): boolean {
	const entry = redoStack.pop();
	if (!entry) return false;
	undoStack.push({
		label: entry.label,
		document: cloneLevelDocument(levelState.document),
		selectedIds: [...levelState.selectedIds],
	});
	levelState.document = entry.document;
	levelState.selectedIds = entry.selectedIds;
	publishHistory();
	syncLevelDocument();
	return true;
}

/** A plain copy of the document, safe to write to a file. */
export function snapshotLevelDocument(): LevelSnapshot {
	return { document: cloneLevelDocument(levelState.document) };
}

/** Replace the document. Drops undo. Syncs when level mode is on. */
export function loadLevelDocument(document: LevelDocument): void {
	if (document.version !== 2) return;
	levelState.document = cloneLevelDocument(document);
	levelState.selectedIds = [];
	undoStack.length = 0;
	redoStack.length = 0;
	publishHistory();
	if (levelState.active) syncLevelDocument();
}

/** Test hook. Does not talk to the game. */
export function resetLevelEditor(): void {
	levelState.active = false;
	levelState.document = createLevelDocument();
	levelState.hiddenLayers = [];
	levelState.activeLayer = 'solid';
	levelState.selectedIds = [];
	levelState.placement = null;
	undoStack.length = 0;
	redoStack.length = 0;
	publishHistory();
	resetLevelIds();
}

function clonePlacement(placement: LevelPlacementArm): LevelPlacementArm {
	return JSON.parse(JSON.stringify(placement)) as LevelPlacementArm;
}
