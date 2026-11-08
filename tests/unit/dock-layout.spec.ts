import { describe, expect, it } from 'vitest';
import {
	allowedDockSides,
	clampThickness,
	computeDockLayout,
	createEmptyDockRegistry,
	DOCK_EDGE_THRESHOLD,
	type DockRegistry,
	type DockSide,
	dockSideAtPointer,
	dockSlotIndex,
	findDockedSide,
	innerEdgeFor,
	insertIntoZone,
	MAIN_PANEL_ID,
	MIN_FREE_SPACE,
	normalizeDockRegistry,
	placeInDock,
	previewDockRect,
	removeFromZones,
	resolveThickness,
	TOOLBAR_PANEL_ID,
	TOOLBAR_STRIP_THICKNESS,
	type Viewport,
} from '../../src/components/common/dock-layout';

const viewport: Viewport = { width: 1000, height: 800 };

const registryOf = (
	entries: Array<[side: DockSide, panels: string[], thickness?: number]>
): DockRegistry => {
	let registry = createEmptyDockRegistry();
	for (const [side, panels, thickness] of entries) {
		for (const panelId of panels) {
			registry = insertIntoZone(registry, panelId, side);
		}
		if (thickness !== undefined) {
			registry[side].thickness = thickness;
		}
	}
	return registry;
};

describe('zone membership', () => {
	it('reports the side a panel is docked to', () => {
		const registry = registryOf([['single', ['console']]]);
		expect(findDockedSide(registry, 'console')).toBe('single');
		expect(findDockedSide(registry, 'main')).toBeNull();
	});

	it('moves a panel between zones rather than duplicating it', () => {
		const registry = insertIntoZone(registryOf([['left', ['main']]]), 'main', 'top');
		expect(registry.left.panels).toEqual([]);
		expect(registry.top.panels).toEqual(['main']);
	});

	it('inserts at a slot index and appends by default', () => {
		const registry = registryOf([['bottom', ['a', 'b']]]);
		expect(insertIntoZone(registry, 'c', 'bottom', 1).bottom.panels).toEqual(['a', 'c', 'b']);
		expect(insertIntoZone(registry, 'c', 'bottom').bottom.panels).toEqual(['a', 'b', 'c']);
	});

	it('removes a panel from every zone', () => {
		const registry = removeFromZones(registryOf([['right', ['main']]]), 'main');
		expect(findDockedSide(registry, 'main')).toBeNull();
	});
});

describe('allowed docks', () => {
	it('gives each kind of window its own zones', () => {
		expect(allowedDockSides(TOOLBAR_PANEL_ID)).toEqual(['top', 'bottom']);
		expect(allowedDockSides(MAIN_PANEL_ID)).toEqual(['left', 'right']);
		expect(allowedDockSides('console')).toEqual(['single']);
	});
});

describe('placeInDock', () => {
	it('refuses a zone the window cannot use', () => {
		const registry = registryOf([['top', [TOOLBAR_PANEL_ID], 40]]);
		expect(placeInDock(registry, TOOLBAR_PANEL_ID, 'left').registry).toBe(registry);
		expect(placeInDock(registry, MAIN_PANEL_ID, 'top').registry).toBe(registry);
		expect(placeInDock(registry, 'console', 'left').registry).toBe(registry);
	});

	it('releases a bottom toolbar when a section takes the band', () => {
		const registry = registryOf([
			['bottom', [TOOLBAR_PANEL_ID], 40],
			['right', [MAIN_PANEL_ID], 300],
		]);
		const placement = placeInDock(registry, 'console', 'single');
		expect(placement.evicted).toEqual([TOOLBAR_PANEL_ID]);
		expect(findDockedSide(placement.registry, TOOLBAR_PANEL_ID)).toBeNull();
		expect(placement.registry.single.panels).toEqual(['console']);
		expect(findDockedSide(placement.registry, MAIN_PANEL_ID)).toBe('right');
		expect(placement.registry.bottom.thickness).toBe(40);
	});

	it('stacks the toolbar under the band when it is docked back to the bottom', () => {
		const released = placeInDock(
			registryOf([['bottom', [TOOLBAR_PANEL_ID], 40]]),
			'console',
			'single'
		);
		const stacked = placeInDock(released.registry, TOOLBAR_PANEL_ID, 'bottom');
		expect(stacked.evicted).toEqual([]);
		expect(findDockedSide(stacked.registry, TOOLBAR_PANEL_ID)).toBe('bottom');
		expect(findDockedSide(stacked.registry, 'console')).toBe('single');

		const layout = computeDockLayout(stacked.registry, viewport);
		expect(layout.console).toEqual({ x: 0, y: 560, width: 1000, height: 200 });
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({ x: 0, y: 760, width: 1000, height: 40 });
	});

	it('replaces the section already in the band', () => {
		const registry = registryOf([['single', ['console'], 200]]);
		const placement = placeInDock(registry, 'entities', 'single');
		expect(placement.evicted).toEqual(['console']);
		expect(placement.registry.single.panels).toEqual(['entities']);
		expect(placement.registry.single.thickness).toBe(200);
		expect(findDockedSide(placement.registry, 'console')).toBeNull();
	});

	it('leaves the registry untouched when the window is already alone there', () => {
		const registry = registryOf([['bottom', [TOOLBAR_PANEL_ID], 40]]);
		const placement = placeInDock(registry, TOOLBAR_PANEL_ID, 'bottom');
		expect(placement.registry).toBe(registry);
		expect(placement.evicted).toEqual([]);
	});

	it('does not release the band when the toolbar moves to the top', () => {
		const registry = registryOf([
			['bottom', [TOOLBAR_PANEL_ID], 40],
			['single', ['console'], 200],
		]);
		const placement = placeInDock(registry, TOOLBAR_PANEL_ID, 'top');
		expect(placement.evicted).toEqual([]);
		expect(findDockedSide(placement.registry, 'console')).toBe('single');
		expect(findDockedSide(placement.registry, TOOLBAR_PANEL_ID)).toBe('top');
	});
});

describe('thickness', () => {
	it('falls back to a viewport quarter until the user sizes a zone', () => {
		const registry = registryOf([
			['left', ['main']],
			['single', ['console']],
		]);
		expect(resolveThickness(registry, 'left', viewport)).toBe(250);
		expect(resolveThickness(registry, 'single', viewport)).toBe(200);
	});

	it('is zero for an empty zone, so it insets nothing', () => {
		expect(resolveThickness(createEmptyDockRegistry(), 'left', viewport)).toBe(0);
		expect(resolveThickness(createEmptyDockRegistry(), 'single', viewport)).toBe(0);
	});

	it('honours an explicit thickness', () => {
		const registry = registryOf([['left', ['main'], 400]]);
		expect(resolveThickness(registry, 'left', viewport)).toBe(400);
	});

	it('floors a resize at the occupant minimum', () => {
		const registry = registryOf([['left', ['main']]]);
		expect(clampThickness(registry, 'left', 100, viewport, 300)).toBe(300);
	});

	it('leaves free space beside an opposing dock', () => {
		const registry = registryOf([
			['left', ['main']],
			['right', ['console'], 250],
		]);
		expect(clampThickness(registry, 'left', 900, viewport, 300)).toBe(
			viewport.width - 250 - MIN_FREE_SPACE
		);
	});

	it('leaves free space between the single band and the horizontal docks', () => {
		const registry = registryOf([
			['top', ['strip'], 40],
			['bottom', [TOOLBAR_PANEL_ID], 40],
			['single', ['console'], 100],
		]);
		expect(clampThickness(registry, 'single', 900, viewport, 100)).toBe(
			viewport.height - 40 - 40 - MIN_FREE_SPACE
		);
	});
});

describe('computeDockLayout', () => {
	it('gives a left dock the full viewport height', () => {
		const layout = computeDockLayout(registryOf([['left', ['main']]]), viewport);
		expect(layout.main).toEqual({ x: 0, y: 0, width: 250, height: 800 });
	});

	it('pins a right dock to the right edge', () => {
		const layout = computeDockLayout(registryOf([['right', ['main'], 300]]), viewport);
		expect(layout.main).toEqual({ x: 700, y: 0, width: 300, height: 800 });
	});

	it('spans the full width when the toolbar is the bottom dock', () => {
		const layout = computeDockLayout(registryOf([['bottom', [TOOLBAR_PANEL_ID], 40]]), viewport);
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({ x: 0, y: 760, width: 1000, height: 40 });
	});

	it('lifts a left dock above a bottom toolbar', () => {
		const registry = registryOf([
			['left', ['main']],
			['bottom', [TOOLBAR_PANEL_ID], 40],
		]);
		const layout = computeDockLayout(registry, viewport);
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({ x: 0, y: 760, width: 1000, height: 40 });
		expect(layout.main).toEqual({ x: 0, y: 0, width: 250, height: 760 });
	});

	it('insets a side dock under a top toolbar and above the single band', () => {
		const registry = registryOf([
			['top', [TOOLBAR_PANEL_ID], 40],
			['right', ['main'], 300],
			['single', ['console'], 200],
		]);
		const layout = computeDockLayout(registry, viewport);
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({ x: 0, y: 0, width: 1000, height: 40 });
		expect(layout.console).toEqual({ x: 0, y: 600, width: 1000, height: 200 });
		expect(layout.main).toEqual({ x: 700, y: 40, width: 300, height: 560 });
	});

	it('stacks the single band above a bottom toolbar', () => {
		const registry = registryOf([
			['bottom', [TOOLBAR_PANEL_ID], 40],
			['single', ['console'], 200],
			['left', ['main'], 250],
		]);
		const layout = computeDockLayout(registry, viewport);
		expect(layout.console).toEqual({ x: 0, y: 560, width: 1000, height: 200 });
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({ x: 0, y: 760, width: 1000, height: 40 });
		expect(layout.main).toEqual({ x: 0, y: 0, width: 250, height: 560 });
	});

	it('lays out only the first window when a zone has extras', () => {
		const layout = computeDockLayout(registryOf([['left', ['main', 'console'], 200]]), viewport);
		expect(layout.main).toEqual({ x: 0, y: 0, width: 200, height: 800 });
		expect(layout.console).toBeUndefined();
	});

	it('omits panels that are not docked', () => {
		const layout = computeDockLayout(createEmptyDockRegistry(), viewport);
		expect(layout).toEqual({});
	});

	it('gives a lone toolbar the full top edge and lays the left panel underneath', () => {
		const layout = computeDockLayout(
			registryOf([
				['top', [TOOLBAR_PANEL_ID], 40],
				['left', ['main'], 250],
			]),
			viewport
		);
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({ x: 0, y: 0, width: 1000, height: 40 });
		expect(layout.main).toEqual({ x: 0, y: 40, width: 250, height: 760 });
	});

	it('uses the button-strip fallback when a lone toolbar has no thickness yet', () => {
		const layout = computeDockLayout(registryOf([['top', [TOOLBAR_PANEL_ID]]]), viewport);
		expect(layout[TOOLBAR_PANEL_ID]).toEqual({
			x: 0,
			y: 0,
			width: 1000,
			height: TOOLBAR_STRIP_THICKNESS,
		});
	});
});

describe('dockSlotIndex', () => {
	it('always takes the single slot a zone holds', () => {
		const registry = registryOf([
			['left', ['main'], 250],
			['single', ['console'], 200],
		]);
		expect(dockSlotIndex(createEmptyDockRegistry(), 'single', { x: 500, y: 700 }, viewport)).toBe(
			0
		);
		expect(dockSlotIndex(registry, 'single', { x: 100, y: 700 }, viewport)).toBe(0);
		expect(dockSlotIndex(registry, 'single', { x: 900, y: 700 }, viewport, 'console')).toBe(0);
	});
});

describe('dockSideAtPointer', () => {
	it('offers a zone once the pointer reaches its edge', () => {
		expect(dockSideAtPointer(MAIN_PANEL_ID, { x: 10, y: 400 }, viewport)).toBe('left');
		expect(dockSideAtPointer(MAIN_PANEL_ID, { x: 990, y: 400 }, viewport)).toBe('right');
		expect(dockSideAtPointer(TOOLBAR_PANEL_ID, { x: 500, y: 4 }, viewport)).toBe('top');
		expect(dockSideAtPointer(TOOLBAR_PANEL_ID, { x: 500, y: 796 }, viewport)).toBe('bottom');
	});

	it('reaches the single band through the bottom edge', () => {
		expect(dockSideAtPointer('console', { x: 500, y: 790 }, viewport)).toBe('single');
	});

	it('offers nothing until the pointer is within the threshold', () => {
		const atThreshold = { x: DOCK_EDGE_THRESHOLD, y: 400 };
		const pastThreshold = { x: DOCK_EDGE_THRESHOLD + 1, y: 400 };
		expect(dockSideAtPointer(MAIN_PANEL_ID, atThreshold, viewport)).toBe('left');
		expect(dockSideAtPointer(MAIN_PANEL_ID, pastThreshold, viewport)).toBeNull();
		expect(dockSideAtPointer('console', { x: 500, y: 600 }, viewport)).toBeNull();
	});

	it('ignores edges the window cannot dock to, even in a corner', () => {
		expect(dockSideAtPointer(MAIN_PANEL_ID, { x: 500, y: 2 }, viewport)).toBeNull();
		expect(dockSideAtPointer(MAIN_PANEL_ID, { x: 20, y: 798 }, viewport)).toBe('left');
		expect(dockSideAtPointer(TOOLBAR_PANEL_ID, { x: 2, y: 400 }, viewport)).toBeNull();
	});

	it('still offers the zone when the pointer leaves the viewport', () => {
		expect(dockSideAtPointer(MAIN_PANEL_ID, { x: -40, y: 400 }, viewport)).toBe('left');
		expect(dockSideAtPointer('console', { x: 500, y: 860 }, viewport)).toBe('single');
	});
});

describe('previewDockRect', () => {
	it('shows the band after a bottom toolbar has been released', () => {
		const registry = registryOf([['bottom', [TOOLBAR_PANEL_ID], 40]]);
		expect(previewDockRect(registry, 'console', 'single', 0, viewport)).toEqual({
			x: 0,
			y: 600,
			width: 1000,
			height: 200,
		});
	});

	it('shows the slot under the band when the toolbar returns to the bottom', () => {
		const registry = registryOf([['single', ['console'], 200]]);
		expect(previewDockRect(registry, TOOLBAR_PANEL_ID, 'bottom', 0, viewport)).toEqual({
			x: 0,
			y: 760,
			width: 1000,
			height: TOOLBAR_STRIP_THICKNESS,
		});
	});

	it('does not mutate the registry it previews', () => {
		const registry = registryOf([['bottom', [TOOLBAR_PANEL_ID], 40]]);
		previewDockRect(registry, 'console', 'single', 0, viewport);
		expect(findDockedSide(registry, 'console')).toBeNull();
		expect(findDockedSide(registry, TOOLBAR_PANEL_ID)).toBe('bottom');
	});

	it('has no rect for an illegal drop', () => {
		const registry = createEmptyDockRegistry();
		expect(previewDockRect(registry, TOOLBAR_PANEL_ID, 'left', 0, viewport)).toBeNull();
	});
});

describe('innerEdgeFor', () => {
	it('maps each side to the edge it exposes to the viewport', () => {
		expect(innerEdgeFor('left')).toBe('e');
		expect(innerEdgeFor('right')).toBe('w');
		expect(innerEdgeFor('top')).toBe('s');
		expect(innerEdgeFor('bottom')).toBe('n');
		expect(innerEdgeFor('single')).toBe('n');
	});
});

describe('normalizeDockRegistry', () => {
	it('returns empty zones for junk input', () => {
		expect(normalizeDockRegistry(undefined)).toEqual(createEmptyDockRegistry());
		expect(normalizeDockRegistry('nonsense')).toEqual(createEmptyDockRegistry());
	});

	it('keeps a panel in only the first zone that claims it', () => {
		const registry = normalizeDockRegistry({
			left: { panels: ['main'], thickness: 300 },
			bottom: { panels: ['main', 'console'], thickness: 180 },
		});
		expect(registry.left.panels).toEqual(['main']);
		expect(registry.left.thickness).toBe(300);
		expect(registry.bottom.panels).toEqual([]);
		expect(registry.single.panels).toEqual(['console']);
		expect(registry.single.thickness).toBe(180);
	});

	it('drops non-string ids and invalid thicknesses', () => {
		const registry = normalizeDockRegistry({
			top: { panels: ['console', 42, null, ''], thickness: Number.NaN },
		});
		expect(registry.single.panels).toEqual(['console']);
		expect(registry.top.panels).toEqual([]);
		expect(registry.single.thickness).toBe(0);
	});

	it('moves a side toolbar to the top and the main panel off the band', () => {
		const registry = normalizeDockRegistry({
			left: { panels: [TOOLBAR_PANEL_ID], thickness: 40 },
			single: { panels: [MAIN_PANEL_ID], thickness: 200 },
		});
		expect(registry.top.panels).toEqual([TOOLBAR_PANEL_ID]);
		expect(registry.top.thickness).toBe(0);
		expect(registry.left.panels).toEqual([]);
		expect(registry.right.panels).toEqual([MAIN_PANEL_ID]);
		expect(registry.single.panels).toEqual([]);
	});

	it('moves a bottom section into the band and keeps its height', () => {
		const registry = normalizeDockRegistry({
			top: { panels: [TOOLBAR_PANEL_ID], thickness: 40 },
			bottom: { panels: ['console'], thickness: 220 },
		});
		expect(registry.top.panels).toEqual([TOOLBAR_PANEL_ID]);
		expect(registry.top.thickness).toBe(40);
		expect(registry.bottom.panels).toEqual([]);
		expect(registry.single).toEqual({ panels: ['console'], thickness: 220 });
	});

	it('keeps a saved bottom toolbar stacked with a section', () => {
		const registry = normalizeDockRegistry({
			bottom: { panels: [TOOLBAR_PANEL_ID], thickness: 40 },
			single: { panels: ['console'], thickness: 200 },
		});
		expect(registry.bottom).toEqual({ panels: [TOOLBAR_PANEL_ID], thickness: 40 });
		expect(registry.single).toEqual({ panels: ['console'], thickness: 200 });
	});

	it('splits a shared bottom edge into a stack instead of releasing the toolbar', () => {
		const registry = normalizeDockRegistry({
			bottom: { panels: [TOOLBAR_PANEL_ID, 'console'], thickness: 180 },
		});
		expect(registry.bottom.panels).toEqual([TOOLBAR_PANEL_ID]);
		expect(registry.bottom.thickness).toBe(180);
		expect(registry.single).toEqual({ panels: ['console'], thickness: 180 });
	});

	it('floats every section after the one that owns the band', () => {
		const registry = normalizeDockRegistry({
			single: { panels: ['console'], thickness: 200 },
			left: { panels: ['entities'] },
		});
		expect(registry.single.panels).toEqual(['console']);
		expect(findDockedSide(registry, 'entities')).toBeNull();
	});
});
