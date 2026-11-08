import { useLayer } from '@zylem/ui/components';
import {
	type Accessor,
	type Component,
	createEffect,
	createMemo,
	createSignal,
	type Setter,
	Show,
	untrack,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import {
	debugStore,
	dockPanelToSide,
	setDockThickness,
	undockPanelFromSides,
} from '../editor-store';
import {
	allowedDockSides,
	clampThickness,
	computeDockLayout,
	type DockPanelId,
	type DockRect,
	type DockSide,
	dockSideAtPointer,
	dockSlotIndex,
	findDockedSide,
	innerEdgeFor,
	isHorizontalSide,
	previewDockRect,
} from './dock-layout';
import { viewportSize } from './viewport';

/** Where a window goes when it is released from a dock and has never floated. */
const FREE_FALLBACK_POSITION: PanelPosition = { x: 12, y: 12 };

export type { DockRect, DockSide } from './dock-layout';

export interface PanelPosition {
	x: number;
	y: number;
}

export interface PanelSize {
	width: number;
	height: number;
}

interface DockPreviewState {
	visible: boolean;
	side: DockSide | null;
	index: number;
}

interface FittedPanel {
	position: PanelPosition;
	size: PanelSize;
}

export type ResizeMode = 'free' | 'thickness';

interface CreatePanelDockingOptions {
	/** Registry id: `'main'` for the editor panel, otherwise a section id. */
	panelId: DockPanelId;
	initialSize: PanelSize;
	minSize: PanelSize;
	position: Accessor<PanelPosition>;
	setPosition: Setter<PanelPosition>;
	size: Accessor<PanelSize>;
	setSize: Setter<PanelSize>;
	panelRef: Accessor<HTMLDivElement | undefined>;
	onPositionCommit?: (position: PanelPosition) => void;
	onSizeCommit?: (size: PanelSize) => void;
	/**
	 * The floating window wraps its content, as the toolbar does. Its free
	 * footprint differs from the docked strip and is only known once it has
	 * laid out.
	 */
	hugContent?: boolean;
}

/**
 * Docking behavior shared by the editor's floating panels.
 *
 * Dock state is not owned here: it lives in the store's dock registry, and
 * `computeDockLayout` turns that into a rect per panel. This hook derives its
 * panel's rect from the registry and pushes it into the caller's
 * position/size signals, so a panel joining or leaving a zone, a zone
 * thickness change, or a window resize relayouts everyone at once. Free
 * (undocked) drag and resize stay entirely local to the caller.
 */
export function createPanelDocking(options: CreatePanelDockingOptions) {
	const [undockedSize, setUndockedSize] = createSignal<PanelSize>({
		width: options.initialSize.width,
		height: options.initialSize.height,
	});
	// A docked window's position signal is the dock rect, so the last place it
	// floated has to be remembered separately. Null means it has never floated.
	const [freePosition, setFreePosition] = createSignal<PanelPosition | null>(
		findDockedSide(debugStore.docks, options.panelId) ? null : options.position()
	);
	const [dockPreview, setDockPreview] = createSignal<DockPreviewState>({
		visible: false,
		side: null,
		index: 0,
	});

	/** Reads straight from the registry, so a persisted dock restores on mount. */
	const dockedSide = createMemo(() => findDockedSide(debugStore.docks, options.panelId));
	const isDocked = () => dockedSide() !== null;

	const dockRect = createMemo<DockRect | null>(() => {
		if (!dockedSide()) return null;
		const layout = computeDockLayout(debugStore.docks, viewportSize());
		return layout[options.panelId] ?? null;
	});

	// Docked geometry is derived, so the panel follows the registry rather than
	// tracking its own position and size. The current values are read untracked
	// so writing them back cannot re-trigger this effect.
	createEffect(() => {
		const rect = dockRect();
		if (!rect) return;
		untrack(() => {
			const currentPos = options.position();
			const currentSize = options.size();
			if (currentPos.x !== rect.x || currentPos.y !== rect.y) {
				options.setPosition({ x: rect.x, y: rect.y });
			}
			if (currentSize.width !== rect.width || currentSize.height !== rect.height) {
				options.setSize({ width: rect.width, height: rect.height });
			}
		});
	});

	/** Docked panels are always explicitly sized; only floating ones hug content. */
	const [isAutoHeightSignal, setIsAutoHeight] = createSignal(true);
	const isAutoHeight = () => !isDocked() && isAutoHeightSignal();

	/** True while the panel is being dragged. */
	const [isMoving, setIsMoving] = createSignal(false);
	/** An undock this hook started, so the release effect does not settle twice. */
	let localUndock = false;

	const showDockPreview = (side: DockSide, index: number) => {
		setDockPreview({ visible: true, side, index });
	};

	const hideDockPreview = () => {
		setDockPreview({ visible: false, side: null, index: 0 });
	};

	const rememberUndockedSize = (nextSize: PanelSize) => {
		setUndockedSize({ width: nextSize.width, height: nextSize.height });
	};

	const getLiveSize = () => {
		const panelElement = options.panelRef();
		if (panelElement) {
			const rect = panelElement.getBoundingClientRect();
			// Undocking the toolbar happens in this same pointer event, so the
			// element can still be the full docked strip. Use the free-float
			// footprint until it has laid out.
			if (options.hugContent && isMoving() && rect.width > 220) {
				return { width: 96, height: 160 };
			}
			return { width: rect.width, height: rect.height };
		}
		return options.size();
	};

	const getDockPreviewRect = (): DockRect | null => {
		const preview = dockPreview();
		if (!preview.visible || !preview.side) return null;
		return previewDockRect(
			debugStore.docks,
			options.panelId,
			preview.side,
			preview.index,
			viewportSize()
		);
	};

	const clampSizeToViewport = (width: number, height: number): PanelSize => {
		const viewport = viewportSize();
		const maxWidth = Math.max(1, viewport.width);
		const maxHeight = Math.max(1, viewport.height);
		const minWidth = Math.min(options.minSize.width, maxWidth);
		const minHeight = Math.min(options.minSize.height, maxHeight);
		return {
			width: Math.min(maxWidth, Math.max(minWidth, width)),
			height: Math.min(maxHeight, Math.max(minHeight, height)),
		};
	};

	const fitPanelToViewport = (
		currentX: number,
		currentY: number,
		currentWidth: number,
		currentHeight: number
	): FittedPanel => {
		const viewport = viewportSize();
		const fittedSize = clampSizeToViewport(currentWidth, currentHeight);
		const maxX = Math.max(0, viewport.width - fittedSize.width);
		const maxY = Math.max(0, viewport.height - fittedSize.height);
		return {
			position: {
				x: Math.max(0, Math.min(currentX, maxX)),
				y: Math.max(0, Math.min(currentY, maxY)),
			},
			size: fittedSize,
		};
	};

	const allowedSides = () => allowedDockSides(options.panelId);

	/** The zone whose viewport edge the pointer has reached, if this window may use it. */
	const detectDockSide = (pointerX: number, pointerY: number): DockSide | null =>
		dockSideAtPointer(options.panelId, { x: pointerX, y: pointerY }, viewportSize());

	/** Slot the panel would drop into on `side`, from the pointer position. */
	const detectDockIndex = (side: DockSide, pointerX: number, pointerY: number): number =>
		dockSlotIndex(
			debugStore.docks,
			side,
			{ x: pointerX, y: pointerY },
			viewportSize(),
			options.panelId
		);

	/**
	 * Keep a moving window entirely on screen at the size it is showing, so
	 * it can be dropped where it is without jumping.
	 */
	const clampDragPosition = (x: number, y: number): PanelPosition => {
		const viewport = viewportSize();
		const live = getLiveSize();
		return {
			x: Math.max(0, Math.min(x, viewport.width - live.width)),
			y: Math.max(0, Math.min(y, viewport.height - live.height)),
		};
	};

	/**
	 * Start moving the panel from the point it was grabbed. A floating panel
	 * moves exactly as it is. A docked one comes out at the size it last
	 * floated at, with the grab point kept at the same place along its title bar.
	 */
	const beginDrag = (grabX: number, grabY: number): FittedPanel => {
		const currentPos = options.position();
		const currentSize = getLiveSize();
		const wasDocked = isDocked();
		if (!wasDocked) {
			rememberUndockedSize(currentSize);
			setFreePosition(currentPos);
		}

		// Set before undocking so a release effect does not treat the drag as an eviction.
		setIsMoving(true);
		undockPanelFromSides(options.panelId);
		hideDockPreview();
		if (!wasDocked) {
			return { position: currentPos, size: currentSize };
		}

		if (options.hugContent) {
			// The docked strip becomes the free column. Keep its grab header
			// under the pointer instead of leaving it at the dock's origin.
			const fitted = fitPanelToViewport(grabX - 47, grabY - 36, 96, 48);
			options.setPosition(fitted.position);
			return { position: fitted.position, size: currentSize };
		}

		const preferred = undockedSize();
		const restored = clampSizeToViewport(preferred.width, preferred.height);
		const grabRatioX =
			currentSize.width > 0
				? Math.max(0, Math.min(1, (grabX - currentPos.x) / currentSize.width))
				: 0;
		options.setSize(restored);
		setIsAutoHeight(true);
		// The clamp measures the element, so it has to run after the resize above.
		const position = clampDragPosition(grabX - restored.width * grabRatioX, currentPos.y);
		options.setPosition(position);
		return { position, size: restored };
	};

	/** Drop the panel without docking it and commit where it landed. */
	const endDrag = (): FittedPanel => {
		const currentPos = options.position();
		const position = clampDragPosition(currentPos.x, currentPos.y);
		const size = options.size();
		options.setPosition(position);
		setFreePosition(position);
		setIsMoving(false);
		options.onSizeCommit?.(size);
		options.onPositionCommit?.(position);
		return { position, size };
	};

	/**
	 * Start a resize. Dragging the edge a docked panel exposes to the viewport
	 * resizes its zone; any other edge pulls the panel out of the dock first.
	 */
	const beginResize = (direction: string | null): { size: PanelSize; mode: ResizeMode } => {
		hideDockPreview();
		const side = dockedSide();

		if (side && direction && direction === innerEdgeFor(side)) {
			const currentSize = getLiveSize();
			options.setSize(currentSize);
			setIsAutoHeight(false);
			return { size: currentSize, mode: 'thickness' };
		}

		if (side) {
			localUndock = true;
			undockPanelFromSides(options.panelId);
		}
		const currentSize = getLiveSize();
		options.setSize(currentSize);
		setIsAutoHeight(false);
		return { size: currentSize, mode: 'free' };
	};

	/**
	 * Apply a thickness resize from a pointer delta. The zone's cross-axis
	 * extent and the panel's position both follow from the registry.
	 */
	const resizeDockThickness = (startThickness: number, deltaX: number, deltaY: number) => {
		const side = dockedSide();
		if (!side) return;

		const horizontal = isHorizontalSide(side);
		const delta = horizontal ? deltaX : deltaY;
		// Left and top grow with the pointer. Right, bottom, and the single band
		// grow against it, because their inner edge faces the other way.
		const signed = side === 'left' || side === 'top' ? delta : -delta;
		const minThickness = horizontal ? options.minSize.width : options.minSize.height;
		const next = clampThickness(
			debugStore.docks,
			side,
			startThickness + signed,
			viewportSize(),
			minThickness
		);
		setDockThickness(side, next);
	};

	const clearDockedSide = () => {
		localUndock = true;
		undockPanelFromSides(options.panelId);
	};

	/** Commit a hovering dock preview. Returns the side taken, or null. */
	const applyDockPreview = (): { side: DockSide; index: number } | null => {
		const preview = dockPreview();
		if (!preview.visible || !preview.side) return null;

		const placed = dockPanelToSide(options.panelId, preview.side, preview.index);
		setIsMoving(false);
		hideDockPreview();
		if (!placed) {
			endDrag();
			return null;
		}
		setIsAutoHeight(false);
		return { side: preview.side, index: preview.index };
	};

	/**
	 * Float the window at its last free position, or the top-left margin when
	 * it has never floated. `local` marks an undock this hook started, so the
	 * release effect does not settle the same window a second time.
	 */
	const settleFloating = (local: boolean): FittedPanel => {
		if (local) localUndock = true;
		const preferred = undockedSize();
		const restored = clampSizeToViewport(preferred.width, preferred.height);
		const origin = freePosition() ?? FREE_FALLBACK_POSITION;
		const fitted = fitPanelToViewport(origin.x, origin.y, restored.width, restored.height);

		undockPanelFromSides(options.panelId);
		options.setSize(fitted.size);
		options.setPosition(fitted.position);
		setFreePosition(fitted.position);
		setIsAutoHeight(true);
		options.onSizeCommit?.(fitted.size);
		options.onPositionCommit?.(fitted.position);
		return fitted;
	};

	const restoreUndockedPanel = (): FittedPanel => settleFloating(true);

	/** Imperative dock command, for host APIs and toolbar buttons. */
	const dockTo = (side: DockSide | null) => {
		if (side === null) {
			if (isDocked()) restoreUndockedPanel();
			return;
		}
		if (!allowedSides().includes(side)) return;
		if (!isDocked()) {
			rememberUndockedSize(options.size());
			setFreePosition(options.position());
		}
		dockPanelToSide(options.panelId, side);
		setIsAutoHeight(false);
	};

	// Someone else took this window's zone (a section releasing the bottom
	// toolbar, or a new section replacing the one in the band). The registry
	// update alone would leave the stretched dock rect in place.
	let previousSide: DockSide | null = untrack(() => dockedSide());
	createEffect(() => {
		const side = dockedSide();
		const previous = previousSide;
		previousSide = side;
		if (previous === null || side !== null) return;
		if (localUndock) {
			localUndock = false;
			return;
		}
		if (untrack(isMoving)) return;
		untrack(() => settleFloating(false));
	});

	/**
	 * Keep a floating panel inside a resized viewport. Docked panels need no
	 * handling here; their rects are derived from the viewport signal.
	 */
	const fitFloatingPanelToViewport = () => {
		if (isDocked()) return;

		const currentPos = options.position();
		const currentSize = isAutoHeight() ? getLiveSize() : options.size();
		const fitted = fitPanelToViewport(
			currentPos.x,
			currentPos.y,
			currentSize.width,
			currentSize.height
		);

		if (currentSize.width !== fitted.size.width || currentSize.height !== fitted.size.height) {
			options.setSize(fitted.size);
			options.onSizeCommit?.(fitted.size);
		}
		if (currentPos.x !== fitted.position.x || currentPos.y !== fitted.position.y) {
			options.setPosition(fitted.position);
			options.onPositionCommit?.(fitted.position);
		}
		setFreePosition(fitted.position);
	};

	// One shared viewport signal replaces the per-panel resize listeners.
	createEffect(() => {
		viewportSize();
		untrack(fitFloatingPanelToViewport);
	});

	return {
		dockedSide,
		dockRect,
		isAutoHeight,
		setIsAutoHeight,
		showDockPreview,
		hideDockPreview,
		rememberUndockedSize,
		getLiveSize,
		getDockPreviewRect,
		detectDockSide,
		detectDockIndex,
		beginDrag,
		clampDragPosition,
		endDrag,
		isMoving,
		clampSizeToViewport,
		fitPanelToViewport,
		beginResize,
		resizeDockThickness,
		clearDockedSide,
		applyDockPreview,
		restoreUndockedPanel,
		dockTo,
	};
}

/**
 * Outline showing where a dragged panel would dock.
 *
 * Portaled so the panel's own bounds cannot clip it, and into the layer container
 * rather than `document.body` so it stays in the tree the editor's tokens and
 * styles were injected into.
 */
export const DockPreviewOverlay: Component<{
	rect: DockRect | null;
	/** Rank within the panel tier; keeps it just above the panel it belongs to. */
	rank: Accessor<number> | number;
}> = (props) => {
	const layer = useLayer('panel', props.rank);

	return (
		<Show when={props.rect}>
			{(previewRect) => (
				<Show when={layer.mount()} keyed>
					{(mount) => (
						<Portal mount={mount}>
							<div
								style={{
									position: 'fixed',
									left: `${previewRect().x}px`,
									top: `${previewRect().y}px`,
									width: `${previewRect().width}px`,
									height: `${previewRect().height}px`,
									'z-index': layer.zIndex(),
									'pointer-events': 'none',
									'box-sizing': 'border-box',
									border: '2px dashed var(--zylem-color-primary)',
									background: 'rgba(10, 20, 30, 0.2)',
									'border-radius': '0',
								}}
							/>
						</Portal>
					)}
				</Show>
			)}
		</Show>
	);
};
