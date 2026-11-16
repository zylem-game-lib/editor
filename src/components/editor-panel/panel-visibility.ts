/**
 * Which accordion panels are on screen.
 *
 * Layers add panels; they do not replace the ones already showing. A hidden
 * panel stays in `panelOrder` and in the detached map so it comes back in the
 * same slot.
 */

import {
	debugStore,
	type PanelOverride,
	resetPanelOverrides,
	setPanelOverride,
} from '../editor-store';
import type { DebugTools } from '../entities/entities-state';
import { levelStore } from '../level/level-state';

export interface PanelVisibility {
	debug: boolean;
	build: boolean;
	tool: DebugTools;
}

export type { PanelOverride };

const TRANSFORM_TOOLS = new Set<DebugTools>(['translate', 'rotate', 'scale']);

/** What the mode shows before any checkbox choice. */
export function defaultPanelVisible(id: string, state: PanelVisibility): boolean {
	if (id === 'game-config' || id === 'stage-config' || id === 'console') return true;
	if (id === 'transform') return TRANSFORM_TOOLS.has(state.tool);
	if (id === 'entities' || id === 'bridge') return state.debug;
	if (id === 'level' || id === 'navigation' || id === 'texturing') return state.build;
	return false;
}

/**
 * The choice to store for a checkbox toggle.
 * Matching the current default stores nothing, so the section follows the mode again.
 */
export function overrideForToggle(shown: boolean, defaultShown: boolean): PanelOverride | null {
	if (shown === defaultShown) return null;
	return shown ? 'show' : 'hide';
}

/** Checkbox state: a stored choice wins, and everything else follows the mode. */
export function isPanelVisible(
	id: string,
	state: PanelVisibility,
	overrides: Readonly<Record<string, PanelOverride | undefined>> = {}
): boolean {
	const override = overrides[id];
	if (override === 'show') return true;
	if (override === 'hide') return false;
	return defaultPanelVisible(id, state);
}

/** Accordion rows: stored order, minus detached panels and panels the layers hide. */
export function visibleAccordionIds(
	order: readonly string[],
	detachedIds: readonly string[],
	state: PanelVisibility,
	overrides: Readonly<Record<string, PanelOverride | undefined>> = {}
): string[] {
	const detached = new Set(detachedIds);
	return order.filter((id) => !detached.has(id) && isPanelVisible(id, state, overrides));
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
		currentPanelVisibility(),
		debugStore.panelOverrides
	);
}

/** Record a checkbox toggle. A value that matches the mode clears the choice. */
export function setPanelShown(id: string, shown: boolean): void {
	setPanelOverride(id, overrideForToggle(shown, defaultPanelVisible(id, currentPanelVisibility())));
}

export { resetPanelOverrides };
