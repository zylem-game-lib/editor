/**
 * Store exports for the editor package.
 */

// Types
export type { BaseEntityInterface, StageStateInterface, Vector3Like } from '../types';
// Bridge debug panel
export {
	type BridgeLogEntry,
	type BridgePanelState,
	type BridgeStatsRow,
	bridgePanelState,
	clearBridgeLog,
	MAX_BRIDGE_LOG_ENTRIES,
	setBridgeCapturePaused,
	startBridgeCapture,
	stopBridgeCapture,
} from './bridge/bridge-panel-state';
// Dock layout geometry
export {
	clampThickness,
	computeDockLayout,
	DOCK_SIDES,
	type DockPanelId,
	type DockRect,
	type DockRegistry,
	type DockSide,
	type DockZoneState,
	dockSlotIndex,
	findDockedSide,
	innerEdgeFor,
	isHorizontalSide,
	previewDockRect,
	resolveThickness,
	TOOLBAR_PANEL_ID,
	TOOLBAR_STRIP_THICKNESS,
	type Viewport,
} from './common/dock-layout';
// Console
export {
	clearConsole,
	consoleState,
	getConsoleContent,
	MAX_CONSOLE_MESSAGES,
	printToConsole,
} from './console/console-state';
export { type EditorContextValue, EditorProvider, useEditor } from './EditorContext';

// SolidJS integration
export {
	applyDefaultDocks,
	bringPanelToFront,
	clearDragState,
	type DetachedPanelState,
	debugStore,
	detachPanel,
	dockPanelToSide,
	type EditorDockDefaults,
	getDockedSide,
	isPanelDetached,
	MAIN_PANEL_ID,
	reattachPanel,
	reorderPanels,
	seedToolbarDock,
	setDebugStore,
	setDockThickness,
	setDraggingPanel,
	setDropTargetIndex,
	setMainCollapsed,
	setOpenSections,
	setPanelPosition,
	setPanelSize,
	setToggleButtonPosition,
	setToolbarCollapsed,
	undockPanelFromSides,
	updateDetachedPanelPosition,
	updateDetachedPanelSize,
} from './editor-store';
// State modules - re-exported from UI section directories
export {
	type DebugState,
	type DebugTools,
	debugState,
	getDebugTool,
	getHoveredEntityId,
	getSelectedEntityId,
	getSelectedEntityIds,
	isPaused,
	resetHoveredEntity,
	setDebugTool,
	setHoveredEntityId,
	setPaused,
	setSelectedEntityId,
	setSelectedEntityIds,
} from './entities/entities-state';
// Event bus for external state sync
export { type EditorEvent, type EditorEventType, editorEvents } from './events';
export { gameState, getGlobal, getGlobalState, setGlobal, state } from './game/game-state';
export { stageState, stageStateToString } from './stages/stage-state';
