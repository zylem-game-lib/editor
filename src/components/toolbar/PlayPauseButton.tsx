import { ToolbarButton } from '@zylem/ui/components';
import Pause from 'lucide-solid/icons/pause';
import Play from 'lucide-solid/icons/play';
import type { Component } from 'solid-js';
import { sendPlayback } from '../../bridge/editor-bridge';
import { debugState, debugStore, setPaused } from '..';

export const PlayPauseButton: Component = () => {
	const handleClick = () => {
		const newPaused = !debugState.paused;
		setPaused(newPaused);
		sendPlayback(newPaused);
	};

	return (
		<ToolbarButton
			label={debugStore.paused ? 'Play' : 'Pause'}
			selected={debugStore.paused}
			onClick={handleClick}
		>
			{debugStore.paused ? <Play class="zylem-icon" /> : <Pause class="zylem-icon" />}
		</ToolbarButton>
	);
};
