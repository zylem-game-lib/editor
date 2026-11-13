/**
 * Local styles for the toolbar and the transform inspector.
 * Injected alongside @zylem/ui styles in the editor web component.
 *
 * The Add tool's split button and palette are `MenuButton` and `ItemPicker` from
 * @zylem/ui now, so only the glyph sizing for game-supplied icons is left here.
 */
export const addPaletteCSS = `
/*
 * The toolbar is its own window: one row on a top or bottom dock. Free, a
 * grab header of window controls sits above two columns of tool buttons.
 */
.zylem-toolbar {
	flex-wrap: nowrap;
	width: max-content;
	max-width: 100%;
}

/*
 * Rules between tool groups are Separator from @zylem/ui. On the strip they
 * take the mode's own separator colour and sit closer to the buttons.
 */
.zylem-toolbar .zylem-separator {
	flex-shrink: 0;
	background: var(--zylem-toolbar-separator);
}

.zylem-toolbar .zylem-separator[data-orientation="vertical"] {
	margin: 0 2px;
}

.zylem-toolbar .zylem-separator[data-orientation="horizontal"] {
	margin: 2px 0;
}

/* The toolbar window's controls share this row (or column) with the buttons. */
.zylem-chrome-inline {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	box-sizing: border-box;
	width: 100%;
	padding: 4px;
	cursor: grab;
	user-select: none;
	touch-action: none;
	/* Stay at the button row's height while docked, so a collapsed strip can shrink. */
	height: max-content;
	align-self: flex-start;
	/* Keep the measured strip at its content size instead of shrinking into
	   the dock slot, so the zone thickness can grow to match the buttons. */
	flex-shrink: 0;
}

/* Free toolbar: grab header, then a two-column tool grid. */
.zylem-chrome-inline--column {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
	width: max-content;
	max-height: calc(100vh - 24px);
	min-height: 0;
	overflow-x: hidden;
	overflow-y: auto;
	/* Extra vertical room so the buttons clear the rounded window corners,
	   with more space under the last row. */
	padding: 12px 8px 18px;
}

.zylem-chrome-inline:not(.zylem-chrome-inline--column) .floating-panel-controls {
	margin-left: auto;
}

/* The header is the drag handle. Controls sit in one row across the window. */
.zylem-chrome-inline--column .floating-panel-controls {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	align-self: stretch;
	gap: 6px;
	width: 100%;
	margin: 0;
	padding: 2px 0 8px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	cursor: grab;
}

.zylem-chrome-inline--column .floating-panel-controls:active {
	cursor: grabbing;
}

.zylem-chrome-inline--column .zylem-toolbar {
	display: grid;
	grid-template-columns: repeat(2, 34px);
	gap: 0.5rem;
	justify-content: center;
}

.zylem-chrome-inline--column .zylem-toolbar .zylem-separator {
	grid-column: 1 / -1;
}

/* Keeps the gizmo buttons together when the toolbar wraps. */
.zylem-toolbar-transforms {
	display: inline-flex;
	align-items: center;
	gap: inherit;
}

.zylem-add-tool {
	display: inline-flex;
	align-items: stretch;
}

/* Sizes the inline SVG the game's catalog supplies for the armed type. */
.zylem-add-tool__glyph {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: currentColor;
}

.zylem-add-tool__glyph svg {
	width: 18px;
	height: 18px;
}

/* ── Transform inspector ─────────────────────────────────────────────────── */

/*
 * X, Y, and Z stack. Three fields side by side are narrower than a value like
 * -1.50 once the stepper sits inside the input, so each axis takes the row.
 */
.zylem-property-value.zylem-transform-axes {
	display: flex;
	flex-direction: column;
	gap: 4px;
	overflow: visible;
	white-space: normal;
}

.zylem-transform-axis {
	display: grid;
	grid-template-columns: 12px minmax(0, 1fr);
	gap: 4px;
	align-items: center;
	min-width: 0;
}

.zylem-transform-axis > span {
	font-size: 10px;
	font-family: var(--zylem-font-family-mono);
	opacity: 0.65;
}

.zylem-property-value.zylem-transform-axes .zylem-field-root,
.zylem-property-value.zylem-transform-axes .zylem-numberfield-group,
.zylem-property-value.zylem-transform-axes .zylem-numberfield-input {
	width: 100%;
	min-width: 0;
}

.zylem-transform-row__field {
	width: 100%;
	min-width: 0;
	padding: 3px 5px;
	font-family: var(--zylem-font-family-mono);
	font-size: 11px;
	color: #e6edf3;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 4px;
}

.zylem-transform-row__field:focus {
	outline: none;
	border-color: rgba(120, 180, 255, 0.55);
}

.zylem-transform-empty {
	margin: 0;
	padding: 6px 0;
	font-size: 11px;
	opacity: 0.6;
}

.zylem-transform-snap {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	align-items: center;
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	font-size: 11px;
}

.zylem-transform-hint {
	margin: 6px 0 0;
	font-size: 10px;
	line-height: 1.4;
	opacity: 0.5;
}

.zylem-level-settings {
	margin-bottom: 10px;
}

/* Map Navigation: one column of @zylem/ui blocks with even spacing. */
.zylem-navigation {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

/* The panel is narrow, so a tool group's caption sits above its buttons. */
.zylem-navigation .zylem-tool-group {
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
}

/* The dashed card is sized for a page. In the panel it hugs its two lines. */
.zylem-navigation .zylem-empty-state {
	padding: 12px;
}

/* A field fills its value cell, and the cell must not clip the steppers. */
.zylem-property-value.zylem-level-field {
	overflow: visible;
	white-space: normal;
}

.zylem-property-value.zylem-level-field .zylem-field-root,
.zylem-property-value.zylem-level-field .zylem-numberfield-group,
.zylem-property-value.zylem-level-field .zylem-numberfield-input {
	width: 100%;
	min-width: 0;
}

.zylem-level-layer {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-bottom: 10px;
}

.zylem-level-layer__head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
}

.zylem-level-sector {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin-top: 4px;
}

.zylem-level-sector__head {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
}

.zylem-level-sector__name {
	flex: 1;
	min-width: 0;
	opacity: 0.8;
}

.zylem-level-sector__tint {
	flex-shrink: 0;
	width: 10px;
	height: 10px;
	border-radius: 2px;
}

.zylem-level-sector.is-hidden .zylem-level-list {
	opacity: 0.45;
}

.zylem-level-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.zylem-level-row {
	box-sizing: border-box;
	width: 100%;
	margin: 0;
	flex-wrap: wrap;
	gap: 6px 10px;
	align-items: baseline;
	font-size: 11px;
}

.zylem-level-row__role {
	opacity: 0.65;
}

.zylem-level-props {
	flex-basis: 100%;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.zylem-level-props__row {
	display: grid;
	grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr) auto;
	gap: 5px;
	align-items: center;
}

.zylem-level-props__add {
	padding: 3px 8px;
	font-size: 11px;
	color: inherit;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 4px;
	cursor: pointer;
}

/* The property value's own face is declared later than .zylem-mono, so a unit
   readout needs both classes to beat it. */
.zylem-property-value.zylem-mono {
	font-family: var(--zylem-font-family-mono);
}
`;
