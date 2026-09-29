/**
 * Which accordion panels are on screen.
 *
 * Layers add panels; they do not replace the ones already showing. A hidden
 * panel stays in `panelOrder` and in the detached map so it comes back in the
 * same slot.
 */

import { debugStore } from '../editor-store';
import type { DebugTools } from '../entities/entities-state';
import { levelStore } from '../level/level-state';

export interface PanelVisibility {
	debug: boolean;
	build: boolean;
	tool: DebugTools;
}

const TRANSFORM_TOOLS = new Set<DebugTools>(['translate', 'rotate', 'scale']);

export function isPanelVisible(id: string, state: PanelVisibility): boolean {
	if (id === 'game-config' || id === 'stage-config' || id === 'console') return true;
	if (id === 'transform') return TRANSFORM_TOOLS.has(state.tool);
	if (id === 'entities' || id === 'bridge') return state.debug;
	if (id === 'level') return state.build;
	return false;
}

/** Accordion rows: stored order, minus detached panels and panels the layers hide. */
export function visibleAccordionIds(
	order: readonly string[],
	detachedIds: readonly string[],
	state: PanelVisibility
): string[] {
	const detached = new Set(detachedIds);
	return order.filter((id) => !detached.has(id) && isPanelVisible(id, state));
}

/** Visibility from the live stores, for the accordion and detached windows. */
export function currentPanelVisibility(): PanelVisibility {
	return {
		debug: debugStore.debug,
		build: levelStore.active,
		tool: debugStore.tool,
	};
}

export function currentAccordionIds(): string[] {
	return visibleAccordionIds(
		debugStore.panelOrder,
		Object.keys(debugStore.detachedPanels),
		currentPanelVisibility()
	);
}
