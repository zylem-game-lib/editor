export {
	bridgeChannel,
	connectEditorBridge,
	disconnectEditorBridge,
	sendAddType,
	sendCameraView,
	sendDebugEnabled,
	sendEntityCreate,
	sendEntityFocus,
	sendEntitySelect,
	sendEntitySelectMany,
	sendEntityTransform,
	sendGridVisible,
	sendLevelLoad,
	sendPlayback,
	sendSnapSettings,
	sendStageVariable,
	sendTool,
} from './bridge/editor-bridge';
export type {
	DockPanelId,
	DockRect,
	DockRegistry,
	DockSide,
	DockZoneState,
	EditorDockDefaults,
} from './components';
export {
	computeDockLayout,
	DOCK_SIDES,
	debugState,
	debugStore,
	dockPanelToSide,
	findDockedSide,
	gameState,
	getDockedSide,
	MAIN_PANEL_ID,
	stageState,
	TOOLBAR_PANEL_ID,
	undockPanelFromSides,
} from './components';
export * from './components/common/Icon';
export type { EditorEvent, EditorEventType } from './components/events';
export { editorEvents } from './components/events';
// Undo/redo. Exported so a host that turns off `enableUndoShortcut` can route
// cmd+z by focus and still drive the editor's stack.
export {
	canRedo,
	canUndo,
	clearHistory,
	type HistoryState,
	historyState,
	MAX_HISTORY_DEPTH,
	redo,
	redoLabel,
	undo,
	undoLabel,
} from './components/history/history-store';
export {
	type LevelSnapshot,
	levelState,
	snapshotLevelBuffer,
} from './components/level/level-state';
export {
	buildStageExport,
	copyStageExport,
	type StageExport,
	type StageExportEntity,
	stageExportToString,
} from './components/stages/stage-export';
export {
	type CatalogState,
	catalogState,
	setArmedType,
	setEntityCatalog,
} from './components/toolbar/catalog-state';
export { disarmTools } from './components/toolbar/tool-shortcuts';
// The toolbar's presses. Exported so a host that turns off
// `enableToolbarShortcuts` can bind its own keys to the same actions.
export {
	armAddTool,
	armAddType,
	type ClickTool,
	openAddPalette,
	selectTool,
	selectTransformTool,
	type TransformTool,
	toggleDebug,
	toggleGrid,
	togglePlayback,
	toggleSnap,
	toggleTool,
	toggleTransformTool,
} from './components/toolbar/toolbar-actions';
export {
	formatShortcut,
	installToolbarShortcuts,
	runToolbarAction,
	type ShortcutChord,
	TOOLBAR_SHORTCUTS,
	type ToolbarAction,
	type ToolbarShortcutId,
	type ToolbarShortcutOptions,
} from './components/toolbar/toolbar-shortcuts';
export {
	installTransformToolGuard,
	releaseOrphanedTransformTool,
	type TransformToolGuardOptions,
} from './components/toolbar/transform-tool-guard';
export {
	DEFAULT_ROTATE_SNAP,
	setGridVisible,
	setSnapEnabled,
	setSnapIncrements,
	type TransformState,
	transformState,
} from './components/transform/transform-state';
export {
	attachEditorStateBridge,
	dispatchEditorUpdate,
	dispatchToEditor,
	type EditorStateBridge,
	type EditorStateBridgeOptions,
	type EditorUpdatePayload,
	type MountedZylemEditor,
	type MountZylemEditorOptions,
	mountZylemEditor,
} from './host/editor-host';
export {
	onSceneOperation,
	type SceneOperationListener,
} from './host/scene-operation-hook';
export type { ZylemEditorConfig } from './web-components/zylem-editor';
export { registerZylemEditor, ZylemEditorElement } from './web-components/zylem-editor';
