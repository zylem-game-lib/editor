/**
 * The entity mirror feeds the editor's Solid store.
 *
 * The valtio list is merged in place, so the store must never hold its proxies:
 * an entity would be compared with itself on every update and the inspector
 * would never see it move.
 */

import { getVersion, proxy } from 'valtio/vanilla';
import { describe, expect, it } from 'vitest';

import { createEntityMirror } from '../../src/components/stages/entity-mirror';
import type { BaseEntityInterface } from '../../src/types';

type Entity = Partial<BaseEntityInterface>;

function entityList() {
	return proxy<{ entities: Entity[] }>({
		entities: [
			{ uuid: 'crate', name: 'Crate', position: { x: 0, y: 0.5, z: 0 } },
			{ uuid: 'ball', name: 'Ball', position: { x: 2, y: 3, z: 0 } },
		],
	});
}

describe('createEntityMirror', () => {
	it('hands the store plain copies, never the valtio proxies', () => {
		const state = entityList();
		const mirror = createEntityMirror<Entity>();

		const mirrored = mirror(state.entities, []);

		expect(mirrored).toEqual([
			{ uuid: 'crate', name: 'Crate', position: { x: 0, y: 0.5, z: 0 } },
			{ uuid: 'ball', name: 'Ball', position: { x: 2, y: 3, z: 0 } },
		]);
		for (const entity of mirrored) {
			expect(getVersion(entity)).toBeUndefined();
			expect(getVersion(entity.position)).toBeUndefined();
		}
	});

	it("returns the store's own object for an entity that has not changed", () => {
		// What keeps an update cheap: reconcile skips these by identity.
		const state = entityList();
		const mirror = createEntityMirror<Entity>();
		const first = mirror(state.entities, []);

		const second = mirror(state.entities, first);

		expect(second[0]).toBe(first[0]);
		expect(second[1]).toBe(first[1]);
	});

	it('copies an entity again after it moves in place', () => {
		// The way `applyEntityUpsert` writes a new pose: same proxy, new field.
		const state = entityList();
		const mirror = createEntityMirror<Entity>();
		const first = mirror(state.entities, []);

		const crate = state.entities[0] as Entity;
		crate.position = { x: 1.25, y: 0.5, z: 0 };
		const second = mirror(state.entities, first);

		expect(second[0]).not.toBe(first[0]);
		expect(second[0]?.position).toEqual({ x: 1.25, y: 0.5, z: 0 });
		expect(second[1]).toBe(first[1]);
	});
});
