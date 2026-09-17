import { ToolbarButton } from '@zylem/ui/components';
import Trash2 from 'lucide-solid/icons/trash-2';
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
		<Trash2 class="zylem-icon" />
	</ToolbarButton>
);
