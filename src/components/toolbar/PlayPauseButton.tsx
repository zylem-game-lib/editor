import { ToolbarButton } from '@zylem/ui/components';
import Pause from 'lucide-solid/icons/pause';
import Play from 'lucide-solid/icons/play';
import type { Component } from 'solid-js';
import { debugStore } from '..';
import { togglePlayback } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

export const PlayPauseButton: Component = () => (
	<ToolbarButton
		label={withShortcut(debugStore.paused ? 'Play' : 'Pause', 'playback')}
		selected={debugStore.paused}
		onClick={togglePlayback}
	>
		{debugStore.paused ? <Play class="zylem-icon" /> : <Pause class="zylem-icon" />}
	</ToolbarButton>
);
