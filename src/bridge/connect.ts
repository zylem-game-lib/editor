/**
 * Connection lifecycle for the editor side of the bridge.
 *
 * Subscribes the game→editor sync modules to the channel and hydrates from
 * `channel.getState()` on connect, so an editor mounted after the game started
 * shows current config/entities immediately.
 */

import { channel } from './channel';
import { applyCatalog, applyEntitySelection, applySceneOperation } from './sync-editing';
import {
	applyEntityRemoved,
	applyEntityUpsert,
	applyThumbnails,
	rebuildEntityIndex,
} from './sync-entities';
import { applyGameConfig, applyGameNotice, applyGameStatus, applyGameVariable } from './sync-game';
import { applyStageSnapshot } from './sync-stage';

let connected = false;
let connectionCount = 0;
let unsubscribes: (() => void)[] = [];

/**
 * Subscribe the editor stores to game→editor bridge messages and hydrate
 * from the channel's retained state.
 *
 * Reference-counted: the game gates expensive editor-only work (thumbnails,
 * entity summaries) on these subscriptions existing, so the last editor to
 * unmount must actually release them, while any editor still mounted must
 * keep them alive.
 *
 * @returns A release function; safe to call more than once.
 */
export function connectEditorBridge(): () => void {
	connectionCount += 1;
	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		connectionCount -= 1;
		if (connectionCount <= 0) {
			connectionCount = 0;
			disconnectEditorBridge();
		}
	};

	if (connected) return release;
	connected = true;

	unsubscribes = [
		channel.on('game:config', applyGameConfig),
		channel.on('game:variable', applyGameVariable),
		channel.on('game:status', applyGameStatus),
		channel.on('stage:snapshot', applyStageSnapshot),
		channel.on('entity:upsert', applyEntityUpsert),
		channel.on('entity:removed', ({ uuids }) => applyEntityRemoved(uuids)),
		channel.on('entity:thumbnail', applyThumbnails),
		channel.on('entity:selection', applyEntitySelection),
		channel.on('game:notice', applyGameNotice),
		channel.on('catalog:snapshot', applyCatalog),
		channel.on('scene:operation', applySceneOperation),
	];

	// Rebuild the uuid index from whatever survived a previous connection.
	rebuildEntityIndex();

	// Hydrate from last-known state so a late-mounting editor is populated
	// without waiting for the game's next publish.
	const config = channel.getState('game:config');
	if (config) applyGameConfig(config);
	const snapshot = channel.getState('stage:snapshot');
	if (snapshot) applyStageSnapshot(snapshot);
	const upserts = channel.getState('entity:upsert');
	if (upserts) applyEntityUpsert(upserts);
	const thumbnails = channel.getState('entity:thumbnail');
	if (thumbnails) applyThumbnails(thumbnails);
	const status = channel.getState('game:status');
	if (status) applyGameStatus(status);
	const selection = channel.getState('entity:selection');
	if (selection) applyEntitySelection(selection);
	const catalog = channel.getState('catalog:snapshot');
	if (catalog) applyCatalog(catalog);

	return release;
}

/** Tear down all bridge subscriptions, ignoring the reference count. */
export function disconnectEditorBridge(): void {
	for (const unsubscribe of unsubscribes) unsubscribe();
	unsubscribes = [];
	connected = false;
	connectionCount = 0;
}
