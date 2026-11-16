import { Button, Checkbox, Dialog } from '@zylem/ui/components';
import { For } from 'solid-js';
import { debugStore } from '../editor-store';
import { getPanelConfig, getPanelTitle } from './panel-config';
import {
	currentPanelVisibility,
	isPanelVisible,
	resetPanelOverrides,
	setPanelShown,
} from './panel-visibility';

export interface PanelSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** The checkbox list that shows and hides editor sections. */
export function PanelSettingsDialog(props: PanelSettingsDialogProps) {
	const panelIds = () => debugStore.panelOrder.filter((id) => getPanelConfig(id) !== undefined);

	return (
		<Dialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			title="Panel settings"
			subtitle="Choose which sections are shown. A section with no choice follows the current mode."
			footer={
				<Button size="sm" onClick={() => resetPanelOverrides()}>
					Reset
				</Button>
			}
		>
			<div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--zylem-spacing-sm)' }}>
				<For each={panelIds()}>
					{(id) => (
						<Checkbox
							label={getPanelTitle(id)}
							checked={isPanelVisible(id, currentPanelVisibility(), debugStore.panelOverrides)}
							onChange={(shown) => setPanelShown(id, shown)}
						/>
					)}
				</For>
			</div>
		</Dialog>
	);
}
