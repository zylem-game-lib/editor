import { ToolbarButton } from '@zylem/ui/components';
import Bug from 'lucide-solid/icons/bug';
import type { Component } from 'solid-js';
import { debugStore } from '../editor-store';
import { toggleDebug } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

export const DebugButton: Component = () => (
	<ToolbarButton
		label={withShortcut('Debug', 'debug')}
		selected={debugStore.debug}
		onClick={toggleDebug}
	>
		<Bug class="zylem-icon" />
	</ToolbarButton>
);
