/**
 * Plain copies of the valtio entity list, for the editor's Solid store.
 *
 * `sync-entities.ts` merges upserts into the list in place, so an entity keeps
 * the same proxy while it moves. Reconciling those proxies straight into a Solid
 * store shares the objects: the store then compares each entity with itself,
 * finds nothing changed, and the inspector keeps showing the old pose.
 */

import { getVersion } from 'valtio/vanilla';
import { copy } from '../common/proxy-mirror';

/**
 * Build the list a store reconciles from.
 *
 * An entity unchanged since it was last copied comes back as the store's own
 * object, so `reconcile` passes over it by identity and only changed entities
 * are diffed. Copying the whole list on every update would re-diff every entity
 * each time, which is what froze spawn-heavy games before.
 *
 * Each store needs its own mirror: the versions recorded here describe what
 * that store was last given.
 */
export function createEntityMirror<T extends { uuid?: string }>() {
	/** Entity proxy → its valtio version when it was last copied. */
	const copiedAt = new WeakMap<object, number>();

	/**
	 * @param source The valtio list (`stageState.entities`).
	 * @param current The store's raw list (`unwrap(stage.entities)`).
	 */
	return (source: readonly T[], current: readonly T[]): T[] => {
		const currentByUuid = new Map<string, T>();
		for (const entity of current) {
			if (entity.uuid) currentByUuid.set(entity.uuid, entity);
		}

		return source.map((entity) => {
			const version = getVersion(entity);
			const previous = entity.uuid ? currentByUuid.get(entity.uuid) : undefined;
			if (previous && version !== undefined && copiedAt.get(entity) === version) {
				return previous;
			}
			if (version !== undefined) copiedAt.set(entity, version);
			return copy(entity);
		});
	};
}
