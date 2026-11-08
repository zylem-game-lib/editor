import { ToolbarButton } from '@zylem/ui/components';
import PanelRight from 'lucide-solid/icons/panel-right';
import type { Component } from 'solid-js';

export interface PanelsButtonProps {
	/** The panels window is showing. */
	open: boolean;
	onToggle: () => void;
}

/** Opens and closes the panels window. On while that window is open. */
export const PanelsButton: Component<PanelsButtonProps> = (props) => (
	<ToolbarButton label="Panels" on={props.open} onClick={() => props.onToggle()}>
		<PanelRight class="zylem-icon" />
	</ToolbarButton>
);
