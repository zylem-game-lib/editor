import {
	type BrushShape,
	type BrushSolid,
	type EntityPlacement,
	type LevelDocument,
	type LevelLayerId,
	type LevelSpawnKind as SpawnKind,
	sectorSizeOf,
	sectorTint,
} from '@zylem/bridge';
import {
	Badge,
	Button,
	Checkbox,
	NumberField,
	PropertyList,
	Select,
	SidebarItem,
} from '@zylem/ui/components';
import { type Component, createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { PropertyRow } from '../common/PropertyRow';
import { type SectorGroup, solidsBySector } from './level-sectors';
import {
	captureLevelEdit,
	commitLevelEdit,
	levelStore,
	patchLevelEntity,
	selectLevelRow,
	setActiveLayer,
	setLevelDrawSegments,
	setLevelDrawShape,
	setLevelDrawSides,
	setLevelDrawThickness,
	setLevelDrawTurn,
	setLevelSectorSize,
	setLevelSectorTint,
	setLevelSubdivideTile,
	toggleLevelLayerHidden,
	toggleLevelSectorHidden,
} from './level-state';

const LAYERS: Array<{ id: LevelLayerId; label: string }> = [
	{ id: 'solid', label: 'Solids' },
	{ id: 'doodad', label: 'Doodads' },
	{ id: 'entity', label: 'Entities' },
];

const SPAWN_KINDS: SpawnKind[] = ['player', 'enemy', 'item'];

const SHAPES: Array<{ value: BrushShape; label: string }> = [
	{ value: 'box', label: 'Box' },
	{ value: 'wedge', label: 'Wedge' },
	{ value: 'cylinder', label: 'Cylinder' },
	{ value: 'arch', label: 'Arch' },
];

const TURNS = [0, 1, 2, 3].map((turn) => ({ value: String(turn), label: `${turn * 90}°` }));

interface LevelRow {
	id: string;
	label: string;
	detail: string;
}

function solidRow(solid: BrushSolid, compiles: boolean): LevelRow {
	const planes = `${solid.planes.length} planes`;
	return {
		id: solid.id,
		label: 'Brush',
		detail: compiles ? (solid.groupId ? `${planes}, grouped` : planes) : 'Does not compile',
	};
}

function placementRows(document: LevelDocument, layer: LevelLayerId): LevelRow[] {
	if (layer === 'doodad') {
		return document.doodads.map((doodad) => ({
			id: doodad.id,
			label: doodad.typeId,
			detail: 'Visual',
		}));
	}
	if (layer === 'entity') {
		return document.entities.map((entity) => ({
			id: entity.id,
			label: entity.name || entity.typeId,
			detail: entity.typeId === 'zone' ? 'Trigger' : String(entity.props.spawnKind ?? 'spawn'),
		}));
	}
	return [];
}

/**
 * The level document, by layer, with solids grouped by sector. Visibility is
 * editor state: hiding a layer or a sector drops it from the preview, and play
 * still streams everything.
 */
export const LevelSection: Component = () => {
	const document = () => levelStore.document;
	const selected = createMemo(() => new Set(levelStore.selectedIds));
	const sectors = createMemo(() => solidsBySector(levelStore.document));
	const count = () =>
		document().solids.length + document().doodads.length + document().entities.length;
	const entityId = () => {
		const [only, ...rest] = levelStore.selectedIds;
		if (!only || rest.length > 0) return null;
		return document().entities.some((entity) => entity.id === only) ? only : null;
	};

	return (
		<div class="panel-content">
			<LevelSettings />
			<Show
				when={count() > 0}
				fallback={<p class="zylem-transform-empty">Nothing in this level yet.</p>}
			>
				<For each={LAYERS}>
					{(layer) => (
						<LayerSection layer={layer}>
							<Show
								when={layer.id === 'solid'}
								fallback={
									<LevelRows rows={placementRows(document(), layer.id)} selected={selected()} />
								}
							>
								<For each={sectors()}>
									{(group) => <SectorSection group={group} selected={selected()} />}
								</For>
							</Show>
						</LayerSection>
					)}
				</For>
			</Show>
			<Show when={entityId()}>{(id) => <EntityFields id={id()} />}</Show>
		</div>
	);
};

/** The sector grid, the primitive the brush draws, and the subdivide tile. */
const LevelSettings: Component = () => (
	<PropertyList class="zylem-level-settings" labelWidth="104px">
		<PropertyRow label="Sector size" valueClass="zylem-level-field">
			<NumberField
				aria-label="Sector size"
				value={sectorSizeOf(levelStore.document)}
				minValue={1}
				onCommit={(size) => setLevelSectorSize(size)}
			/>
		</PropertyRow>
		<PropertyRow label="Tint sectors" valueClass="zylem-level-field">
			<Checkbox
				aria-label="Tint solids by sector"
				checked={levelStore.showSectorTint}
				onChange={setLevelSectorTint}
			/>
		</PropertyRow>
		<PropertyRow label="Shape" valueClass="zylem-level-field">
			<Select
				aria-label="Brush shape"
				options={SHAPES}
				value={levelStore.drawShape.shape}
				onChange={(value) => {
					const shape = SHAPES.find((option) => option.value === value);
					if (shape) setLevelDrawShape(shape.value);
				}}
			/>
		</PropertyRow>
		<PropertyRow label="Cylinder sides" valueClass="zylem-level-field">
			<NumberField
				aria-label="Cylinder sides"
				value={levelStore.drawShape.sides}
				minValue={3}
				maxValue={64}
				onCommit={setLevelDrawSides}
			/>
		</PropertyRow>
		<PropertyRow label="Arch segments" valueClass="zylem-level-field">
			<NumberField
				aria-label="Arch segments"
				value={levelStore.drawShape.segments}
				minValue={2}
				maxValue={32}
				onCommit={setLevelDrawSegments}
			/>
		</PropertyRow>
		<PropertyRow label="Arch thickness" valueClass="zylem-level-field">
			<NumberField
				aria-label="Arch thickness"
				value={levelStore.drawShape.thickness}
				step={0.25}
				onCommit={setLevelDrawThickness}
			/>
		</PropertyRow>
		<PropertyRow label="Wedge turn" valueClass="zylem-level-field">
			<Select
				aria-label="Wedge turn"
				options={TURNS}
				value={String(levelStore.drawShape.turn)}
				onChange={(value) => {
					if (value !== null) setLevelDrawTurn(Number(value));
				}}
			/>
		</PropertyRow>
		<PropertyRow label="Subdivide tile" valueClass="zylem-level-field">
			<NumberField
				aria-label="Subdivide tile"
				value={levelStore.subdivideTile}
				onCommit={setLevelSubdivideTile}
			/>
		</PropertyRow>
	</PropertyList>
);

const LayerSection: Component<{ layer: (typeof LAYERS)[number]; children: JSX.Element }> = (
	props
) => {
	const hidden = () => levelStore.hiddenLayers.includes(props.layer.id);
	return (
		<section class="zylem-level-layer">
			<header class="zylem-level-layer__head">
				<Button
					size="sm"
					variant="ghost"
					on={levelStore.activeLayer === props.layer.id}
					onClick={() => setActiveLayer(props.layer.id)}
				>
					{props.layer.label}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					aria-label={`${hidden() ? 'Show' : 'Hide'} ${props.layer.label.toLowerCase()}`}
					onClick={() => toggleLevelLayerHidden(props.layer.id)}
				>
					{hidden() ? 'Show' : 'Hide'}
				</Button>
			</header>
			{props.children}
		</section>
	);
};

const SectorSection: Component<{ group: SectorGroup; selected: ReadonlySet<string> }> = (props) => {
	const hidden = () =>
		props.group.key !== null && levelStore.hiddenSectors.includes(props.group.key);
	const name = () => (props.group.key === null ? 'Does not compile' : `Sector ${props.group.key}`);
	return (
		<div class="zylem-level-sector" classList={{ 'is-hidden': hidden() }}>
			<header class="zylem-level-sector__head">
				<Show when={levelStore.showSectorTint ? props.group.coord : null}>
					{(coord) => (
						<span class="zylem-level-sector__tint" style={{ background: sectorTint(coord()) }} />
					)}
				</Show>
				<span class="zylem-level-sector__name">{name()}</span>
				<Badge tone="neutral">{props.group.solids.length}</Badge>
				<Show when={props.group.key}>
					{(key) => (
						<Button
							size="sm"
							variant="ghost"
							aria-label={`${hidden() ? 'Show' : 'Hide'} sector ${key()}`}
							onClick={() => toggleLevelSectorHidden(key())}
						>
							{hidden() ? 'Show' : 'Hide'}
						</Button>
					)}
				</Show>
			</header>
			<LevelRows
				rows={props.group.solids.map((solid) => solidRow(solid, props.group.key !== null))}
				selected={props.selected}
			/>
		</div>
	);
};

/** Every selected row is lit. A click selects that row alone; Shift-click toggles it. */
const LevelRows: Component<{ rows: LevelRow[]; selected: ReadonlySet<string> }> = (props) => (
	<ul class="zylem-level-list">
		<For each={props.rows}>
			{(row) => (
				<li>
					<SidebarItem
						class="zylem-level-row"
						active={props.selected.has(row.id)}
						onClick={(event) => selectLevelRow(row.id, event.shiftKey)}
					>
						<span class="zylem-level-row__type">{row.label}</span>
						<span class="zylem-level-row__role">{row.detail}</span>
					</SidebarItem>
				</li>
			)}
		</For>
	</ul>
);

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
