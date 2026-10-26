/**
 * Mode gear for the dev harness.
 *
 * It sits outside `<zylem-editor>` and tells that element which mode to apply.
 */

import { HARNESS_MODES, type HarnessModeId } from './harness-modes';

export interface HarnessGear {
	/** Mark a mode selected. Does not apply it. */
	setMode(id: HarnessModeId): void;
}

const GEAR_STYLE = `
.harness-mode {
	position: fixed;
	left: 12px;
	bottom: 16px;
	z-index: 40;
	pointer-events: auto;
	font: 13px/1.3 system-ui, sans-serif;
	color: #e8eef6;
}
.harness-mode__gear {
	display: grid;
	place-items: center;
	width: 36px;
	height: 36px;
	padding: 0;
	border: 1px solid rgba(255, 255, 255, 0.16);
	border-radius: 8px;
	background: #1c2430;
	color: inherit;
	cursor: pointer;
}
.harness-mode__gear:hover,
.harness-mode__gear[aria-expanded='true'] {
	background: #283444;
}
.harness-mode__menu {
	position: absolute;
	left: 0;
	bottom: 44px;
	display: flex;
	flex-direction: column;
	min-width: 180px;
	margin: 0;
	padding: 4px;
	list-style: none;
	border: 1px solid rgba(255, 255, 255, 0.16);
	border-radius: 8px;
	background: #1c2430;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.harness-mode__menu[hidden] {
	display: none;
}
.harness-mode__item {
	padding: 6px 10px;
	border: 0;
	border-radius: 6px;
	background: transparent;
	color: inherit;
	text-align: left;
	cursor: pointer;
}
.harness-mode__item:hover {
	background: rgba(255, 255, 255, 0.08);
}
.harness-mode__item[aria-checked='true'] {
	background: rgba(61, 214, 140, 0.16);
}
`;

const GEAR_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

/**
 * Mount the settings gear. `apply` runs when a mode is chosen.
 */
export function mountHarnessGear(
	parent: HTMLElement,
	options: { initial: HarnessModeId; apply: (id: HarnessModeId) => void }
): HarnessGear {
	const style = document.createElement('style');
	style.textContent = GEAR_STYLE;
	document.head.appendChild(style);

	const root = document.createElement('div');
	root.className = 'harness-mode';

	const gear = document.createElement('button');
	gear.type = 'button';
	gear.className = 'harness-mode__gear';
	gear.setAttribute('aria-label', 'Editor mode');
	gear.setAttribute('aria-haspopup', 'menu');
	gear.setAttribute('aria-expanded', 'false');
	gear.innerHTML = GEAR_SVG;

	const menu = document.createElement('div');
	menu.className = 'harness-mode__menu';
	menu.setAttribute('role', 'menu');
	menu.hidden = true;

	const items = new Map<HarnessModeId, HTMLButtonElement>();
	for (const mode of HARNESS_MODES) {
		const item = document.createElement('button');
		item.type = 'button';
		item.className = 'harness-mode__item';
		item.setAttribute('role', 'menuitemradio');
		item.textContent = mode.label;
		item.addEventListener('click', () => {
			options.apply(mode.id);
			setMode(mode.id);
			closeMenu();
		});
		items.set(mode.id, item);
		menu.appendChild(item);
	}

	function setMode(id: HarnessModeId) {
		for (const [modeId, item] of items) {
			item.setAttribute('aria-checked', modeId === id ? 'true' : 'false');
		}
		const label = HARNESS_MODES.find((mode) => mode.id === id)?.label ?? 'Editor mode';
		gear.setAttribute('aria-label', `Editor mode: ${label}`);
	}

	function closeMenu() {
		menu.hidden = true;
		gear.setAttribute('aria-expanded', 'false');
	}

	gear.addEventListener('click', () => {
		const open = menu.hidden;
		menu.hidden = !open;
		gear.setAttribute('aria-expanded', open ? 'true' : 'false');
	});

	document.addEventListener('pointerdown', (event) => {
		if (!root.contains(event.target as Node)) closeMenu();
	});

	setMode(options.initial);
	root.append(gear, menu);
	parent.appendChild(root);
	return { setMode };
}
