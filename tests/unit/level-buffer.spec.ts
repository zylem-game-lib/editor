import { describe, expect, it } from 'vitest';

import {
	type LevelCatalogType,
	type LevelSourceEntity,
	removeLevelEntries,
	resolveCatalogTypeId,
	seedLevelBuffer,
	upsertLevelEntries,
} from '../../src/components/level/level-buffer';

const catalog: LevelCatalogType[] = [
	{ id: 'box', label: 'Box' },
	{ id: 'sphere', label: 'Sphere' },
];

const box: LevelSourceEntity = {
	uuid: 'crate',
	type: 'Box',
	position: { x: 1, y: 0, z: 0 },
	rotation: { x: 0, y: 0, z: 0 },
	scale: { x: 1, y: 1, z: 1 },
};

describe('resolveCatalogTypeId', () => {
	it('matches a catalog id, then a constructor-symbol label', () => {
		expect(resolveCatalogTypeId('box', catalog)).toBe('box');
		expect(resolveCatalogTypeId('Box', catalog)).toBe('box');
		expect(resolveCatalogTypeId('Actor', catalog)).toBeNull();
		expect(resolveCatalogTypeId(undefined, catalog)).toBeNull();
	});
});

describe('level buffer edits', () => {
	it('seeds only entities the catalog can spawn, in stage order', () => {
		const buffer = seedLevelBuffer(
			[box, { uuid: 'ghost', type: 'Actor' }, { type: 'Box' }, { uuid: 'orb', type: 'sphere' }],
			catalog
		);

		expect(buffer).toEqual({
			version: 1,
			entries: [
				{
					id: 'crate',
					typeId: 'box',
					pose: {
						position: { x: 1, y: 0, z: 0 },
						rotation: { x: 0, y: 0, z: 0 },
						scale: { x: 1, y: 1, z: 1 },
					},
				},
				{ id: 'orb', typeId: 'sphere', pose: {} },
			],
		});
	});

	it('updates a recorded pose and appends a new entry', () => {
		const seeded = seedLevelBuffer([box], catalog);
		const next = upsertLevelEntries(
			seeded,
			[
				{ uuid: 'crate', type: 'Box', position: { x: 4, y: 2, z: 0 } },
				{ uuid: 'orb', type: 'Sphere', position: { x: 0, y: 1, z: 0 } },
			],
			catalog
		);

		expect(next.entries.map((entry) => entry.id)).toEqual(['crate', 'orb']);
		expect(next.entries[0]?.pose.position).toEqual({ x: 4, y: 2, z: 0 });
		// A pose-only upsert keeps the scale the seed already recorded.
		expect(next.entries[0]?.pose.scale).toEqual({ x: 1, y: 1, z: 1 });
	});

	it('drops an entry whose type no longer resolves, and entries named in a removal', () => {
		const seeded = seedLevelBuffer([box, { uuid: 'orb', type: 'sphere' }], catalog);
		const unresolved = upsertLevelEntries(seeded, [{ uuid: 'crate', type: 'Actor' }], catalog);
		expect(unresolved.entries.map((entry) => entry.id)).toEqual(['orb']);

		expect(removeLevelEntries(unresolved, ['orb', 'missing']).entries).toEqual([]);
		expect(removeLevelEntries(seeded, ['missing'])).toBe(seeded);
	});
});
