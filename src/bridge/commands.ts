/**
 * Editor → game commands.
 *
 * Thin, typed wrappers over `channel.send` so UI code never has to spell out
 * message names or payload shapes, and has no runtime dependency on game-lib
 * internals.
 */

import type {
	BridgeDebugTool,
	BridgePose,
	BridgeQuat,
	BridgeVec3,
	EntitySelectMode,
	LevelBuffer,
	SnapSettingsPayload,
} from '@zylem/bridge';
import type { LevelDocument, LevelSyncPayload } from '../components/level/level-types';
import { channel } from './channel';

/** The published bridge types lag the local protocol, so new level messages go out by name. */
function sendRaw(type: string, payload: unknown): void {
	const send = channel.send.bind(channel) as (message: string, body: unknown) => void;
	send(type, payload);
}

/** Toggle the game's debug mode. */
export function sendDebugEnabled(enabled: boolean): void {
	channel.send('debug:set', { enabled });
}

/** Switch the active editor tool in the game. */
export function sendTool(tool: BridgeDebugTool | 'brush' | 'clip' | 'vertex'): void {
	channel.send('tool:set', { tool: tool as BridgeDebugTool });
}

/** Pause or resume the game loop. */
export function sendPlayback(paused: boolean): void {
	channel.send('playback:set', { paused });
}

/** Select an entity in the game (null clears the selection). */
export function sendEntitySelect(uuid: string | null): void {
	channel.send('entity:select', { uuid });
}

/**
 * Replace, extend, reduce, or toggle the game's selection with several
 * entities at once. `uuid` mirrors the first entry for single-select
 * consumers.
 */
export function sendEntitySelectMany(uuids: string[], mode: EntitySelectMode = 'replace'): void {
	channel.send('entity:select', { uuid: uuids[0] ?? null, uuids, mode });
}

/** Focus/frame the active editor camera on an entity. */
export function sendEntityFocus(uuid: string): void {
	channel.send('entity:focus', { uuid });
}

/** Write a stage variable in the running game. */
export function sendStageVariable(key: string, value: unknown): void {
	channel.send('stage:variable:set', { key, value });
}

/**
 * Set an entity's transform absolutely.
 *
 * `quaternion` is authoritative when supplied; `rotation` is Euler radians for
 * the numeric fields, and round-trips less cleanly.
 */
export function sendEntityTransform(
	uuid: string,
	transform: {
		position?: BridgeVec3;
		rotation?: BridgeVec3;
		quaternion?: BridgeQuat;
		scale?: BridgeVec3;
	}
): void {
	channel.send('entity:transform', { uuid, ...transform });
}

/** Arm the game's add tool with a catalog type, or `null` to disarm it. */
export function sendAddType(typeId: string | null, props?: Record<string, unknown>): void {
	channel.send('add:type:set', props ? { typeId, props } : { typeId });
}

/** Stream a recorded level into the running stage. */
export function sendLevelLoad(buffer: LevelBuffer): void {
	channel.send('level:load', { buffer });
}

/** Replace the game's edit preview of the level document. */
export function sendLevelSync(payload: LevelSyncPayload): void {
	sendRaw('level:sync', payload);
}

/** Ask the game to play the document: collision on, brush faces hidden. */
export function sendLevelPlay(document: LevelDocument): void {
	sendRaw('level:play', { document });
}

/** Remove the level preview from the stage. */
export function sendLevelClose(): void {
	sendRaw('level:close', {});
}

/** Spawn a catalog entity without a placement click. */
export function sendEntityCreate(
	typeId: string,
	options?: { props?: Record<string, unknown>; pose?: BridgePose }
): void {
	channel.send('entity:create', {
		typeId,
		...(options?.props ? { props: options.props } : {}),
		...(options?.pose ? { pose: options.pose } : {}),
	});
}

/** Push snap increments to the game's gizmo. */
export function sendSnapSettings(snap: SnapSettingsPayload): void {
	channel.send('snap:set', snap);
}

/** Show or hide the game's construction-plane grid. */
export function sendGridVisible(visible: boolean): void {
	channel.send('grid:set', { visible });
}

/** Make a game or editor camera the main view. */
export function sendCameraActivate(id: string): void {
	channel.send('camera:activate', { id });
}
