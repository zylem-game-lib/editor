import type { DockOption, DockPosition } from '@zylem/ui/components';
import { allowedDockSides, type DockPanelId, type DockSide } from './dock-layout';

const SIDE_LABELS = {
	left: 'Left',
	right: 'Right',
	top: 'Top',
	bottom: 'Bottom',
} as const satisfies Record<Exclude<DockSide, 'single'>, string>;

/**
 * Rows for the window-control dock menu. A top or bottom strip returns
 * `undefined` so the control keeps its own Top, Float, Bottom menu. Any other
 * window lists the edges it can use. A section's full-width band is Bottom,
 * the same word the toolbar uses for that edge.
 */
export const windowDockOptions = (panelId: DockPanelId): readonly DockOption[] | undefined => {
	const sides = allowedDockSides(panelId);
	if (sides.every((side) => side === 'top' || side === 'bottom')) return undefined;
	const choices: DockOption[] = sides.map((side) =>
		side === 'single' ? { id: 'bottom', label: 'Bottom' } : { id: side, label: SIDE_LABELS[side] }
	);
	if (choices.length === 1) {
		const only = choices[0];
		return only ? [{ id: 'float', label: 'Float' }, only] : [{ id: 'float', label: 'Float' }];
	}
	const midpoint = Math.ceil(choices.length / 2);
	return [
		...choices.slice(0, midpoint),
		{ id: 'float', label: 'Float' },
		...choices.slice(midpoint),
	];
};

/** The menu row that should be checked for where this window sits. */
export const toWindowDock = (side: DockSide | null): DockPosition => {
	if (side === null) return 'float';
	if (side === 'single') return 'bottom';
	return side;
};

/**
 * The zone a menu row docks to. Float returns `null`. A row this window cannot
 * use returns `null` as well, so the caller ignores it instead of floating.
 */
export const dockSideFromWindow = (
	panelId: DockPanelId,
	position: DockPosition
): DockSide | null => {
	if (position === 'float') return null;
	const sides = allowedDockSides(panelId);
	if (position === 'bottom' && sides.includes('single') && !sides.includes('bottom'))
		return 'single';
	if (sides.includes(position)) return position;
	return null;
};
