import { ToolbarButton } from '@zylem/ui/components';
import Redo2 from 'lucide-solid/icons/redo-2';
import Undo2 from 'lucide-solid/icons/undo-2';
import type { Component } from 'solid-js';
import { historyStore, redo, undo } from '../history/history-store';
import { withShortcut } from './toolbar-shortcuts';

const lastLabel = (stack: { label: string }[]): string | null =>
	stack[stack.length - 1]?.label ?? null;

// Disabled on an empty stack rather than left as a silent no-op, so a press
// that can do nothing looks like one.
export const UndoButton: Component = () => {
	const label = () => {
		const next = lastLabel(historyStore.undoStack);
		return next ? withShortcut(`Undo ${next}`, 'undo') : 'Nothing to undo';
	};

	return (
		<ToolbarButton
			label={label()}
			disabled={historyStore.undoStack.length === 0}
			onClick={() => undo()}
		>
			<Undo2 class="zylem-icon" />
		</ToolbarButton>
	);
};

export const RedoButton: Component = () => {
	const label = () => {
		const next = lastLabel(historyStore.redoStack);
		return next ? withShortcut(`Redo ${next}`, 'redo') : 'Nothing to redo';
	};

	return (
		<ToolbarButton
			label={label()}
			disabled={historyStore.redoStack.length === 0}
			onClick={() => redo()}
		>
			<Redo2 class="zylem-icon" />
		</ToolbarButton>
	);
};
