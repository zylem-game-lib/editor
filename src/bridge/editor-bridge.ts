/**
 * Editor-side adapter for the shared editor ↔ game bridge.
 *
 * Public surface of `editor/src/bridge/`. The work is split by concern:
 *
 * - `channel.ts`       — the shared channel singleton
 * - `connect.ts`       — subscribe / hydrate / release lifecycle
 * - `sync-game.ts`     — game config, globals, status, notices → `gameState`
 * - `sync-stage.ts`    — stage snapshots → `stageState`
 * - `sync-entities.ts` — entity upserts, removals, thumbnails → `stageState.entities`
 * - `sync-editing.ts`  — selection, catalog, scene operations
 * - `commands.ts`      — typed editor → game commands
 *
 * Game→editor messages are written into the editor's valtio stores, replacing
 * the old `zylemEventBus.on('state:dispatch', …)` wiring and window CustomEvent
 * listeners. UI actions send typed editor→game commands through the same
 * channel, so the editor has no runtime dependency on game-lib internals.
 */

export { bridgeChannel } from './channel';
export {
	sendAddType,
	sendCameraActivate,
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
} from './commands';
export { connectEditorBridge, disconnectEditorBridge } from './connect';
