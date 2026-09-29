import { LayerProvider } from '@zylem/ui/components';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { render } from 'solid-js/web';
import {
	applyDefaultDocks,
	computeDockLayout,
	type DockPanelId,
	type DockSide,
	debugStore,
	detachPanel,
	dockPanelToSide,
	type EditorDockDefaults,
	findDockedSide,
	isPanelDetached,
	MAIN_PANEL_ID,
	seedToolbarDock,
	setMainCollapsed,
	setPanelPosition,
	setPanelSize,
	setToolbarCollapsed,
	TOOLBAR_PANEL_ID,
	TOOLBAR_STRIP_THICKNESS,
	undockPanelFromSides,
} from '.';
import { type DockRequest, FloatingPanel } from './common/FloatingPanel';
import { viewportSize } from './common/viewport';
import { EditorToggleButton } from './EditorToggleButton';
import { DetachedPanel } from './editor-panel/DetachedPanel';
import { Menu } from './editor-panel/Menu';
import { currentPanelVisibility, isPanelVisible } from './editor-panel/panel-visibility';
import { Toolbar } from './toolbar/Toolbar';

// Panel dimensions
const PANEL_WIDTH = 460;
const PANEL_HEIGHT = 600;
const PANEL_MARGIN = 20;
const VIEWPORT_PANEL_MARGIN = 12;
const MOBILE_BOTTOM_BAR_ALLOWANCE = 92;

export type EditorLauncherMode = 'floating' | 'hidden';

export interface EditorController {
	openPanel: () => void;
	closePanel: () => void;
	togglePanel: () => void;
	/** Whether either editor window is showing; collapsed still counts, closed does not. */
	isPanelOpen: () => boolean;
	/**
	 * Dock a panel to a viewport edge, or pass `null` to float it.
	 * Defaults to the main editor panel; any other id is a section, which is
	 * detached from the accordion first.
	 */
	dockPanel: (side: DockSide | null, panelId?: DockPanelId) => void;
}

interface EditorProps {
	launcherMode?: EditorLauncherMode | undefined;
	/** First-run dock layout; ignored once the user has their own. */
	defaultDocks?: EditorDockDefaults | undefined;
	onControllerReady?: ((controller: EditorController | null) => void) | undefined;
}

const getViewportFittedPanelLayout = (
	bottomOffset = 0
): {
	initialPosition: { x: number; y: number };
	initialSize: { width: number; height: number };
} => {
	const inset = VIEWPORT_PANEL_MARGIN;
	const availableWidth = Math.max(300, window.innerWidth - inset * 2);
	const availableHeight = Math.max(200, window.innerHeight - bottomOffset - inset * 2);
	const width = Math.min(PANEL_WIDTH, availableWidth);
	const height = Math.min(PANEL_HEIGHT, availableHeight);
	const topInset = inset;
	const bottomLimit = window.innerHeight - bottomOffset - inset;
	const centeredY = Math.round((bottomLimit - topInset - height) / 2) + topInset;

	return {
		initialPosition: {
			x: Math.max(inset, Math.round((window.innerWidth - width) / 2)),
			y: Math.max(topInset, centeredY),
		},
		initialSize: { width, height },
	};
};

/**
 * Calculate the initial panel position based on the toggle button's quadrant.
 * Panel appears in the same quadrant as the button.
 */
const getInitialPanelPosition = () => {
	// Use saved position if available
	if (debugStore.panelPosition) {
		return debugStore.panelPosition;
	}

	const buttonPos = debugStore.toggleButtonPosition;
	const windowWidth = window.innerWidth;
	const windowHeight = window.innerHeight;

	// Determine which quadrant the button is in
	const isRightSide = buttonPos.x > windowWidth / 2;
	const isBottomSide = buttonPos.y > windowHeight / 2;

	// Position panel in the same quadrant, offset from the button
	let x: number;
	let y: number;

	if (isRightSide) {
		// Right side: align panel to right edge
		x = windowWidth - PANEL_WIDTH - PANEL_MARGIN;
	} else {
		// Left side: align panel to left edge
		x = PANEL_MARGIN;
	}

	if (isBottomSide) {
		// Bottom: position panel above or at bottom
		y = Math.max(PANEL_MARGIN, windowHeight - PANEL_HEIGHT - PANEL_MARGIN);
	} else {
		// Top: position panel near top
		y = PANEL_MARGIN;
	}

	return { x, y };
};

/**
 * Editor root component. Handles open/close state and layout.
 * Renders both the main editor panel and any detached floating panels.
 */
export const Editor: Component<EditorProps> = (props) => {
	const [toolbarOpen, setToolbarOpen] = createSignal(false);
	const [panelOpen, setPanelOpen] = createSignal(false);
	const [toolbarDockRequest, setToolbarDockRequest] = createSignal<DockRequest | null>(null);
	const [panelDockRequest, setPanelDockRequest] = createSignal<DockRequest | null>(null);
	const launcherMode = () => props.launcherMode ?? 'floating';
	const editorOpen = () => toolbarOpen() || panelOpen();

	// Seed before the windows render, so the first layout already reflects the
	// host's requested docks. No-ops once the user has a layout of their own.
	// A saved layout that predates the toolbar window gets one on top, once.
	applyDefaultDocks(props.defaultDocks);
	seedToolbarDock();

	const openEditor = () => {
		setToolbarOpen(true);
		setPanelOpen(true);
	};
	const closeEditor = () => {
		setToolbarOpen(false);
		setPanelOpen(false);
	};
	const toggleEditor = () => {
		if (editorOpen()) closeEditor();
		else openEditor();
	};

	const handlePanelMove = (pos: { x: number; y: number }) => {
		setPanelPosition(pos);
	};

	const mainDockedSide = () => findDockedSide(debugStore.docks, MAIN_PANEL_ID);

	// Get list of detached panel IDs
	const getDetachedPanelIds = () => {
		const visibility = currentPanelVisibility();
		return Object.keys(debugStore.detachedPanels).filter((id) => isPanelVisible(id, visibility));
	};

	const shouldViewportFitPanel = () => {
		if (typeof window === 'undefined') {
			return launcherMode() === 'hidden';
		}

		return (
			launcherMode() === 'hidden' ||
			window.innerWidth < PANEL_WIDTH + PANEL_MARGIN * 2 ||
			window.innerHeight < PANEL_HEIGHT + PANEL_MARGIN * 2
		);
	};

	const panelLayout = createMemo(() => {
		// A docked panel's geometry belongs to the dock registry.
		if (mainDockedSide()) {
			const rect = computeDockLayout(debugStore.docks, viewportSize())[MAIN_PANEL_ID];
			if (rect) {
				return {
					initialPosition: { x: rect.x, y: rect.y },
					initialSize: { width: rect.width, height: rect.height },
				};
			}
		}

		const fallback =
			typeof window === 'undefined' || !shouldViewportFitPanel()
				? {
						initialPosition: getInitialPanelPosition(),
						initialSize: { width: PANEL_WIDTH, height: PANEL_HEIGHT },
					}
				: getViewportFittedPanelLayout(
						launcherMode() === 'hidden' ? MOBILE_BOTTOM_BAR_ALLOWANCE : 0
					);

		// A size the user chose outranks the viewport-fitted default.
		return {
			initialPosition: fallback.initialPosition,
			initialSize: debugStore.panelSize ?? fallback.initialSize,
		};
	});

	const toolbarLayout = createMemo(() => {
		const docked = findDockedSide(debugStore.docks, TOOLBAR_PANEL_ID);
		if (docked) {
			const rect = computeDockLayout(debugStore.docks, viewportSize())[TOOLBAR_PANEL_ID];
			if (rect) {
				return {
					initialPosition: { x: rect.x, y: rect.y },
					initialSize: { width: rect.width, height: rect.height },
				};
			}
		}
		return {
			initialPosition: { x: 0, y: 0 },
			initialSize: { width: 640, height: TOOLBAR_STRIP_THICKNESS },
		};
	});

	const controller: EditorController = {
		openPanel: openEditor,
		closePanel: closeEditor,
		togglePanel: toggleEditor,
		isPanelOpen: editorOpen,
		dockPanel: (side, panelId = MAIN_PANEL_ID) => {
			if (panelId === TOOLBAR_PANEL_ID) {
				setToolbarOpen(true);
				setToolbarDockRequest((previous) => ({
					side,
					nonce: (previous?.nonce ?? 0) + 1,
					panelId,
				}));
				return;
			}

			if (panelId === MAIN_PANEL_ID) {
				// The panel owns the undock/restore path, so route through it.
				setPanelOpen(true);
				setPanelDockRequest((previous) => ({
					side,
					nonce: (previous?.nonce ?? 0) + 1,
					panelId,
				}));
				return;
			}

			if (side === null) {
				undockPanelFromSides(panelId);
				return;
			}

			// Only a detached section can hold a dock slot.
			if (!isPanelDetached(panelId)) {
				detachPanel(panelId, { x: 100, y: 100 });
			}
			dockPanelToSide(panelId, side);
		},
	};

	onMount(() => {
		props.onControllerReady?.(controller);
	});

	onCleanup(() => {
		props.onControllerReady?.(null);
	});

	return (
		// The provider resolves the editor's shadow root once and owns the container
		// every overlay portals into. Without it each overlay resolves its own, and
		// more importantly they would land in `document.body`, outside the tree the
		// editor's styles are injected into.
		<LayerProvider>
			<div
				style={{
					display: 'flex',
					height: '100vh',
					width: '100vw',
					position: 'absolute',
					// The overlay must never swallow input meant for the game underneath;
					// interactive children opt back in with pointer-events: auto.
					'pointer-events': 'none',
				}}
			>
				<Show when={launcherMode() !== 'hidden'}>
					<EditorToggleButton onToggle={toggleEditor} />
				</Show>
				<Show when={toolbarOpen()}>
					<FloatingPanel
						panelId={TOOLBAR_PANEL_ID}
						label="Toolbar"
						hideTitle
						chrome="inline"
						resizable={false}
						fitDockThickness
						hugContent
						initialPosition={toolbarLayout().initialPosition}
						initialSize={toolbarLayout().initialSize}
						floatingSize={{ width: 640, height: TOOLBAR_STRIP_THICKNESS }}
						minSize={{ width: 36, height: 36 }}
						collapsible
						collapsed={debugStore.toolbarCollapsed}
						onCollapsedChange={setToolbarCollapsed}
						onClose={() => setToolbarOpen(false)}
						onRestoreSibling={panelOpen() ? undefined : () => setPanelOpen(true)}
						restoreSiblingLabel="Show panels"
						dockRequest={toolbarDockRequest}
					>
						{(body) => (
							<Toolbar
								orientation={
									body.dockedSide() === 'left' || body.dockedSide() === 'right' ? 'column' : 'row'
								}
							/>
						)}
					</FloatingPanel>
				</Show>
				<Show when={panelOpen()}>
					<FloatingPanel
						panelId={MAIN_PANEL_ID}
						label="Panels"
						hideTitle
						initialPosition={panelLayout().initialPosition}
						initialSize={panelLayout().initialSize}
						floatingSize={debugStore.panelSize ?? { width: PANEL_WIDTH, height: PANEL_HEIGHT }}
						minSize={{ width: 300, height: 200 }}
						collapsible
						collapsed={debugStore.mainCollapsed}
						onCollapsedChange={setMainCollapsed}
						onClose={() => setPanelOpen(false)}
						onRestoreSibling={toolbarOpen() ? undefined : () => setToolbarOpen(true)}
						restoreSiblingLabel="Show toolbar"
						onMove={handlePanelMove}
						onResize={setPanelSize}
						dockRequest={panelDockRequest}
					>
						{(body) => <Menu isCollapsed={body.isCollapsed} />}
					</FloatingPanel>
				</Show>

				{/* Render detached panels */}
				<For each={getDetachedPanelIds()}>{(panelId) => <DetachedPanel panelId={panelId} />}</For>

				{/* Right area reserved for future content */}
				<div style={{ flex: 1 }} />
			</div>
		</LayerProvider>
	);
};

// Only render if we're not in a test environment and the container exists
if (typeof window !== 'undefined' && !import.meta.env.VITEST) {
	const container = document.getElementById('zylem-editor-container');
	if (container) {
		render(() => <Editor />, container);
	}
}
