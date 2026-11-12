/**
 * Escape-to-disarm for the editor tools.
 *
 * The gizmo modes and the level draw tools stay active until another tool is
 * chosen, and Add and Delete wait for the click that spends them, so there has
 * to be a way out that is not "find the button you pressed and press it
 * again". Escape is that way out. With nothing armed, it drops the level
 * selection instead. The game claims Escape itself while a draw or a clip is
 * under way.
 */

import { sendAddType, sendTool } from '../../bridge/editor-bridge';
import { getDebugTool, setDebugTool } from '../entities/entities-state';
import { isEditableTarget } from '../history/history-shortcuts';
import { clearLevelSelection, setLevelPlacement } from '../level/level-state';
import { navigationState, resetNavigationTool } from '../navigation/navigation-state';
import { catalogState, setArmedType } from './catalog-state';
import { isOverlayTarget } from './toolbar-shortcuts';

export interface ToolShortcutOptions {
	/** @default true */
	enabled?: boolean;
	target?: Window;
}

/** Drop the armed placement type and return to the neutral tool. */
export function disarmTools(): boolean {
	const hadTool = getDebugTool() !== 'none';
	const hadType = catalogState.armedTypeId !== null;
	const hadNavigationTool = navigationState.tool !== 'none';
	if (!hadTool && !hadType && !hadNavigationTool) return false;
	if (hadNavigationTool) resetNavigationTool();

	if (hadType) {
		setArmedType(null);
		sendAddType(null);
	}
	if (hadTool) {
		setDebugTool('none');
		sendTool('none');
	}
	setLevelPlacement(null);
	return true;
}

/**
 * Install the Escape shortcut.
 *
 * @returns An uninstall function.
 */
export function installToolShortcuts(options: ToolShortcutOptions = {}): () => void {
	if (options.enabled === false) return () => {};

	const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);
	if (!target) return () => {};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		if (isEditableTarget(event)) return;
		// Only claimed when a tool was actually active or a level selection was
		// dropped, so Escape still closes popovers and dialogs the rest of the time.
		if (disarmTools()) {
			event.preventDefault();
			return;
		}
		if (isOverlayTarget(event)) return;
		if (clearLevelSelection()) event.preventDefault();
	};

	target.addEventListener('keydown', onKeyDown);
	return () => target.removeEventListener('keydown', onKeyDown);
}
