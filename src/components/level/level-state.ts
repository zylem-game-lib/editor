/**
 * Level mode.
 *
 * The document is the file. Turning the mode on shows it in the game; turning
 * it off removes that preview and leaves the stage's own entities alone.
 * Stage updates are not written back. Undo while the mode is on rewinds the
 * document, not the live scene.
 */

import {
	type BridgeVec3,
	type BrushShape,
	DEFAULT_DRAW_SHAPE,
	type LevelDocument,
	type LevelDrawShape,
	type LevelElementMode,
	type LevelElementRef,
	type LevelGesture,
	type LevelLayerId,
	type LevelPlacementArm,
	type LevelSelectPayload,
} from '@zylem/bridge';
import { proxy } from 'valtio/vanilla';
import { sendLevelClose, sendLevelPlay, sendLevelSync } from '../../bridge/commands';
import { mirrorProxy } from '../common/proxy-mirror';
import { setGridVisible } from '../transform/transform-state';
import {
	applyLevelGesture,
	cloneLevelDocument,
	createLevelDocument,
	createLevelId,
	deleteObjects,
	duplicateObjects,
	type EntityFieldPatch,
	type LevelEdit,
	layerOf,
	resetLevelIds,
	resizeSectors,
	subdivideSolids,
	withEntityFields,
} from './level-document';
import { ownersOf, pickElements, pickObjects } from './level-selection';

export type {
	LevelDocument,
	LevelDrawShape,
	LevelElementMode,
	LevelElementRef,
	LevelGesture,
	LevelLayerId,
	LevelPlacementArm,
	LevelSpawnKind as SpawnKind,
} from '@zylem/bridge';
export { layerOf } from './level-document';

const MAX_LEVEL_HISTORY = 100;
export const DEFAULT_SUBDIVIDE_TILE = 4;

export interface LevelState {
	active: boolean;
	document: LevelDocument;
	/** Layers left out of the edit preview. Play streams every layer. */
	hiddenLayers: LevelLayerId[];
	/** Sector keys (`x:z`) whose solids are left out of the edit preview. */
	hiddenSectors: string[];
	/** Tint each solid by its sector in the edit preview. */
	showSectorTint: boolean;
	activeLayer: LevelLayerId;
	/** In an element mode, the solids that own the selected elements. */
	selectedIds: string[];
	/** What a click on a solid picks. */
	elementMode: LevelElementMode;
	/** Selected vertices, edges, or faces while an element mode is on. */
	selectedElements: LevelElementRef[];
	placement: LevelPlacementArm | null;
	/** The primitive the brush tool draws. */
	drawShape: LevelDrawShape;
	/** World units between the grid lines Subdivide cuts on. */
	subdivideTile: number;
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
	elementMode: LevelElementMode;
	selectedIds: string[];
	selectedElements: LevelElementRef[];
}

export const levelState = proxy<LevelState>({
	active: false,
	document: createLevelDocument(),
	hiddenLayers: [],
	hiddenSectors: [],
	showSectorTint: false,
	activeLayer: 'solid',
	selectedIds: [],
	elementMode: 'object',
	selectedElements: [],
	placement: null,
	drawShape: { ...DEFAULT_DRAW_SHAPE },
	subdivideTile: DEFAULT_SUBDIVIDE_TILE,
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
		elementMode: levelState.elementMode,
		selectedIds: [...levelState.selectedIds],
		selectedElements: cloneElements(levelState.selectedElements),
	};
}

/** The element mode comes back too, so restored elements are read in the mode that picked them. */
function restoreEntry(entry: LevelHistoryEntry): void {
	levelState.document = entry.document;
	levelState.elementMode = entry.elementMode;
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

/** Whether level mode is on with objects or elements selected. */
export function hasLevelSelection(): boolean {
	return (
		levelState.active &&
		(levelState.selectedIds.length > 0 || levelState.selectedElements.length > 0)
	);
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

/**
 * Enter or leave level mode. Entering shows the current document and turns
 * the construction grid on; it does not reseed from the stage.
 */
export function setLevelEditorActive(active: boolean): void {
	if (levelState.active === active) return;
	levelState.active = active;
	if (!active) {
		levelState.placement = null;
		sendLevelClose();
		return;
	}
	setGridVisible(true);
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
		hiddenSectors: [...levelState.hiddenSectors],
		showSectorTint: levelState.showSectorTint,
		selectedIds: [...levelState.selectedIds],
		elementMode: levelState.elementMode,
		elements: cloneElements(levelState.selectedElements),
		activeLayer: levelState.activeLayer,
		placement: levelState.placement ? clonePlacement(levelState.placement) : null,
		drawShape: { ...levelState.drawShape },
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

/** Show or hide one sector's solids in the edit preview. Not an undo step. */
export function toggleLevelSectorHidden(key: string): void {
	const hidden = new Set(levelState.hiddenSectors);
	if (hidden.has(key)) hidden.delete(key);
	else hidden.add(key);
	levelState.hiddenSectors = [...hidden];
	syncLevelDocument();
}

/** Tint solids by sector in the edit preview. Not an undo step. */
export function setLevelSectorTint(show: boolean): void {
	if (levelState.showSectorTint === show) return;
	levelState.showSectorTint = show;
	syncLevelDocument();
}

export function setLevelPlacement(placement: LevelPlacementArm | null): void {
	levelState.placement = placement;
	if (levelState.active) syncLevelDocument();
}

/** The primitive the brush draws. */
export function setLevelDrawShape(shape: BrushShape): void {
	if (levelState.drawShape.shape === shape) return;
	levelState.drawShape.shape = shape;
	syncLevelDocument();
}

type DrawOption = Exclude<keyof LevelDrawShape, 'shape'>;

function setDrawOption(option: DrawOption, value: number | null): void {
	if (value === null || levelState.drawShape[option] === value) return;
	levelState.drawShape[option] = value;
	syncLevelDocument();
}

function wholeIn(value: number, min: number, max: number): number | null {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;
}

/** Cylinder side count, 3-64. */
export function setLevelDrawSides(sides: number): void {
	setDrawOption('sides', wholeIn(sides, 3, 64));
}

/** Arch segment count, 2-32. */
export function setLevelDrawSegments(segments: number): void {
	setDrawOption('segments', wholeIn(segments, 2, 32));
}

/** Arch ring thickness. Anything but a positive number is ignored. */
export function setLevelDrawThickness(thickness: number): void {
	setDrawOption('thickness', Number.isFinite(thickness) && thickness > 0 ? thickness : null);
}

/** Quarter turns, wrapped to 0-3. */
export function setLevelDrawTurn(turn: number): void {
	setDrawOption('turn', Number.isFinite(turn) ? ((Math.round(turn) % 4) + 4) % 4 : null);
}

/** Turn the wedge a quarter. */
export function turnLevelDrawShape(): void {
	setLevelDrawTurn(levelState.drawShape.turn + 1);
}

/** World units between Subdivide's grid lines. Anything but a positive number is ignored. */
export function setLevelSubdivideTile(tile: number): void {
	if (Number.isFinite(tile) && tile > 0) levelState.subdivideTile = tile;
}

function pickLevelObjects(payload: LevelSelectPayload): void {
	levelState.selectedIds = pickObjects(levelState.document, levelState.selectedIds, payload);
	const { id } = payload;
	const layer = id && levelState.selectedIds.includes(id) ? layerOf(levelState.document, id) : null;
	if (layer) levelState.activeLayer = layer;
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

/**
 * A click on a row of the level panel: that object alone, or toggled with
 * Shift. A row is a whole object, so an element mode ends. Not an undo step.
 */
export function selectLevelRow(id: string, additive = false): void {
	if (levelState.elementMode !== 'object') {
		levelState.elementMode = 'object';
		levelState.selectedElements = [];
	}
	pickLevelObjects({ id, additive, ungroup: true });
	syncLevelDocument();
}

/**
 * A click in the game's level preview. Objects follow their group and Shift
 * toggles; in an element mode the owning solids follow the elements. Not an
 * undo step.
 */
export function applyLevelSelect(payload: LevelSelectPayload): void {
	const mode = levelState.elementMode;
	if (mode === 'object') {
		pickLevelObjects(payload);
	} else {
		const elements = pickElements(levelState.document, mode, levelState.selectedElements, payload);
		levelState.selectedElements = elements;
		levelState.selectedIds = ownersOf(elements);
	}
	syncLevelDocument();
}

/**
 * Drop the selection, objects and elements, while level mode is on.
 *
 * @returns Whether anything was selected.
 */
export function clearLevelSelection(): boolean {
	if (!levelState.active) return false;
	if (levelState.selectedIds.length === 0 && levelState.selectedElements.length === 0) return false;
	levelState.selectedIds = [];
	levelState.selectedElements = [];
	syncLevelDocument();
	return true;
}

const GESTURE_LABELS: Record<
	Exclude<LevelGesture['kind'], 'primitive' | 'element-move' | 'element-delete' | 'transform'>,
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
		case 'element-delete': {
			const kind = gesture.elements[0]?.kind;
			if (kind === 'vertex') return 'Delete vertex';
			if (kind === 'edge') return 'Delete edge';
			return 'Delete face';
		}
		case 'transform':
			return TRANSFORM_LABELS[gesture.transform.kind];
		default:
			return GESTURE_LABELS[gesture.kind];
	}
}

/** Record an edit as one undo step, then show its document and selection in `mode`. */
function commitEdit(
	label: string,
	edit: LevelEdit,
	mode: LevelElementMode = levelState.elementMode
): void {
	pushUndo(currentEntry(label));
	levelState.document = edit.document;
	levelState.elementMode = mode;
	levelState.selectedIds = edit.selectIds;
	levelState.selectedElements = edit.selectElements ?? [];
	syncLevelDocument();
}

/** Apply a gesture from the game. A rejected edit syncs the current document so the ghost resets. */
export function applyIncomingGesture(gesture: LevelGesture): boolean {
	if (!levelState.active) return false;
	const edit = applyLevelGesture(
		levelState.document,
		gesture,
		createLevelId,
		levelState.selectedIds
	);
	if (!edit) {
		syncLevelDocument();
		return false;
	}
	commitEdit(levelGestureLabel(gesture), edit);
	return true;
}

/**
 * Copy the selection `offset` away and select the copies. In an element mode
 * the owning solids are copied, and the copies are selected as objects.
 */
export function duplicateLevelSelection(offset: BridgeVec3): boolean {
	const edit = duplicateObjects(levelState.document, levelState.selectedIds, offset, createLevelId);
	if (!edit) return false;
	commitEdit('Duplicate', edit, 'object');
	return true;
}

/**
 * Cut the selected solids on the {@link LevelState.subdivideTile} grid. The
 * pieces are selected as objects.
 */
export function subdivideLevelSelection(): boolean {
	const edit = subdivideSolids(
		levelState.document,
		levelState.selectedIds,
		levelState.subdivideTile,
		createLevelId
	);
	if (!edit) return false;
	commitEdit('Subdivide', edit, 'object');
	return true;
}

/** Remove every selected object in one step. In an element mode the owning solids go. */
export function deleteLevelSelection(): boolean {
	const edit = deleteObjects(levelState.document, levelState.selectedIds);
	if (!edit) return false;
	commitEdit('Delete', edit);
	return true;
}

/** Resize the sector grid, 1 unit at the least, as an undo step. */
export function setLevelSectorSize(size: number): boolean {
	const edit = resizeSectors(
		levelState.document,
		size,
		levelState.selectedIds,
		levelState.selectedElements
	);
	if (!edit) return false;
	commitEdit('Sector size', edit);
	return true;
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
	levelState.hiddenSectors = [];
	levelState.showSectorTint = false;
	levelState.activeLayer = 'solid';
	levelState.selectedIds = [];
	levelState.elementMode = 'object';
	levelState.selectedElements = [];
	levelState.placement = null;
	levelState.drawShape = { ...DEFAULT_DRAW_SHAPE };
	levelState.subdivideTile = DEFAULT_SUBDIVIDE_TILE;
	undoStack.length = 0;
	redoStack.length = 0;
	markLevelSaved();
	publishHistory();
	resetLevelIds();
}

function clonePlacement(placement: LevelPlacementArm): LevelPlacementArm {
	return JSON.parse(JSON.stringify(placement)) as LevelPlacementArm;
}
