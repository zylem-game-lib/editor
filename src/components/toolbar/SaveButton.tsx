import { ToolbarButton } from '@zylem/ui/components';
import Save from 'lucide-solid/icons/save';
import type { Component } from 'solid-js';
import { requestSave, saveStore } from '../save/save-state';
import { withShortcut } from './toolbar-shortcuts';

// Disabled with nothing to save, as Undo is with nothing to undo.
export const SaveButton: Component = () => {
	const label = () => {
		if (saveStore.status === 'saving') return 'Saving…';
		if (!saveStore.dirty) return 'No unsaved changes';
		if (saveStore.status === 'failed') {
			return withShortcut(`Save failed: ${saveStore.error}. Try again`, 'save');
		}
		return withShortcut('Save', 'save');
	};

	return (
		<ToolbarButton
			label={label()}
			disabled={saveStore.status === 'saving' || !saveStore.dirty}
			onClick={() => void requestSave()}
		>
			<Save class="zylem-icon" />
		</ToolbarButton>
	);
};
