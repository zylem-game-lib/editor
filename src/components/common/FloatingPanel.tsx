import { useLayer } from '@zylem/ui/components';
import { type Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { debugStore, MAIN_PANEL_ID, setDockThickness } from '../editor-store';
import { isHorizontalSide } from './dock-layout';
import type { DockRequest, FloatingPanelBody, FloatingPanelProps } from './floating-panel-types';
import { PANEL_RANK } from './layer-ranks';
import { PanelChrome } from './PanelChrome';
import { PanelResizeHandles } from './PanelResizeHandles';
import { createPanelDocking, DockPreviewOverlay } from './panel-docking';
import { createPanelPointer } from './panel-pointer';

export type { DockRequest, FloatingPanelBody, FloatingPanelProps };

/**
 * FloatingPanel - A draggable and resizable container component.
 * Can be moved by dragging the title bar and resized from edges/corners.
 * Dragging it past a viewport edge docks it; see `panel-docking`.
 */
export const FloatingPanel: Component<FloatingPanelProps> = (props) => {
	const layer = useLayer('panel', PANEL_RANK.mainPanel);
	const panelId = props.panelId ?? MAIN_PANEL_ID;
	const minSize = props.minSize ?? { width: 300, height: 200 };
	const initialPanelSize = props.initialSize ?? { width: 460, height: 600 };
	const chrome = () => props.chrome ?? 'bar';

	const [position, setPosition] = createSignal(props.initialPosition ?? { x: 50, y: 50 });
	const [size, setSize] = createSignal(initialPanelSize);
	const [internalCollapsed, setInternalCollapsed] = createSignal(false);
	const isCollapsed = () => props.collapsed ?? internalCollapsed();

	const toggleCollapse = () => {
		const next = !isCollapsed();
		props.onCollapsedChange?.(next);
		if (props.collapsed === undefined) setInternalCollapsed(next);
	};

	let panelRef: HTMLDivElement | undefined;
	let chromeRef: HTMLDivElement | undefined;

	const docking = createPanelDocking({
		panelId,
		initialSize: props.floatingSize ?? initialPanelSize,
		minSize,
		position,
		setPosition,
		size,
		setSize,
		panelRef: () => panelRef,
		onPositionCommit: (nextPosition) => props.onMove?.(nextPosition),
		onSizeCommit: (nextSize) => props.onResize?.(nextSize),
	});

	const pointer = createPanelPointer({
		minSize,
		position,
		setPosition,
		size,
		setSize,
		docking,
		onResize: (nextSize) => props.onResize?.(nextSize),
	});

	// Host-driven dock commands (toolbar buttons, postMessage from a shell).
	createEffect(() => {
		const request = props.dockRequest?.();
		if (!request || (request.panelId && request.panelId !== panelId)) return;
		docking.dockTo(request.side);
	});

	onMount(() => {
		window.addEventListener('pointermove', pointer.handlePointerMove);
		window.addEventListener('pointerup', pointer.handlePointerUp);

		if (!props.fitDockThickness) return;
		const publishThickness = () => {
			const element = chromeRef;
			if (!element || docking.isMoving()) return;
			const side = docking.dockedSide();
			if (!side) return;
			const occupants = debugStore.docks[side].panels;
			if (occupants.length !== 1 || occupants[0] !== panelId) return;
			const measured = isHorizontalSide(side) ? element.offsetWidth : element.offsetHeight;
			const next = Math.round(measured);
			if (next > 0 && next !== debugStore.docks[side].thickness) {
				setDockThickness(side, next);
			}
		};
		const observer = new ResizeObserver(publishThickness);
		if (chromeRef) observer.observe(chromeRef);
		publishThickness();
		onCleanup(() => observer.disconnect());
	});

	onCleanup(() => {
		window.removeEventListener('pointermove', pointer.handlePointerMove);
		window.removeEventListener('pointerup', pointer.handlePointerUp);
	});

	const useAutoWidth = () => !docking.isMoving() && !!props.hugContent && !docking.dockedSide();
	const useAutoHeight = () =>
		!docking.isMoving() &&
		(useAutoWidth() ||
			(isCollapsed() && !props.fitDockThickness) ||
			(docking.isAutoHeight() && !docking.dockedSide()));
	const renderBody = () =>
		typeof props.children === 'function'
			? props.children({ isCollapsed, dockedSide: docking.dockedSide })
			: props.children;

	return (
		<section
			class="floating-panel"
			ref={panelRef}
			aria-label={props.label ?? props.title ?? 'Panel'}
			style={{
				position: 'fixed',
				left: `${position().x}px`,
				top: `${position().y}px`,
				width: useAutoWidth() ? 'auto' : `${size().width}px`,
				height: useAutoHeight() ? 'auto' : `${size().height}px`,
				'z-index': layer.zIndex(),
				display: 'flex',
				'flex-direction': 'column',
				'border-radius': docking.dockedSide() ? '0' : undefined,
				// The editor overlay root is pointer-events: none; re-enable
				// interaction for the panel itself.
				'pointer-events': 'auto',
				// While being moved the panel is just a transparent outline.
				...(docking.isMoving()
					? {
							background: 'transparent',
							'backdrop-filter': 'none',
							'-webkit-backdrop-filter': 'none',
							'box-shadow': 'none',
							border: '2px solid var(--zylem-color-primary, #61a6e8)',
						}
					: {}),
			}}
		>
			<DockPreviewOverlay rect={docking.getDockPreviewRect()} rank={PANEL_RANK.mainDockPreview} />

			<PanelChrome
				chrome={chrome()}
				title={props.title}
				hideTitle={props.hideTitle}
				dockedSide={docking.dockedSide}
				isMoving={docking.isMoving}
				isCollapsed={isCollapsed}
				onCollapse={props.collapsible ? toggleCollapse : undefined}
				onClose={props.onClose}
				onRestoreSibling={props.onRestoreSibling}
				restoreSiblingLabel={props.restoreSiblingLabel}
				restoreSiblingIcon={props.restoreSiblingIcon}
				onDock={(side) => docking.dockTo(side)}
				onTitlePointerDown={pointer.handleTitleBarPointerDown}
				onChromeRef={(element) => {
					chromeRef = element;
				}}
				body={renderBody}
			/>

			<Show when={props.resizable !== false}>
				<PanelResizeHandles onResizePointerDown={pointer.handleResizePointerDown} />
			</Show>
		</section>
	);
};
