import type { Accessor, Setter } from 'solid-js';
import { type DockSide, isHorizontalSide } from './dock-layout';
import type { PanelPosition, PanelSize, ResizeMode } from './panel-docking';

/** Minimum drag threshold to distinguish from clicks. */
const DRAG_THRESHOLD = 3;

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Docking operations the pointer handlers need. The rest of the controller stays put. */
export interface PanelPointerDocking {
	dockedSide: Accessor<DockSide | null>;
	hideDockPreview: () => void;
	showDockPreview: (side: DockSide, index: number) => void;
	getLiveSize: () => PanelSize;
	detectDockSide: (x: number, y: number, width: number, height: number) => DockSide | null;
	detectDockIndex: (side: DockSide, clientX: number, clientY: number) => number;
	beginDragGhost: (
		clientX: number,
		clientY: number
	) => {
		position: PanelPosition;
		size: PanelSize;
	};
	endDragGhost: () => void;
	beginResize: (direction: string | null) => { size: PanelSize; mode: ResizeMode };
	resizeDockThickness: (startThickness: number, deltaX: number, deltaY: number) => void;
	applyDockPreview: () => { side: DockSide; index: number } | null;
	rememberUndockedSize: (size: PanelSize) => void;
	clampSizeToViewport: (width: number, height: number) => PanelSize;
}

export interface PanelPointerOptions {
	minSize: PanelSize;
	position: Accessor<PanelPosition>;
	setPosition: Setter<PanelPosition>;
	size: Accessor<PanelSize>;
	setSize: Setter<PanelSize>;
	docking: PanelPointerDocking;
	onResize?: (size: PanelSize) => void;
}

/**
 * Drag and resize pointer handling for a floating panel.
 * Window listeners stay with the panel so the dock-thickness observer can share its mount.
 */
export function createPanelPointer(options: PanelPointerOptions) {
	const { minSize, position, setPosition, size, setSize, docking } = options;

	let isDragging = false;
	let isResizing = false;
	let resizeMode: ResizeMode = 'free';
	let resizeDirection: ResizeDirection | null = null;
	let dragStartPos = { x: 0, y: 0 };
	let panelStartPos = { x: 0, y: 0 };
	let panelStartSize = { width: 0, height: 0 };
	let startThickness = 0;
	let hasMoved = false;

	const clampPosition = (x: number, y: number, width: number, _height: number) => {
		const padding = 50;
		return {
			x: Math.max(-width + padding, Math.min(x, window.innerWidth - padding)),
			y: Math.max(0, Math.min(y, window.innerHeight - padding)),
		};
	};

	const handleTitleBarPointerDown = (event: PointerEvent) => {
		const target = event.target;
		if (
			target instanceof Element &&
			target.closest('button, a, input, textarea, select, [data-no-drag]')
		) {
			return;
		}
		isDragging = true;
		hasMoved = false;
		docking.hideDockPreview();
		dragStartPos = { x: event.clientX, y: event.clientY };
		panelStartPos = { ...position() };

		// Prevent default on mouse to avoid selection, but allow touch actions if needed
		// though touch-action: none handles the scrolling prevention
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}
	};

	const handleResizePointerDown = (direction: ResizeDirection) => (event: PointerEvent) => {
		isResizing = true;
		resizeDirection = direction;
		const side = docking.dockedSide();
		const { size: currentSize, mode } = docking.beginResize(direction);
		resizeMode = mode;
		// A thickness resize measures from the zone's current extent, not the
		// panel box, since every panel in the zone shares it.
		startThickness = side && isHorizontalSide(side) ? currentSize.width : currentSize.height;
		dragStartPos = { x: event.clientX, y: event.clientY };
		panelStartPos = { ...position() };
		panelStartSize = { ...currentSize };

		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}
		event.stopPropagation();
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (isDragging) {
			let deltaX = event.clientX - dragStartPos.x;
			let deltaY = event.clientY - dragStartPos.y;

			if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
				if (!hasMoved) {
					hasMoved = true;
					// Every move happens through the small ghost, docked or not.
					const fitted = docking.beginDragGhost(event.clientX, event.clientY);
					dragStartPos = { x: event.clientX, y: event.clientY };
					panelStartPos = { ...fitted.position };
					panelStartSize = { ...fitted.size };
					deltaX = 0;
					deltaY = 0;
				}
			}

			if (hasMoved) {
				const proposedX = panelStartPos.x + deltaX;
				const proposedY = panelStartPos.y + deltaY;
				const liveSize = docking.getLiveSize();

				const dockSide = docking.detectDockSide(
					proposedX,
					proposedY,
					liveSize.width,
					liveSize.height
				);
				if (dockSide) {
					docking.showDockPreview(
						dockSide,
						docking.detectDockIndex(dockSide, event.clientX, event.clientY)
					);
				} else {
					docking.hideDockPreview();
				}

				setPosition(clampPosition(proposedX, proposedY, liveSize.width, liveSize.height));
			}
		} else if (isResizing && resizeDirection) {
			const deltaX = event.clientX - dragStartPos.x;
			const deltaY = event.clientY - dragStartPos.y;

			// While docked, the only free dimension is the zone's thickness;
			// position and cross-axis extent come from the dock layout.
			if (resizeMode === 'thickness') {
				docking.resizeDockThickness(startThickness, deltaX, deltaY);
				return;
			}

			let newWidth = panelStartSize.width;
			let newHeight = panelStartSize.height;
			let newX = panelStartPos.x;
			let newY = panelStartPos.y;

			if (resizeDirection.includes('e')) {
				newWidth = panelStartSize.width + deltaX;
			} else if (resizeDirection.includes('w')) {
				newWidth = panelStartSize.width - deltaX;
				newX = panelStartPos.x + deltaX;
			}

			if (resizeDirection.includes('s')) {
				newHeight = panelStartSize.height + deltaY;
			} else if (resizeDirection.includes('n')) {
				newHeight = panelStartSize.height - deltaY;
				newY = panelStartPos.y + deltaY;
			}

			const clampedSize = docking.clampSizeToViewport(newWidth, newHeight);

			// Adjust position if we hit minimum size when resizing from top/left
			if (resizeDirection.includes('w') && clampedSize.width === minSize.width) {
				newX = panelStartPos.x + panelStartSize.width - minSize.width;
			}
			if (resizeDirection.includes('n') && clampedSize.height === minSize.height) {
				newY = panelStartPos.y + panelStartSize.height - minSize.height;
			}

			setSize(clampedSize);
			setPosition(clampPosition(newX, newY, clampedSize.width, clampedSize.height));
		}
	};

	const handlePointerUp = () => {
		if (isDragging && hasMoved) {
			if (docking.applyDockPreview()) {
				// Docking state and callbacks are handled by the shared controller.
			} else {
				// Drop the ghost: restores the pre-drag size and commits
				// position/size through the controller callbacks.
				docking.endDragGhost();
			}
		}

		// A thickness resize keeps the panel docked; its extent already lives in
		// the registry, so only a free resize reports a floating size.
		if (isResizing && resizeMode === 'free') {
			docking.rememberUndockedSize(size());
			options.onResize?.(size());
		}

		isDragging = false;
		isResizing = false;
		resizeMode = 'free';
		resizeDirection = null;
		hasMoved = false;
		docking.hideDockPreview();
	};

	return {
		handleTitleBarPointerDown,
		handleResizePointerDown,
		handlePointerMove,
		handlePointerUp,
	};
}
