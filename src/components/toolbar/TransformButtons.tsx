import { ToolbarButton } from '@zylem/ui/components';
import Move3d from 'lucide-solid/icons/move-3d';
import Rotate3d from 'lucide-solid/icons/rotate-3d';
import Scale3d from 'lucide-solid/icons/scale-3d';
import { type Component, createMemo, type JSX } from 'solid-js';
import { debugStore } from '..';
import { useEditor } from '../EditorContext';
import { type TransformTool, toggleTransformTool } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';
import { resolveTransformTarget } from './transform-button-state';

interface TransformToolButtonProps {
	tool: TransformTool;
	label: string;
	children: JSX.Element;
}

/**
 * A gizmo-mode toggle; the press itself is `toggleTransformTool`.
 *
 * Always mounted, rather than appearing with the selection: a toolbar whose
 * buttons come and go is one you have to look at before you can aim at it, and
 * pressing one with nothing selected has an obvious meaning — act on whatever was
 * last worked on. Disabled only when even that is unavailable.
 */
const TransformToolButton: Component<TransformToolButtonProps> = (props) => {
	const { stage } = useEditor();

	// The reactive twin of `transformTarget()`, reading the Solid mirrors so the
	// disabled state follows the selection and the entity list.
	const target = createMemo(() =>
		resolveTransformTarget(
			debugStore.selected,
			debugStore.lastTouched,
			stage.entities.map((entity) => entity.uuid).filter((uuid): uuid is string => Boolean(uuid))
		)
	);

	return (
		<ToolbarButton
			label={withShortcut(props.label, props.tool)}
			selected={debugStore.tool === props.tool}
			disabled={!target()}
			onClick={() => toggleTransformTool(props.tool)}
		>
			{props.children}
		</ToolbarButton>
	);
};

export const TranslateButton: Component = () => (
	<TransformToolButton tool="translate" label="Move">
		<Move3d class="zylem-icon" />
	</TransformToolButton>
);

export const RotateButton: Component = () => (
	<TransformToolButton tool="rotate" label="Rotate">
		<Rotate3d class="zylem-icon" />
	</TransformToolButton>
);

export const ScaleButton: Component = () => (
	<TransformToolButton tool="scale" label="Scale">
		<Scale3d class="zylem-icon" />
	</TransformToolButton>
);
