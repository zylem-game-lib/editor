/**
 * The editor's handle on the shared editor ↔ game bridge channel.
 *
 * Owned here, and only here, so the game→editor sync modules, the
 * editor→game commands, and stores such as `history-store` can all reach the
 * same singleton without importing each other.
 */

import { getZylemBridge } from '@zylem/bridge';

const { channel } = getZylemBridge();

/** `bridgeChannel` is the public alias, for advanced subscriptions. */
export { channel, channel as bridgeChannel };
