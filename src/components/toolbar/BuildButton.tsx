import { ToolbarButton } from '@zylem/ui/components';
import Hammer from 'lucide-solid/icons/hammer';
import type { Component } from 'solid-js';
import { levelStore } from '../level/level-state';
import { toggleLevelEditor } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

/**
 * Level mode. The document is the file; the stage only previews it.
 * The count is brushes, doodads, and entities in that document.
 */
export const BuildButton: Component = () => {
	const count = () => {
		const document = levelStore.document;
		return document.solids.length + document.doodads.length + document.entities.length;
	};
	const label = () => (count() > 0 ? `Level (${count()})` : 'Level');

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
