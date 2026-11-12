import {
	DEFAULT_NAVIGATION_SETTINGS,
	type NavigationSettings,
	navigationSourceHash,
} from '@zylem/bridge';
import { Button, Checkbox, NumberField, PropertyList } from '@zylem/ui/components';
import { type Component, For, Show } from 'solid-js';
import { PropertyRow } from '../common/PropertyRow';
import { levelStore } from '../level/level-state';
import {
	armNavigationTool,
	bakeNavigation,
	excludeSelectedSolids,
	navigationState,
	navigationStore,
	removeNavigationItem,
	setNavigationSetting,
	setNavigationVisible,
	updateNavigationToolOptions,
} from './navigation-state';

const FIELDS: {
	key: keyof NavigationSettings;
	label: string;
	min: number;
	max?: number;
	step: number;
}[] = [
	{ key: 'agentRadius', label: 'Agent radius', min: 0, step: 0.1 },
	{ key: 'agentHeight', label: 'Agent height', min: 0.1, step: 0.1 },
	{ key: 'maxClimb', label: 'Step height', min: 0, step: 0.1 },
	{ key: 'maxSlope', label: 'Max slope (°)', min: 0, max: 89, step: 1 },
	{ key: 'cellSize', label: 'Cell size', min: 0.01, step: 0.05 },
	{ key: 'cellHeight', label: 'Cell height', min: 0.01, step: 0.05 },
];
export const NavigationSection: Component = () => {
	const settings = () => levelStore.document.navigation?.settings ?? DEFAULT_NAVIGATION_SETTINGS;
	const stale = () =>
		navigationStore.state === 'ready' &&
		navigationStore.sourceHash !== navigationSourceHash(levelStore.document);
	const state = () => (stale() ? 'stale' : navigationStore.state);
	const selectedSolids = () =>
		levelStore.document.solids.some((s) => levelStore.selectedIds.includes(s.id));
	return (
		<div class="panel-content">
			<p role="status">Navigation: {state()}</p>
			<Show when={navigationStore.message}>
				<p role="alert">{navigationStore.message}</p>
			</Show>
			<PropertyList labelWidth="112px">
				<For each={FIELDS}>
					{(field) => (
						<PropertyRow label={field.label}>
							<NumberField
								aria-label={field.label}
								value={settings()[field.key]}
								minValue={field.min}
								maxValue={field.max}
								step={field.step}
								onCommit={(value) => setNavigationSetting(field.key, value)}
							/>
						</PropertyRow>
					)}
				</For>
				<PropertyRow label="Show navigation">
					<Checkbox
						aria-label="Show navigation"
						checked={navigationStore.visible}
						onChange={setNavigationVisible}
					/>
				</PropertyRow>
			</PropertyList>
			<div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px', margin: '8px 0' }}>
				<Button disabled={state() === 'building'} onClick={bakeNavigation}>
					{state() === 'building' ? 'Baking…' : 'Bake navmesh'}
				</Button>
				<Button
					on={navigationStore.tool === 'path'}
					disabled={state() !== 'ready'}
					onClick={() => armNavigationTool('path')}
				>
					Test path
				</Button>
				<Button
					on={navigationStore.tool === 'obstacle'}
					onClick={() => armNavigationTool('obstacle')}
				>
					Obstacle
				</Button>
				<Button on={navigationStore.tool === 'link'} onClick={() => armNavigationTool('link')}>
					Traversal link
				</Button>
			</div>
			<Show when={navigationStore.tool !== 'none'}>
				<p>
					{navigationStore.tool === 'obstacle'
						? 'Click two opposite corners on the floor.'
						: 'Click a start point, then an end point on the level.'}{' '}
					Press Escape to finish.
				</p>
			</Show>
			<Show when={navigationStore.pathStatus}>
				<p role="status">
					Path: {navigationStore.pathStatus} ({navigationStore.pathPoints} points)
				</p>
			</Show>
			<PropertyList labelWidth="112px">
				<PropertyRow label="Obstacle height">
					<NumberField
						aria-label="Obstacle height"
						minValue={0.1}
						step={0.1}
						value={navigationStore.obstacleHeight}
						onCommit={(value) => {
							if (Number.isFinite(value)) navigationState.obstacleHeight = Math.max(0.1, value);
							updateNavigationToolOptions();
						}}
					/>
				</PropertyRow>
				<PropertyRow label="Two-way links">
					<Checkbox
						aria-label="Two-way links"
						checked={navigationStore.bidirectional}
						onChange={(value) => {
							navigationState.bidirectional = value;
							updateNavigationToolOptions();
						}}
					/>
				</PropertyRow>
			</PropertyList>
			<div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
				<Button size="sm" disabled={!selectedSolids()} onClick={() => excludeSelectedSolids(true)}>
					Exclude selected
				</Button>
				<Button size="sm" disabled={!selectedSolids()} onClick={() => excludeSelectedSolids(false)}>
					Include selected
				</Button>
			</div>
			<p>
				Sources: level solids. Doodads and gameplay markers are excluded. Hidden sectors still bake.
			</p>
			<For each={levelStore.document.navigation?.obstacles ?? []}>
				{(o, i) => (
					<div>
						Obstacle {i() + 1}{' '}
						<Button
							size="sm"
							variant="ghost"
							onClick={() => removeNavigationItem('obstacles', o.id)}
						>
							Remove
						</Button>
					</div>
				)}
			</For>
			<For each={levelStore.document.navigation?.links ?? []}>
				{(l, i) => (
					<div>
						Link {i() + 1} ({l.bidirectional ? 'two-way' : 'one-way'}){' '}
						<Button size="sm" variant="ghost" onClick={() => removeNavigationItem('links', l.id)}>
							Remove
						</Button>
					</div>
				)}
			</For>
		</div>
	);
};
