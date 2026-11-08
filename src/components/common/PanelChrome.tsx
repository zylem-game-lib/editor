import { Tooltip, WindowControls } from '@zylem/ui/components';
import { type Accessor, type Component, type JSX, Show } from 'solid-js';
import type { DockPanelId, DockSide } from './dock-layout';
import { dockSideFromWindow, toWindowDock, windowDockOptions } from './window-dock';

export interface PanelChromeProps {
	chrome: 'bar' | 'inline';
	title?: string | undefined;
	hideTitle?: boolean | undefined;
	dockedSide: Accessor<DockSide | null>;
	isCollapsed: Accessor<boolean>;
	onCollapse?: (() => void) | undefined;
	onClose?: (() => void) | undefined;
	onRestoreSibling?: (() => void) | undefined;
	restoreSiblingLabel?: string | undefined;
	restoreSiblingIcon?: JSX.Element | undefined;
	onDock: (side: DockSide | null) => void;
	/** Registry id, so the dock switch only offers zones this window can use. */
	panelId: DockPanelId;
	onTitlePointerDown: (event: PointerEvent) => void;
	onChromeRef?: ((element: HTMLDivElement) => void) | undefined;
	body: () => JSX.Element;
}

/** Title bar or inline strip, including the window controls. */
export const PanelChrome: Component<PanelChromeProps> = (props) => {
	// Free, the toolbar is two columns. A top or bottom dock stays one row.
	const stacked = () => props.chrome === 'inline' && props.dockedSide() === null;

	const headerControls = () => (
		<div
			class="floating-panel-controls"
			// Free mode uses this block as the grab header. Buttons still
			// decline the drag. A docked strip keeps the whole cluster still.
			data-no-drag={stacked() ? undefined : ''}
		>
			<Show when={props.onRestoreSibling !== undefined}>
				<span style={{ display: 'inline-flex', flex: 'none' }}>
					<Tooltip content={props.restoreSiblingLabel ?? ''} placement="bottom">
						<button
							type="button"
							class="zylem-window-control"
							data-testid="restore-sibling"
							aria-label={props.restoreSiblingLabel}
							style={
								props.restoreSiblingIcon ? undefined : { 'white-space': 'nowrap', width: 'auto' }
							}
							onClick={() => props.onRestoreSibling?.()}
						>
							{props.restoreSiblingIcon ?? props.restoreSiblingLabel}
						</button>
					</Tooltip>
				</span>
			</Show>
			<WindowControls
				dock={toWindowDock(props.dockedSide())}
				dockOptions={windowDockOptions(props.panelId)}
				onDock={(position) => {
					const side = dockSideFromWindow(props.panelId, position);
					if (position !== 'float' && side === null) return;
					props.onDock(side);
				}}
				collapsed={props.isCollapsed()}
				onCollapse={props.onCollapse}
				onClose={props.onClose}
				closeTestId="floating-panel-close"
			/>
		</div>
	);

	return (
		<Show
			when={props.chrome === 'inline'}
			fallback={
				<>
					<div
						class="floating-panel-titlebar"
						style={{
							cursor: 'grab',
							display: 'flex',
							'align-items': 'center',
							'justify-content': props.hideTitle ? 'flex-start' : 'space-between',
							'user-select': 'none',
							'touch-action': 'none',
							'border-radius': props.dockedSide() ? '0' : undefined,
						}}
						onPointerDown={props.onTitlePointerDown}
					>
						<Show when={!props.hideTitle}>
							<span class="floating-panel-title">{props.title ?? 'Panel'}</span>
						</Show>
						{headerControls()}
					</div>
					<div
						class="floating-panel-content"
						style={{
							flex: 1,
							overflow: 'hidden',
							display: 'flex',
							'flex-direction': 'column',
						}}
					>
						{props.body()}
					</div>
				</>
			}
		>
			<div
				ref={(element) => props.onChromeRef?.(element)}
				class="zylem-chrome-inline"
				classList={{ 'zylem-chrome-inline--column': stacked() }}
				style={{
					// A docked top or bottom strip stretches so the controls sit
					// on the far end. Free, the grid hugs the buttons.
					width: !stacked() && props.dockedSide() ? '100%' : 'max-content',
				}}
				onPointerDown={props.onTitlePointerDown}
			>
				<Show when={stacked()}>{headerControls()}</Show>
				<Show when={!props.isCollapsed()}>{props.body()}</Show>
				<Show when={!stacked()}>{headerControls()}</Show>
			</div>
		</Show>
	);
};
