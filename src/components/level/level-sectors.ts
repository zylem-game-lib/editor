/**
 * The level panel's sector view: solids grouped by the sector holding their
 * center, on the document's grid.
 */

import {
	type BrushSolid,
	type LevelDocument,
	type SectorCoord,
	sectorKey,
	sectorOf,
	sectorSizeOf,
} from '@zylem/bridge';

export interface SectorGroup {
	/** `x:z`, or `null` for solids that do not compile and so have no center. */
	key: string | null;
	coord: SectorCoord | null;
	solids: BrushSolid[];
}

/** Sorted by x then z. Solids that do not compile come last, in a group with no sector. */
export function solidsBySector(document: LevelDocument): SectorGroup[] {
	const size = sectorSizeOf(document);
	const sectors = new Map<string, { key: string; coord: SectorCoord; solids: BrushSolid[] }>();
	const broken: BrushSolid[] = [];
	for (const solid of document.solids) {
		const coord = sectorOf(solid.planes, size);
		if (!coord) {
			broken.push(solid);
			continue;
		}
		const key = sectorKey(coord);
		const group = sectors.get(key);
		if (group) group.solids.push(solid);
		else sectors.set(key, { key, coord, solids: [solid] });
	}
	const groups: SectorGroup[] = [...sectors.values()].sort(
		(a, b) => a.coord.x - b.coord.x || a.coord.z - b.coord.z
	);
	if (broken.length > 0) groups.push({ key: null, coord: null, solids: broken });
	return groups;
}
