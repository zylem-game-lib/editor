import type { ToolbarMode } from '@zylem/ui/components';
import type { HarnessModeId } from '../../dev/harness-modes';

/**
 * Resting color of the rail for each harness mode. Selected, on, and danger
 * jewels stay their own colors. Matches the colorways in `@zylem/ui`.
 */
const TOOLBAR_MODE: Record<HarnessModeId, ToolbarMode> = {
	'game-preview': 'black',
	'stage-editor': 'primary',
	'level-builder-mesh': 'white',
	'level-builder-navigation': 'brown',
	'level-builder-decoration': 'yellow',
	'hud-view': 'magenta',
	'entity-editor': 'purple',
};

/** The toolbar colorway for a harness mode. Unset mode keeps the primary glass. */
export function toolbarModeFor(id: HarnessModeId | null): ToolbarMode {
	return id ? TOOLBAR_MODE[id] : 'primary';
}
