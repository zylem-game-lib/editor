import { ToolbarButton } from '@zylem/ui/components';
import Hammer from 'lucide-solid/icons/hammer';
import type { Component } from 'solid-js';
import { levelStore } from '../level/level-state';
import { toggleLevelEditor } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

/**
 * Level-editor mode. While it is on, the stage is recorded into a level buffer
 * the game can stream later. The count is how many catalog entries that buffer
 * holds, including one frozen from a previous session of the mode.
 */
export const BuildButton: Component = () => {
	const count = () => levelStore.buffer?.entries.length ?? 0;
	const label = () => {
		const name = levelStore.active ? 'Building' : 'Build';
		return count() > 0 ? `${name} (${count()})` : name;
	};

	return (
		<ToolbarButton
			label={withShortcut(label(), 'build')}
			selected={levelStore.active}
			onClick={toggleLevelEditor}
		>
			<Hammer class="zylem-icon" />
		</ToolbarButton>
	);
};
