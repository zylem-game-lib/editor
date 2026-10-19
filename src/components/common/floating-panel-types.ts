import type { Accessor, JSX } from 'solid-js';
import type { DockPanelId, DockSide } from './dock-layout';

/** An imperative dock command; the nonce lets the same side be re-sent. */
export interface DockRequest {
	side: DockSide | null;
	nonce: number;
	/** Which window should take the command. Omit it to mean the panel container. */
	panelId?: DockPanelId;
}

export interface FloatingPanelBody {
	isCollapsed: Accessor<boolean>;
	dockedSide: Accessor<DockSide | null>;
	onDock: (side: DockSide) => void;
}

export interface FloatingPanelProps {
	/** Registry id. Defaults to the panel container. */
	panelId?: DockPanelId;
	title?: string;
	/** Accessible name for the window. Falls back to `title`. */
	label?: string;
	/** Header is the controls only. */
	hideTitle?: boolean;
	/**
	 * `bar` keeps a titlebar above the body. `inline` puts the controls in
	 * the same row as the body, which is how the toolbar is one strip.
	 */
	chrome?: 'bar' | 'inline';
	/** Dragging edges resizes the window. The toolbar opts out. */
	resizable?: boolean;
	/**
	 * While this window is the only panel on its edge, write the chrome's
	 * cross-axis size into that zone. The toolbar uses this so the strip
	 * stays as tall as its buttons.
	 */
	fitDockThickness?: boolean;
	initialPosition?: { x: number; y: number };
	initialSize?: { width: number; height: number };
	/**
	 * Size the panel should restore to when it floats. `initialSize` can be a
	 * docked rect when the panel mounts docked, so it must not seed the
	 * floating-size memory.
	 */
	floatingSize?: { width: number; height: number };
	minSize?: { width: number; height: number };
	/** Floating window wraps its content instead of keeping a stored box. */
	hugContent?: boolean;
	collapsible?: boolean;
	/** Controlled collapse. Omit it and the window remembers its own. */
	collapsed?: boolean;
	onCollapsedChange?: (collapsed: boolean) => void;
	onClose?: () => void;
	/** Brings the other editor window back. Shown only when that window is closed. */
	onRestoreSibling?: (() => void) | undefined;
	restoreSiblingLabel?: string | undefined;
	/** Icon for the restore control. The label stays the tooltip and accessible name. */
	restoreSiblingIcon?: JSX.Element | undefined;
	onMove?: (position: { x: number; y: number }) => void;
	onResize?: (size: { width: number; height: number }) => void;
	dockRequest?: Accessor<DockRequest | null>;
	children: JSX.Element | ((body: FloatingPanelBody) => JSX.Element);
}
