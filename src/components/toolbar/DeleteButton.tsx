import { ToolbarButton } from '@zylem/ui/components';
import Trash from 'lucide-solid/icons/trash';
import type { Component } from 'solid-js';
import { debugStore } from '..';
import { toggleTool } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

export const DeleteButton: Component = () => (
	<ToolbarButton
		label={withShortcut('Delete', 'delete')}
		selected={debugStore.tool === 'delete'}
		onClick={() => toggleTool('delete')}
	>
		<Trash class="zylem-icon" />
	</ToolbarButton>
);
