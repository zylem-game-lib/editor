import { boxBrush, type LevelDocument } from '@zylem/bridge';
import { describe, expect, it } from 'vitest';
import { solidsBySector } from '../../src/components/level/level-sectors';

/** A unit cube with its center at `(x + 0.5, 0.5, z + 0.5)`. */
function cube(id: string, x: number, z: number) {
	return { id, planes: boxBrush({ x, y: 0, z }, { x: x + 1, y: 1, z: z + 1 }) };
}

function documentOf(solids: LevelDocument['solids'], size?: number): LevelDocument {
	return {
		version: 2,
		solids,
		doodads: [],
		entities: [],
		...(size ? { sectors: { size } } : {}),
	};
}

const summary = (document: LevelDocument) =>
	solidsBySector(document).map((group) => [group.key, group.solids.map((solid) => solid.id)]);

describe('solidsBySector', () => {
	it('groups solids by the sector holding their center, sorted by x then z', () => {
		const document = documentOf([
			cube('far', 40, 0),
			cube('origin', 1, 1),
			cube('west', -3, 5),
			cube('north', 2, 33),
			cube('origin-2', 30, 30),
		]);
		expect(summary(document)).toEqual([
			['-1:0', ['west']],
			['0:0', ['origin', 'origin-2']],
			['0:1', ['north']],
			['1:0', ['far']],
		]);
	});

	it('uses the document sector size', () => {
		const document = documentOf([cube('a', 1, 1), cube('b', 9, 1)], 8);
		expect(summary(document)).toEqual([
			['0:0', ['a']],
			['1:0', ['b']],
		]);
	});

	it('puts solids that do not compile last, with no sector', () => {
		const flat = { id: 'flat', planes: boxBrush({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }) };
		const groups = solidsBySector(documentOf([flat, cube('a', 1, 1)]));
		expect(groups.map((group) => [group.key, group.coord])).toEqual([
			['0:0', { x: 0, z: 0 }],
			[null, null],
		]);
		expect(groups[1]?.solids.map((solid) => solid.id)).toEqual(['flat']);
	});

	it('is empty with no solids', () => {
		expect(solidsBySector(documentOf([]))).toEqual([]);
	});
});
