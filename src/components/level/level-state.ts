/**
 * Level mode.
 *
 * The document is the file. Turning the mode on shows it in the game; turning
 * it off removes that preview and leaves the stage's own entities alone.
 * Stage updates are not written back. Undo while the mode is on rewinds the
 * document, not the live scene.
 */

import type {
	LevelDocument,
	LevelElementMode,
	LevelElementRef,
	LevelGesture,
	LevelLayerId,
	LevelPlacementArm,
	LevelSelectPayload,
} from '@zylem/bridge';
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

export type {
	LevelDocument,
	LevelElementMode,
	LevelElementRef,
	LevelGesture,
	LevelLayerId,
	LevelPlacementArm,
	LevelSpawnKind as SpawnKind,
} from '@zylem/bridge';
export { invalidSolidIds, layerOf } from './level-document';

const MAX_LEVEL_HISTORY = 100;

export interface LevelState {
	active: boolean;
	document: LevelDocument;
	/** Layers left out of the edit preview. Play streams every layer. */
	hiddenLayers: LevelLayerId[];
	activeLayer: LevelLayerId;
	selectedIds: string[];
	/** What a click on a solid picks. */
	elementMode: LevelElementMode;
	/** Selected vertices, edges, or faces while an element mode is on. */
	selectedElements: LevelElementRef[];
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
	selectedElements: LevelElementRef[];
}

export const levelState = proxy<LevelState>({
	active: false,
	document: createLevelDocument(),
	hiddenLayers: [],
	activeLayer: 'solid',
	selectedIds: [],
	elementMode: 'object',
	selectedElements: [],
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

/** Every edit replaces the document object, so its JSON only changes when the object does. */
let fingerprintedDocument: LevelDocument | null = null;
let documentFingerprint = '';
/** {@link levelDocumentFingerprint} at the last save or load. */
let savedFingerprint = JSON.stringify(levelState.document);

function publishHistory(): void {
	levelState.undoDepth = undoStack.length;
	levelState.redoDepth = redoStack.length;
	levelState.undoLabel = undoStack[undoStack.length - 1]?.label ?? null;
	levelState.redoLabel = redoStack[redoStack.length - 1]?.label ?? null;
}

function cloneElements(elements: readonly LevelElementRef[]): LevelElementRef[] {
	return elements.map((element) => ({
		brushId: element.brushId,
		kind: element.kind,
		planes: [...element.planes],
	}));
}

/** The document and selection as they are now, for an undo or redo entry. */
function currentEntry(label: string): LevelHistoryEntry {
	return {
		label,
		document: cloneLevelDocument(levelState.document),
		selectedIds: [...levelState.selectedIds],
		selectedElements: cloneElements(levelState.selectedElements),
	};
}

function restoreEntry(entry: LevelHistoryEntry): void {
	levelState.document = entry.document;
	levelState.selectedIds = entry.selectedIds;
	levelState.selectedElements = entry.selectedElements;
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
		elementMode: levelState.elementMode,
		elements: cloneElements(levelState.selectedElements),
		activeLayer: levelState.activeLayer,
		placement: levelState.placement ? clonePlacement(levelState.placement) : null,
	});
}

/** Switch what a click on a solid picks. Leaving an element mode drops the element selection. */
export function setLevelElementMode(mode: LevelElementMode): void {
	if (levelState.elementMode === mode) return;
	levelState.elementMode = mode;
	levelState.selectedElements = [];
	syncLevelDocument();
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

/** A click in the game's level preview. */
export function applyLevelSelect(payload: LevelSelectPayload): void {
	selectLevelObject(payload.id);
}

const GESTURE_LABELS: Record<
	Exclude<LevelGesture['kind'], 'primitive' | 'element-move' | 'transform'>,
	string
> = {
	clip: 'Clip brush',
	'face-move': 'Move face',
	'face-extrude': 'Extrude face',
	shear: 'Shear face',
	doodad: 'Place doodad',
	spawn: 'Place spawn',
	trigger: 'Place trigger',
	delete: 'Delete',
};

const PRIMITIVE_LABELS = {
	box: 'Draw box',
	wedge: 'Draw wedge',
	cylinder: 'Draw cylinder',
	arch: 'Draw arch',
};
const ELEMENT_LABELS = { vertex: 'Move vertex', edge: 'Move edge', face: 'Move face' };
const TRANSFORM_LABELS = { translate: 'Move', rotate: 'Rotate', scale: 'Scale' };

/** The undo label for a gesture. */
export function levelGestureLabel(gesture: LevelGesture): string {
	switch (gesture.kind) {
		case 'primitive':
			return PRIMITIVE_LABELS[gesture.shape.shape];
		case 'element-move': {
			const kinds = new Set(gesture.elements.map((element) => element.kind));
			const [only] = kinds;
			return kinds.size === 1 && only ? ELEMENT_LABELS[only] : 'Move elements';
		}
		case 'transform':
			return TRANSFORM_LABELS[gesture.transform.kind];
		default:
			return GESTURE_LABELS[gesture.kind];
	}
}

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
	pushUndo(currentEntry(levelGestureLabel(gesture)));
	levelState.document = edit.document;
	levelState.selectedIds = edit.selectIds;
	levelState.selectedElements = edit.selectElements ?? [];
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
	pushUndo({ ...currentEntry(label), document: before });
}

export function undoLevel(): boolean {
	const entry = undoStack.pop();
	if (!entry) return false;
	redoStack.push(currentEntry(entry.label));
	restoreEntry(entry);
	publishHistory();
	syncLevelDocument();
	return true;
}

export function redoLevel(): boolean {
	const entry = redoStack.pop();
	if (!entry) return false;
	undoStack.push(currentEntry(entry.label));
	restoreEntry(entry);
	publishHistory();
	syncLevelDocument();
	return true;
}

/** A plain copy of the document, safe to write to a file. */
export function snapshotLevelDocument(): LevelSnapshot {
	return { document: cloneLevelDocument(levelState.document) };
}

/** The document as JSON, for comparing against the saved one. */
export function levelDocumentFingerprint(): string {
	if (levelState.document !== fingerprintedDocument) {
		fingerprintedDocument = levelState.document;
		documentFingerprint = JSON.stringify(levelState.document);
	}
	return documentFingerprint;
}

/** Record the document with this fingerprint as saved. Defaults to the document as it is now. */
export function markLevelSaved(fingerprint: string = levelDocumentFingerprint()): void {
	savedFingerprint = fingerprint;
}

/** Whether the document differs from the saved one. Undoing back to it reads as saved. */
export function levelHasUnsavedChanges(): boolean {
	return levelDocumentFingerprint() !== savedFingerprint;
}

/** Replace the document. Drops undo. Syncs when level mode is on. The loaded document counts as saved. */
export function loadLevelDocument(document: LevelDocument): void {
	if (document.version !== 2) return;
	levelState.document = cloneLevelDocument(document);
	levelState.selectedIds = [];
	levelState.selectedElements = [];
	undoStack.length = 0;
	redoStack.length = 0;
	markLevelSaved();
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
	levelState.elementMode = 'object';
	levelState.selectedElements = [];
	levelState.placement = null;
	undoStack.length = 0;
	redoStack.length = 0;
	markLevelSaved();
	publishHistory();
	resetLevelIds();
}

function clonePlacement(placement: LevelPlacementArm): LevelPlacementArm {
	return JSON.parse(JSON.stringify(placement)) as LevelPlacementArm;
}
