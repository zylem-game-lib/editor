import {
	DEFAULT_NAVIGATION_SETTINGS,
	type NavigationPath,
	type NavigationSettings,
	type NavigationStatus,
} from '@zylem/bridge';
import {
	Badge,
	type BadgeTone,
	Button,
	Callout,
	type CalloutTone,
	Checkbox,
	EmptyState,
	NumberField,
	PropertyList,
	ToolGroup,
} from '@zylem/ui/components';
import { type Component, For, Show } from 'solid-js';
import { PropertyRow } from '../common/PropertyRow';
import { levelStore } from '../level/level-state';
import {
	armNavigationTool,
	bakeNavigation,
	excludeSelectedSolids,
	navigationDisplayState,
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

interface Tag {
	label: string;
	tone: BadgeTone;
}

interface PathResult {
	tone: CalloutTone;
	text(points: number): string;
}

const BAKE: Record<NavigationStatus['state'], Tag> = {
	empty: { label: 'Not baked', tone: 'neutral' },
	building: { label: 'Baking…', tone: 'info' },
	ready: { label: 'Ready', tone: 'success' },
	stale: { label: 'Out of date', tone: 'warning' },
	error: { label: 'Failed', tone: 'error' },
};

const PATH: Record<NavigationPath['status'], PathResult> = {
	complete: { tone: 'success', text: (points) => `Complete path, ${points} points.` },
	partial: {
		tone: 'warning',
		text: (points) => `Partial path, ${points} points. It stops short of the end point.`,
	},
	unreachable: { tone: 'error', text: () => 'No path between these points.' },
};

export const NavigationSection: Component = () => {
	const settings = () => levelStore.document.navigation?.settings ?? DEFAULT_NAVIGATION_SETTINGS;
	const state = () => navigationDisplayState(navigationStore, levelStore.document);
	const path = () => PATH[navigationStore.pathStatus as NavigationPath['status']];
	const selectedSolids = () =>
		levelStore.document.solids.some((s) => levelStore.selectedIds.includes(s.id));
	const obstacles = () => levelStore.document.navigation?.obstacles ?? [];
	const links = () => levelStore.document.navigation?.links ?? [];
	return (
		<div class="panel-content zylem-navigation">
			<PropertyList labelWidth="72px">
				<PropertyRow label="Navmesh">
					<span role="status" aria-label={`Navigation: ${BAKE[state()].label}`}>
						<Badge tone={BAKE[state()].tone}>{BAKE[state()].label}</Badge>
					</span>
				</PropertyRow>
			</PropertyList>
			<Show when={navigationStore.message}>
				<Callout tone="error">{navigationStore.message}</Callout>
			</Show>
			<Show when={state() === 'stale'}>
				<Callout tone="warning">
					The level changed after this navmesh was baked. Bake again before saving.
				</Callout>
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
			<ToolGroup label="Navmesh">
				<Button
					size="sm"
					variant="primary"
					disabled={state() === 'building'}
					onClick={bakeNavigation}
				>
					{state() === 'building' ? 'Baking…' : 'Bake navmesh'}
				</Button>
				<Button
					size="sm"
					on={navigationStore.tool === 'path'}
					disabled={state() !== 'ready'}
					onClick={() => armNavigationTool('path')}
				>
					Test path
				</Button>
			</ToolGroup>
			<ToolGroup label="Annotate">
				<Button
					size="sm"
					on={navigationStore.tool === 'obstacle'}
					onClick={() => armNavigationTool('obstacle')}
				>
					Obstacle
				</Button>
				<Button
					size="sm"
					on={navigationStore.tool === 'link'}
					onClick={() => armNavigationTool('link')}
				>
					Traversal link
				</Button>
			</ToolGroup>
			<Show when={navigationStore.tool !== 'none'}>
				<Callout>
					{navigationStore.tool === 'obstacle'
						? 'Click two opposite corners on the floor.'
						: 'Click a start point, then an end point on the level.'}{' '}
					Press Escape to finish.
				</Callout>
			</Show>
			<Show when={path()}>
				{(result) => (
					<Callout tone={result().tone}>{result().text(navigationStore.pathPoints)}</Callout>
				)}
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
			<ToolGroup label="Selected solids">
				<Button size="sm" disabled={!selectedSolids()} onClick={() => excludeSelectedSolids(true)}>
					Exclude
				</Button>
				<Button size="sm" disabled={!selectedSolids()} onClick={() => excludeSelectedSolids(false)}>
					Include
				</Button>
			</ToolGroup>
			<Callout>
				The navmesh is baked from level solids. Doodads and gameplay markers are left out. Hidden
				sectors still bake.
			</Callout>
			<Show
				when={obstacles().length + links().length > 0}
				fallback={
					<EmptyState title="No obstacles or links">
						Arm Obstacle or Traversal link, then click two points on the level.
					</EmptyState>
				}
			>
				<PropertyList labelWidth="112px">
					<For each={obstacles()}>
						{(obstacle, index) => (
							<PropertyRow label={`Obstacle ${index() + 1}`}>
								<Button
									size="sm"
									variant="ghost"
									aria-label={`Remove obstacle ${index() + 1}`}
									onClick={() => removeNavigationItem('obstacles', obstacle.id)}
								>
									Remove
								</Button>
							</PropertyRow>
						)}
					</For>
					<For each={links()}>
						{(link, index) => (
							<PropertyRow
								label={`Link ${index() + 1} · ${link.bidirectional ? 'two-way' : 'one-way'}`}
							>
								<Button
									size="sm"
									variant="ghost"
									aria-label={`Remove link ${index() + 1}`}
									onClick={() => removeNavigationItem('links', link.id)}
								>
									Remove
								</Button>
							</PropertyRow>
						)}
					</For>
				</PropertyList>
			</Show>
		</div>
	);
};
