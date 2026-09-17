import { ToolbarButton } from '@zylem/ui/components';
import MousePointer from 'lucide-solid/icons/mouse-pointer';
import type { Component } from 'solid-js';
import { debugStore } from '..';
import { toggleTool } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

export const SelectButton: Component = () => (
	<ToolbarButton
		label={withShortcut('Select', 'select')}
		selected={debugStore.tool === 'select'}
		onClick={() => toggleTool('select')}
	>
		<MousePointer class="zylem-icon" />
	</ToolbarButton>
);
