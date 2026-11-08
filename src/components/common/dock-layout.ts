/**
 * Dock layout geometry.
 *
 * Every docked window's rect comes from one registry via `computeDockLayout`.
 * Three kinds of window share that registry, and each kind has its own zones:
 *
 * - The toolbar docks to the top or bottom edge, or floats.
 * - The main panel section docks to the left or right edge, or floats.
 * - One detached section docks to `single`, the full-width band above the
 *   bottom edge, or floats. Docking a section there releases a bottom toolbar
 *   so the band can take that space. Putting the toolbar back on the bottom
 *   leaves the section where it is, stacked above the strip.
 *
 * This module is deliberately free of Solid and `window` so the geometry can
 * be unit tested directly.
 */

export type DockSide = 'left' | 'right' | 'top' | 'bottom' | 'single';

/** `'toolbar'` is the tool strip, `'main'` is the panel section, anything else is a section id. */
export type DockPanelId = string;

export type DockRole = 'toolbar' | 'main' | 'section';

export interface DockZoneState {
	/** The window in this zone. A zone holds one window; later entries are ignored. */
	panels: DockPanelId[];
	/**
	 * Width for left/right, height for top/bottom/single.
	 * `0` means "not chosen yet"; the layout falls back to a viewport quarter,
	 * or the button-strip size for a toolbar.
	 */
	thickness: number;
}

export type DockRegistry = Record<DockSide, DockZoneState>;

export interface Viewport {
	width: number;
	height: number;
}

export interface DockRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const DOCK_SIDES: readonly DockSide[] = ['left', 'right', 'top', 'bottom', 'single'];

/** The tool strip. It may occupy the top or bottom edge. */
export const TOOLBAR_PANEL_ID = 'toolbar';

/** The accordion of editor sections. It may occupy the left or right edge. */
export const MAIN_PANEL_ID = 'main';

/**
 * Cross-axis size of the button strip before the toolbar window has measured
 * itself. A normal zone with no stored thickness uses a quarter of the
 * viewport; the toolbar must not.
 */
export const TOOLBAR_STRIP_THICKNESS = 40;

/** Keeps at least a sliver of the game visible between opposing docks. */
export const MIN_FREE_SPACE = 80;

export const dockRole = (panelId: DockPanelId): DockRole => {
	if (panelId === TOOLBAR_PANEL_ID) return 'toolbar';
	if (panelId === MAIN_PANEL_ID) return 'main';
	return 'section';
};

const TOOLBAR_DOCK_SIDES: readonly DockSide[] = ['top', 'bottom'];
const MAIN_DOCK_SIDES: readonly DockSide[] = ['left', 'right'];
const SECTION_DOCK_SIDES: readonly DockSide[] = ['single'];

/** Zones a window is allowed to occupy. Floating is always allowed and is not a zone. */
export const allowedDockSides = (panelId: DockPanelId): readonly DockSide[] => {
	switch (dockRole(panelId)) {
		case 'toolbar':
			return TOOLBAR_DOCK_SIDES;
		case 'main':
			return MAIN_DOCK_SIDES;
		default:
			return SECTION_DOCK_SIDES;
	}
};

/** Left and right zones are sized along x. Top, bottom, and single are sized along y. */
export const isHorizontalSide = (side: DockSide): boolean => side === 'left' || side === 'right';

/**
 * The edge a docked panel exposes to the rest of the viewport. Dragging it
 * resizes the zone instead of undocking the panel. The single-panel band
 * exposes its top edge, the same way the bottom strip does.
 */
export const innerEdgeFor = (side: DockSide): 'e' | 'w' | 's' | 'n' => {
	switch (side) {
		case 'left':
			return 'e';
		case 'right':
			return 'w';
		case 'top':
			return 's';
		case 'bottom':
		case 'single':
			return 'n';
	}
};

export const createEmptyDockRegistry = (): DockRegistry => ({
	left: { panels: [], thickness: 0 },
	right: { panels: [], thickness: 0 },
	top: { panels: [], thickness: 0 },
	bottom: { panels: [], thickness: 0 },
	single: { panels: [], thickness: 0 },
});

const readZone = (value: unknown, seen: Set<DockPanelId>): DockZoneState => {
	const zone: DockZoneState = { panels: [], thickness: 0 };
	if (!value || typeof value !== 'object') return zone;

	const panels = (value as { panels?: unknown }).panels;
	if (Array.isArray(panels)) {
		for (const id of panels) {
			// A panel can only occupy one slot; drop duplicates rather than
			// rendering the same panel in two zones.
			if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
			seen.add(id);
			zone.panels.push(id);
		}
	}

	const thickness = (value as { thickness?: unknown }).thickness;
	if (typeof thickness === 'number' && Number.isFinite(thickness) && thickness > 0) {
		zone.thickness = thickness;
	}
	return zone;
};

/**
 * Reads a stored registry without applying role rules. `repairDockRegistry`
 * is what makes the result legal.
 */
const parseDockRegistry = (value: unknown): DockRegistry => {
	const registry = createEmptyDockRegistry();
	if (!value || typeof value !== 'object') return registry;

	const seen = new Set<DockPanelId>();
	for (const side of DOCK_SIDES) {
		registry[side] = readZone((value as Record<string, unknown>)[side], seen);
	}
	return registry;
};

const zoneOf = (registry: DockRegistry, panelId: DockPanelId): DockSide | null =>
	DOCK_SIDES.find((side) => registry[side].panels.includes(panelId)) ?? null;

/**
 * Moves windows that were saved under the old shared-edge rules onto a legal
 * zone. This does not release a bottom toolbar: a layout that already has both
 * a bottom toolbar and a section in `single` stays stacked. Release happens
 * only when a section is newly placed with `placeInDock`.
 */
export const repairDockRegistry = (registry: DockRegistry): DockRegistry => {
	const next = createEmptyDockRegistry();
	const claimed = new Set<DockPanelId>();

	const toolbarSide = zoneOf(registry, TOOLBAR_PANEL_ID);
	if (toolbarSide) {
		const side: DockSide = toolbarSide === 'top' || toolbarSide === 'bottom' ? toolbarSide : 'top';
		next[side].panels = [TOOLBAR_PANEL_ID];
		if (side === toolbarSide) next[side].thickness = registry[side].thickness;
		claimed.add(TOOLBAR_PANEL_ID);
	}

	const mainSide = zoneOf(registry, MAIN_PANEL_ID);
	if (mainSide) {
		const side: DockSide = mainSide === 'left' || mainSide === 'right' ? mainSide : 'right';
		next[side].panels = [MAIN_PANEL_ID];
		if (side === mainSide) next[side].thickness = registry[side].thickness;
		claimed.add(MAIN_PANEL_ID);
	}

	// Prefer a section that already has the band, then the old bottom edge,
	// so a console that used to own the bottom keeps its height.
	const sectionSources: readonly DockSide[] = ['single', 'bottom', 'top', 'left', 'right'];
	let section: { id: DockPanelId; from: DockSide } | null = null;
	for (const side of sectionSources) {
		if (section) break;
		for (const id of registry[side].panels) {
			if (claimed.has(id) || dockRole(id) !== 'section') continue;
			section = { id, from: side };
			break;
		}
	}

	if (section) {
		next.single.panels = [section.id];
		if (section.from === 'single' || section.from === 'top' || section.from === 'bottom') {
			next.single.thickness = registry[section.from].thickness;
		}
	}

	return next;
};

/** Repairs partial, malformed, or pre-rule registries coming out of localStorage. */
export const normalizeDockRegistry = (value: unknown): DockRegistry =>
	repairDockRegistry(parseDockRegistry(value));

export const findDockedSide = (registry: DockRegistry, panelId: DockPanelId): DockSide | null =>
	zoneOf(registry, panelId);

export const isDocked = (registry: DockRegistry, panelId: DockPanelId): boolean =>
	findDockedSide(registry, panelId) !== null;

const cloneRegistry = (registry: DockRegistry): DockRegistry => {
	const next = createEmptyDockRegistry();
	for (const side of DOCK_SIDES) {
		next[side] = {
			panels: [...registry[side].panels],
			thickness: registry[side].thickness,
		};
	}
	return next;
};

export const removeFromZones = (registry: DockRegistry, panelId: DockPanelId): DockRegistry => {
	const next = cloneRegistry(registry);
	for (const side of DOCK_SIDES) {
		next[side].panels = next[side].panels.filter((id) => id !== panelId);
	}
	return next;
};

/**
 * Move `panelId` into `side` at `index`, removing it from wherever it was.
 * Omitting `index` appends. This does not enforce role rules; `placeInDock` does.
 */
export const insertIntoZone = (
	registry: DockRegistry,
	panelId: DockPanelId,
	side: DockSide,
	index?: number
): DockRegistry => {
	const next = removeFromZones(registry, panelId);
	const panels = next[side].panels;
	const target = index === undefined ? panels.length : Math.max(0, Math.min(index, panels.length));
	panels.splice(target, 0, panelId);
	return next;
};

export interface DockPlacement {
	registry: DockRegistry;
	/** Windows removed from a dock because this placement replaced or released them. */
	evicted: DockPanelId[];
}

/**
 * Move `panelId` into `side`, or leave the registry untouched when that window
 * cannot use the zone. Each zone keeps one window. Placing a section in
 * `single` releases a bottom toolbar; placing the toolbar on the bottom does
 * not release the section.
 *
 * `index` is accepted so callers can share a signature with `insertIntoZone`.
 * Zones are not split, so the window always occupies the zone alone.
 */
export const placeInDock = (
	registry: DockRegistry,
	panelId: DockPanelId,
	side: DockSide,
	index?: number
): DockPlacement => {
	void index;
	if (!allowedDockSides(panelId).includes(side)) {
		return { registry, evicted: [] };
	}

	const alreadyAlone = registry[side].panels.length === 1 && registry[side].panels[0] === panelId;
	const releasesToolbar = side === 'single' && registry.bottom.panels.includes(TOOLBAR_PANEL_ID);
	if (alreadyAlone && !releasesToolbar) {
		return { registry, evicted: [] };
	}

	const evicted: DockPanelId[] = [];
	let next = removeFromZones(registry, panelId);
	for (const occupant of next[side].panels) {
		if (occupant !== panelId) evicted.push(occupant);
	}
	next = {
		...next,
		[side]: { panels: [panelId], thickness: next[side].thickness },
	};

	if (side === 'single' && next.bottom.panels.includes(TOOLBAR_PANEL_ID)) {
		evicted.push(TOOLBAR_PANEL_ID);
		next = {
			...next,
			bottom: {
				panels: next.bottom.panels.filter((id) => id !== TOOLBAR_PANEL_ID),
				thickness: next.bottom.thickness,
			},
		};
	}

	return { registry: next, evicted };
};

const zoneViewportExtent = (side: DockSide, viewport: Viewport): number =>
	isHorizontalSide(side) ? viewport.width : viewport.height;

/**
 * Resolved thickness for a zone: the stored value, or a quarter of the
 * viewport when the user has never sized it. A lone toolbar on the top or
 * bottom edge uses the button-strip size instead.
 */
export const resolveThickness = (
	registry: DockRegistry,
	side: DockSide,
	viewport: Viewport
): number => {
	if (registry[side].panels.length === 0) return 0;
	const extent = zoneViewportExtent(side, viewport);
	const stored = registry[side].thickness;
	const loneToolbar =
		(side === 'top' || side === 'bottom') &&
		registry[side].panels.length === 1 &&
		registry[side].panels[0] === TOOLBAR_PANEL_ID;
	const thickness =
		stored > 0 ? stored : loneToolbar ? TOOLBAR_STRIP_THICKNESS : Math.round(extent / 4);
	return Math.max(1, Math.min(thickness, extent));
};

/** Thickness already claimed by the zones that share this axis. */
const reservedThickness = (registry: DockRegistry, side: DockSide, viewport: Viewport): number => {
	if (side === 'left' || side === 'right') {
		const opposite = side === 'left' ? 'right' : 'left';
		return resolveThickness(registry, opposite, viewport);
	}
	const sharing: readonly DockSide[] = ['top', 'bottom', 'single'];
	return sharing.reduce(
		(sum, other) => (other === side ? sum : sum + resolveThickness(registry, other, viewport)),
		0
	);
};

/**
 * Clamp a proposed zone thickness so the panel stays usable and the other
 * zones on the same axis keep room. `minThickness` is the occupant's minimum.
 * `single` shares the vertical axis with the top and bottom docks.
 */
export const clampThickness = (
	registry: DockRegistry,
	side: DockSide,
	thickness: number,
	viewport: Viewport,
	minThickness: number
): number => {
	const extent = zoneViewportExtent(side, viewport);
	const reserved = reservedThickness(registry, side, viewport);
	const max = Math.max(1, extent - reserved - MIN_FREE_SPACE);
	const min = Math.max(1, Math.min(minThickness, max));
	return Math.round(Math.max(min, Math.min(thickness, max)));
};

/**
 * Rect for every docked panel.
 *
 * Top and bottom each span the full width and hold the toolbar. `single` is
 * the full-width band above the bottom dock and holds one section. Left and
 * right fill the band between the top dock and that section, and hold the
 * main panel. An empty zone adds no inset. A zone with extra entries lays
 * out only its first window.
 */
export const computeDockLayout = (
	registry: DockRegistry,
	viewport: Viewport
): Record<DockPanelId, DockRect> => {
	const layout: Record<DockPanelId, DockRect> = {};

	const topThickness = resolveThickness(registry, 'top', viewport);
	const bottomThickness = resolveThickness(registry, 'bottom', viewport);
	const singleThickness = resolveThickness(registry, 'single', viewport);

	const topId = registry.top.panels[0];
	if (topId) {
		layout[topId] = { x: 0, y: 0, width: viewport.width, height: topThickness };
	}

	const bottomHeight = Math.min(bottomThickness, Math.max(0, viewport.height - topThickness));
	const bottomY = viewport.height - bottomHeight;
	const bottomId = registry.bottom.panels[0];
	if (bottomId) {
		layout[bottomId] = { x: 0, y: bottomY, width: viewport.width, height: bottomHeight };
	}

	const singleY = Math.max(topThickness, bottomY - singleThickness);
	const singleHeight = Math.max(0, Math.min(singleThickness, bottomY - singleY));
	const singleId = registry.single.panels[0];
	if (singleId && singleHeight > 0) {
		layout[singleId] = { x: 0, y: singleY, width: viewport.width, height: singleHeight };
	}

	const insetY = topThickness;
	const insetHeight = Math.max(1, singleY - insetY);
	const leftId = registry.left.panels[0];
	if (leftId) {
		const width = resolveThickness(registry, 'left', viewport);
		layout[leftId] = { x: 0, y: insetY, width, height: insetHeight };
	}
	const rightId = registry.right.panels[0];
	if (rightId) {
		const width = resolveThickness(registry, 'right', viewport);
		layout[rightId] = {
			x: Math.max(0, viewport.width - width),
			y: insetY,
			width,
			height: insetHeight,
		};
	}

	return layout;
};

/** How close the pointer has to get to a viewport edge before a drag offers that dock. */
export const DOCK_EDGE_THRESHOLD = 24;

/** `single` is the band above the bottom edge, so a drag reaches it through that edge. */
const pointerEdgeDistance = (
	side: DockSide,
	pointer: { x: number; y: number },
	viewport: Viewport
): number => {
	switch (side) {
		case 'left':
			return pointer.x;
		case 'right':
			return viewport.width - pointer.x;
		case 'top':
			return pointer.y;
		case 'bottom':
		case 'single':
			return viewport.height - pointer.y;
	}
};

/**
 * The zone a drag offers once the pointer reaches a viewport edge.
 *
 * Docking follows the pointer, not the window's box: a full-size window
 * overlaps an edge almost anywhere it is dragged, while the pointer only
 * reaches one on purpose. Only zones the window may use count, so a corner
 * still offers the one it can take.
 */
export const dockSideAtPointer = (
	panelId: DockPanelId,
	pointer: { x: number; y: number },
	viewport: Viewport
): DockSide | null => {
	let nearest: DockSide | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const side of allowedDockSides(panelId)) {
		const distance = pointerEdgeDistance(side, pointer, viewport);
		if (distance <= DOCK_EDGE_THRESHOLD && distance < nearestDistance) {
			nearest = side;
			nearestDistance = distance;
		}
	}
	return nearest;
};

/**
 * Where a panel would land if dropped on `side`.
 * Each zone holds one window, so the drop always takes that single slot.
 */
export const dockSlotIndex = (
	_registry: DockRegistry,
	_side: DockSide,
	_pointer: { x: number; y: number },
	_viewport: Viewport,
	_panelId?: DockPanelId
): number => 0;

/** Rect a panel would occupy if docked to `side`, for the drag preview. */
export const previewDockRect = (
	registry: DockRegistry,
	panelId: DockPanelId,
	side: DockSide,
	index: number,
	viewport: Viewport
): DockRect | null => {
	const next = placeInDock(registry, panelId, side, index).registry;
	if (findDockedSide(next, panelId) !== side) return null;
	return computeDockLayout(next, viewport)[panelId] ?? null;
};
