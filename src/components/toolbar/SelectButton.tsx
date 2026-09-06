import { ToolbarButton } from '@zylem/ui/components';
import MousePointer from 'lucide-solid/icons/mouse-pointer';
import type { Component } from 'solid-js';
import { sendTool } from '../../bridge/editor-bridge';
import { debugStore, setDebugTool } from '..';

export const SelectButton: Component = () => {
	const handleClick = () => {
		const newTool = debugStore.tool === 'select' ? 'none' : 'select';
		setDebugTool(newTool);
		sendTool(newTool);
	};

	return (
		<ToolbarButton label="Select" selected={debugStore.tool === 'select'} onClick={handleClick}>
			<MousePointer class="zylem-icon" />
		</ToolbarButton>
	);
};
