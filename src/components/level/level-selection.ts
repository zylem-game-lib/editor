/**
 * What a click in the level preview selects.
 *
 * Pure: the document, the current selection, and the click in, the next
 * selection out. A click on a grouped solid picks its whole group unless it
 * asks for the one member. Shift toggles: a hit that is wholly selected
 * leaves, anything else joins.
 */

import type {
	LevelDocument,
	LevelElementMode,
	LevelElementRef,
	LevelSelectPayload,
} from '@zylem/bridge';
import { layerOf } from './level-document';

/** The solids a click on `id` picks as a group: every solid sharing its group, or itself. */
export function groupMembers(document: LevelDocument, id: string): string[] {
	const groupId = document.solids.find((solid) => solid.id === id)?.groupId;
	if (!groupId) return [id];
	return document.solids.filter((solid) => solid.groupId === groupId).map((solid) => solid.id);
}

/** The object selection after a click. An id the document does not have counts as empty space. */
export function pickObjects(
	document: LevelDocument,
	selectedIds: readonly string[],
	payload: LevelSelectPayload
): string[] {
	const id = payload.id && layerOf(document, payload.id) ? payload.id : null;
	if (!id) return payload.additive ? [...selectedIds] : [];
	const hit = payload.ungroup ? [id] : groupMembers(document, id);
	if (!payload.additive) return hit;
	const selected = new Set(selectedIds);
	if (hit.every((entry) => selected.has(entry))) {
		const leaving = new Set(hit);
		return selectedIds.filter((entry) => !leaving.has(entry));
	}
	return [...selectedIds, ...hit.filter((entry) => !selected.has(entry))];
}

export function sameElement(a: LevelElementRef, b: LevelElementRef): boolean {
	return (
		a.brushId === b.brushId &&
		a.kind === b.kind &&
		a.planes.length === b.planes.length &&
		a.planes.every((plane, index) => plane === b.planes[index])
	);
}

function normalized(element: LevelElementRef): LevelElementRef {
	return {
		brushId: element.brushId,
		kind: element.kind,
		planes: [...element.planes].sort((a, b) => a - b),
	};
}

/**
 * The element selection after a click in an element mode. Hits of another
 * kind, or on a solid the document does not have, are dropped.
 */
export function pickElements(
	document: LevelDocument,
	mode: Exclude<LevelElementMode, 'object'>,
	selected: readonly LevelElementRef[],
	payload: LevelSelectPayload
): LevelElementRef[] {
	const solids = new Set(document.solids.map((solid) => solid.id));
	const hits: LevelElementRef[] = [];
	for (const element of payload.elements ?? []) {
		if (element.kind !== mode || !solids.has(element.brushId)) continue;
		const hit = normalized(element);
		if (!hits.some((entry) => sameElement(entry, hit))) hits.push(hit);
	}
	if (!payload.additive) return hits;
	const next = selected.map(normalized);
	for (const hit of hits) {
		const index = next.findIndex((entry) => sameElement(entry, hit));
		if (index >= 0) next.splice(index, 1);
		else next.push(hit);
	}
	return next;
}

/** The solids that own the elements, once each, in first-seen order. */
export function ownersOf(elements: readonly LevelElementRef[]): string[] {
	return [...new Set(elements.map((element) => element.brushId))];
}
