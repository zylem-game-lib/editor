import { Tooltip, WindowControls } from '@zylem/ui/components';
import { type Accessor, type Component, type JSX, Show } from 'solid-js';
import { DockMenu } from './DockMenu';
import type { DockSide } from './dock-layout';

export interface PanelChromeProps {
	chrome: 'bar' | 'inline';
	title?: string | undefined;
	hideTitle?: boolean | undefined;
	dockedSide: Accessor<DockSide | null>;
	isMoving: Accessor<boolean>;
	isCollapsed: Accessor<boolean>;
	onCollapse?: (() => void) | undefined;
	onClose?: (() => void) | undefined;
	onRestoreSibling?: (() => void) | undefined;
	restoreSiblingLabel?: string | undefined;
	restoreSiblingIcon?: JSX.Element | undefined;
	onDock: (side: DockSide) => void;
	/** When false, the dock control is rendered by the body (the toolbar). */
	dockInChrome?: boolean;
	onTitlePointerDown: (event: PointerEvent) => void;
	onChromeRef?: ((element: HTMLDivElement) => void) | undefined;
	body: () => JSX.Element;
}

/** Title bar or inline strip, including the window controls. */
export const PanelChrome: Component<PanelChromeProps> = (props) => {
	const stacked = () => {
		const side = props.dockedSide();
		return side === 'left' || side === 'right';
	};

	const headerControls = () => (
		<div class="floating-panel-controls" data-no-drag>
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
			<Show when={props.dockInChrome !== false}>
				<DockMenu dockedSide={props.dockedSide} onDock={props.onDock} />
			</Show>
			<WindowControls
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
							visibility: props.isMoving() ? 'hidden' : undefined,
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
							visibility: props.isMoving() ? 'hidden' : undefined,
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
					// on the far end. Floating and side docks hug the buttons.
					width: !stacked() && props.dockedSide() ? '100%' : 'max-content',
					visibility: props.isMoving() ? 'hidden' : undefined,
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
