/**
 * Game→editor sync: game-level messages (display config, globals, playback
 * status, notices) written into `gameState`, the editor `debugState`, and the
 * console.
 */

import type { GameConfigPayload, GameNoticePayload, GameVariablePayload } from '@zylem/bridge';
import { printToConsole } from '../components/console/console-state';
import { setDebugStore } from '../components/editor-store';
import { debugState as editorDebugState } from '../components/entities/entities-state';
import { gameState } from '../components/game/game-state';

/**
 * Apply the display config, writing only the fields that changed. The game's
 * `ResizeObserver` republishes on every layout tick, and assigning a fresh
 * object each time would invalidate every consumer of `gameState.config`.
 */
export function applyGameConfig(config: GameConfigPayload): void {
	if (gameState.id !== config.id) {
		gameState.id = config.id;
	}

	const current = gameState.config;
	if (!current) {
		gameState.config = {
			id: config.id,
			aspectRatio: config.aspectRatio,
			fullscreen: config.fullscreen,
			bodyBackground: config.bodyBackground,
			internalResolution: config.internalResolution,
			debug: config.debug,
		};
		return;
	}

	if (current.id !== config.id) current.id = config.id;
	if (current.aspectRatio !== config.aspectRatio) {
		current.aspectRatio = config.aspectRatio;
	}
	if (current.fullscreen !== config.fullscreen) {
		current.fullscreen = config.fullscreen;
	}
	if (current.bodyBackground !== config.bodyBackground) {
		current.bodyBackground = config.bodyBackground;
	}
	if (current.debug !== config.debug) current.debug = config.debug;

	const nextResolution = config.internalResolution;
	const currentResolution = current.internalResolution;
	const resolutionChanged =
		!nextResolution || !currentResolution
			? nextResolution !== currentResolution
			: nextResolution.width !== currentResolution.width ||
				nextResolution.height !== currentResolution.height;
	if (resolutionChanged) {
		current.internalResolution = nextResolution;
	}
}

export function applyGameVariable(payload: GameVariablePayload): void {
	gameState.globals[payload.path] = payload.value;
}

export function applyGameStatus(status: { paused?: boolean; debug?: boolean }): void {
	if (status.paused !== undefined) {
		editorDebugState.paused = status.paused;
		setDebugStore('paused', status.paused);
	}
	if (status.debug !== undefined) {
		setDebugStore('debug', status.debug);
	}
}

export function applyGameNotice(notice: GameNoticePayload): void {
	printToConsole(`[${notice.level}] ${notice.message}`);
}
