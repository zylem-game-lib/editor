import { type Component, createSignal, For, Show } from 'solid-js';
import {
	captureLevelEdit,
	commitLevelEdit,
	invalidSolidIds,
	levelStore,
	patchLevelEntity,
	selectLevelObject,
	setActiveLayer,
	toggleLevelLayerHidden,
} from './level-state';
import type { EntityPlacement, LevelDocument, LevelLayerId, SpawnKind } from './level-types';

const LAYERS: Array<{ id: LevelLayerId; label: string }> = [
	{ id: 'solid', label: 'Solids' },
	{ id: 'doodad', label: 'Doodads' },
	{ id: 'entity', label: 'Entities' },
];

const SPAWN_KINDS: SpawnKind[] = ['player', 'enemy', 'item'];

function rows(
	document: LevelDocument,
	layer: LevelLayerId
): Array<{ id: string; label: string; detail: string }> {
	if (layer === 'solid') {
		const invalid = new Set(invalidSolidIds(document));
		return document.solids.map((solid) => ({
			id: solid.id,
			label: 'Brush',
			detail: invalid.has(solid.id) ? 'Does not compile' : `${solid.planes.length} planes`,
		}));
	}
	if (layer === 'doodad') {
		return document.doodads.map((doodad) => ({
			id: doodad.id,
			label: doodad.typeId,
			detail: 'Visual',
		}));
	}
	return document.entities.map((entity) => ({
		id: entity.id,
		label: entity.name || entity.typeId,
		detail: entity.typeId === 'zone' ? 'Trigger' : String(entity.props.spawnKind ?? 'spawn'),
	}));
}

/**
 * The level document, by layer. Visibility is editor state: hiding a layer
 * drops it from the preview, and play still streams every layer.
 */
export const LevelSection: Component = () => {
	const document = () => levelStore.document;
	const selectedId = () => levelStore.selectedIds[0] ?? null;

	return (
		<div class="panel-content">
			<Show
				when={document().solids.length + document().doodads.length + document().entities.length > 0}
				fallback={<p class="zylem-transform-empty">Nothing in this level yet.</p>}
			>
				<For each={LAYERS}>
					{(layer) => {
						const hidden = () => levelStore.hiddenLayers.includes(layer.id);
						const active = () => levelStore.activeLayer === layer.id;
						return (
							<section class="zylem-level-layer">
								<header class="zylem-level-layer__head">
									<button
										type="button"
										class="zylem-level-layer__name"
										classList={{ 'is-active': active() }}
										onClick={() => setActiveLayer(layer.id)}
									>
										{layer.label}
									</button>
									<button
										type="button"
										class="zylem-level-layer__hide"
										onClick={() => toggleLevelLayerHidden(layer.id)}
									>
										{hidden() ? 'Show' : 'Hide'}
									</button>
								</header>
								<ul class="zylem-level-list">
									<For each={rows(document(), layer.id)}>
										{(row) => (
											<li>
												<button
													type="button"
													class="zylem-level-row"
													classList={{ 'is-selected': selectedId() === row.id }}
													onClick={() => selectLevelObject(row.id)}
												>
													<span class="zylem-level-row__type">{row.label}</span>
													<span class="zylem-level-row__role">{row.detail}</span>
												</button>
											</li>
										)}
									</For>
								</ul>
							</section>
						);
					}}
				</For>
			</Show>
			<Show when={selectedId()}>{(id) => <EntityFields id={id()} />}</Show>
		</div>
	);
};

const EntityFields: Component<{ id: string }> = (props) => {
	const entity = (): EntityPlacement | undefined =>
		levelStore.document.entities.find((entry) => entry.id === props.id);
	const [before, setBefore] = createSignal(captureLevelEdit());
	const isTrigger = () => entity()?.typeId === 'zone';
	const size = () => {
		const value = entity()?.props.size as { x?: number; y?: number; z?: number } | undefined;
		return { x: value?.x ?? 2, y: value?.y ?? 2, z: value?.z ?? 2 };
	};

	const focus = () => setBefore(captureLevelEdit());
	const blur = () => commitLevelEdit(before(), 'Edit entity');

	return (
		<div class="zylem-level-props">
			<label class="zylem-level-props__row">
				<span>Name</span>
				<input
					class="zylem-transform-row__field"
					value={entity()?.name ?? ''}
					onFocus={focus}
					onInput={(event) => patchLevelEntity(props.id, { name: event.currentTarget.value })}
					onBlur={blur}
				/>
			</label>
			<Show
				when={isTrigger()}
				fallback={
					<>
						<label class="zylem-level-props__row">
							<span>Kind</span>
							<select
								class="zylem-transform-row__field"
								value={String(entity()?.props.spawnKind ?? 'player')}
								onFocus={focus}
								onChange={(event) =>
									patchLevelEntity(props.id, { spawnKind: event.currentTarget.value })
								}
								onBlur={blur}
							>
								<For each={SPAWN_KINDS}>{(kind) => <option value={kind}>{kind}</option>}</For>
							</select>
						</label>
						<label class="zylem-level-props__row">
							<span>Archetype</span>
							<input
								class="zylem-transform-row__field"
								value={String(entity()?.props.archetype ?? '')}
								onFocus={focus}
								onInput={(event) =>
									patchLevelEntity(props.id, { archetype: event.currentTarget.value })
								}
								onBlur={blur}
							/>
						</label>
					</>
				}
			>
				<For each={['x', 'y', 'z'] as const}>
					{(axis) => (
						<label class="zylem-level-props__row">
							<span>Size {axis}</span>
							<input
								class="zylem-transform-row__field"
								type="number"
								value={size()[axis]}
								onFocus={focus}
								onInput={(event) => {
									const next = Number(event.currentTarget.value);
									if (!Number.isFinite(next)) return;
									patchLevelEntity(props.id, {
										size: { ...size(), [axis]: next },
									});
								}}
								onBlur={blur}
							/>
						</label>
					)}
				</For>
			</Show>
		</div>
	);
};
