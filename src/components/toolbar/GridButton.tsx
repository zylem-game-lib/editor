import { ToolbarButton } from '@zylem/ui/components';
import Grid3x3 from 'lucide-solid/icons/grid-3x3';
import Magnet from 'lucide-solid/icons/magnet';
import type { Component } from 'solid-js';
import { transformStore } from '../transform/transform-state';
import { toggleGrid, toggleSnap } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

/** Show or hide the game's construction-plane grid. */
export const GridButton: Component = () => (
	<ToolbarButton
		label={withShortcut(transformStore.gridVisible ? 'Hide grid' : 'Show grid', 'grid')}
		selected={transformStore.gridVisible}
		onClick={toggleGrid}
	>
		<Grid3x3 class="zylem-icon" />
	</ToolbarButton>
);

/**
 * Snap toggle. Alt does the same thing per-drag; this is for turning it off for
 * a whole stretch of work rather than a single move.
 */
export const SnapButton: Component = () => (
	<ToolbarButton
		label={withShortcut(transformStore.enabled ? 'Snapping on' : 'Snapping off', 'snap')}
		selected={transformStore.enabled}
		onClick={toggleSnap}
	>
		<Magnet class="zylem-icon" />
	</ToolbarButton>
);
