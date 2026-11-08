import { Checkbox, NumberField, PropertyList } from '@zylem/ui/components';
import { type Component, createMemo, For, Show } from 'solid-js';
import { sendEntityTransform } from '../../bridge/editor-bridge';
import { PropertyRow } from '../common/PropertyRow';
import { useEditor } from '../EditorContext';
import { setGridVisible, setSnapEnabled, transformStore } from './transform-state';

/** Snap increments are world units, so 3 decimals is more than enough. */
const DECIMALS = 3;

type Axis = 'x' | 'y' | 'z';
type Channel = 'position' | 'rotation' | 'scale';

const AXES: Axis[] = ['x', 'y', 'z'];

function round(value: number): number {
	const factor = 10 ** DECIMALS;
	// `|| 0` folds -0, which a field would print as "-0".
	return Math.round(value * factor) / factor || 0;
}

function snap(value: number, increment: number): number {
	if (!transformStore.enabled || increment <= 0) return value;
	return Math.round(value / increment) * increment;
}

/**
 * Numeric transform fields for the selected entity.
 *
 * Complements the gizmo rather than duplicating it: the gizmo is for coarse
 * placement, these fields for exact values. Both commit through the same bridge
 * message, and the game echoes an operation either way, so a typed value and a
 * drag land on one undo stack.
 */
export const TransformSection: Component = () => {
	const { debug, stage } = useEditor();

	const selected = createMemo(() => {
		const uuid = debug.selectedEntityId;
		if (!uuid) return null;
		return stage.entities.find((entity) => entity.uuid === uuid) ?? null;
	});

	/** Rotation is stored in radians but shown in degrees. */
	const displayValue = (channel: Channel, axis: Axis): number => {
		const entity = selected();
		if (!entity) return 0;
		if (channel === 'rotation') {
			return round(((entity.rotation?.[axis] ?? 0) * 180) / Math.PI);
		}
		const fallback = channel === 'scale' ? 1 : 0;
		return round(entity[channel]?.[axis] ?? fallback);
	};

	const commit = (channel: Channel, axis: Axis, parsed: number): void => {
		const entity = selected();
		if (!entity?.uuid) return;
		if (!Number.isFinite(parsed)) return;

		if (channel === 'rotation') {
			const degreeSnap = (transformStore.rotate * 180) / Math.PI;
			const radians = (snap(parsed, degreeSnap) * Math.PI) / 180;
			const rotation = {
				x: entity.rotation?.x ?? 0,
				y: entity.rotation?.y ?? 0,
				z: entity.rotation?.z ?? 0,
				[axis]: radians,
			};
			// Euler only here: the field edits one axis at a time, which is exactly
			// what Euler angles express, and the game converts to a quaternion.
			sendEntityTransform(entity.uuid, { rotation });
			return;
		}

		const increment = channel === 'scale' ? transformStore.scale : transformStore.translate;
		const value = snap(parsed, increment);

		if (channel === 'scale') {
			// A zero scale collapses the collider into a degenerate shape the
			// physics runtime cannot solve.
			const safe = value === 0 ? increment : value;
			sendEntityTransform(entity.uuid, {
				scale: {
					x: entity.scale?.x ?? 1,
					y: entity.scale?.y ?? 1,
					z: entity.scale?.z ?? 1,
					[axis]: safe,
				},
			});
			return;
		}

		sendEntityTransform(entity.uuid, {
			position: {
				x: entity.position?.x ?? 0,
				y: entity.position?.y ?? 0,
				z: entity.position?.z ?? 0,
				[axis]: value,
			},
		});
	};

	// Steppers follow the grid while snap is on, and a fine step while it is off.
	const stepFor = (channel: Channel): number => {
		if (channel === 'rotation') {
			if (!transformStore.enabled) return 1;
			const degrees = round((transformStore.rotate * 180) / Math.PI);
			return degrees > 0 ? degrees : 1;
		}
		if (!transformStore.enabled) return 0.1;
		const increment = channel === 'scale' ? transformStore.scale : transformStore.translate;
		return increment > 0 ? increment : 0.1;
	};

	const row = (channel: Channel, label: string) => (
		<PropertyRow label={label} valueClass="zylem-transform-axes">
			<For each={AXES}>
				{(axis) => (
					<div class="zylem-transform-axis">
						<span aria-hidden="true">{axis.toUpperCase()}</span>
						<NumberField
							aria-label={`${label} ${axis.toUpperCase()}`}
							value={displayValue(channel, axis)}
							step={stepFor(channel)}
							onCommit={(value) => commit(channel, axis, value)}
						/>
					</div>
				)}
			</For>
		</PropertyRow>
	);

	return (
		<div class="panel-content">
			<Show
				when={selected()}
				fallback={<p class="zylem-transform-empty">Select an entity to edit its transform.</p>}
			>
				<PropertyList labelWidth="72px">
					{row('position', 'Position')}
					{row('rotation', 'Rotation°')}
					{row('scale', 'Scale')}
				</PropertyList>
			</Show>

			<div class="zylem-transform-snap">
				<Checkbox label="Snap to grid" checked={transformStore.enabled} onChange={setSnapEnabled} />
				<Checkbox
					label="Show grid"
					checked={transformStore.gridVisible}
					onChange={setGridVisible}
				/>
			</div>
			<p class="zylem-transform-hint">
				Grid: {transformStore.translate} units, {round((transformStore.rotate * 180) / Math.PI)}
				°, {transformStore.scale} scale. Hold Alt while dragging to move freely.
			</p>
		</div>
	);
};
