import type { Component, JSX } from 'solid-js';
import type { ResizeDirection } from './panel-pointer';

export interface PanelResizeHandlesProps {
	onResizePointerDown: (direction: ResizeDirection) => (event: PointerEvent) => void;
}

const resizeHandleStyle = (cursor: string): JSX.CSSProperties => ({
	position: 'absolute',
	'z-index': 10,
	cursor,
	'touch-action': 'none',
});

/** Edge and corner handles. Hidden by the toolbar, which does not resize. */
export const PanelResizeHandles: Component<PanelResizeHandlesProps> = (props) => {
	return (
		<>
			<div
				style={{
					...resizeHandleStyle('ns-resize'),
					top: 0,
					left: '10px',
					right: '10px',
					height: '6px',
				}}
				onPointerDown={props.onResizePointerDown('n')}
			/>
			<div
				style={{
					...resizeHandleStyle('ns-resize'),
					bottom: 0,
					left: '10px',
					right: '10px',
					height: '6px',
				}}
				onPointerDown={props.onResizePointerDown('s')}
			/>
			<div
				style={{
					...resizeHandleStyle('ew-resize'),
					left: 0,
					top: '10px',
					bottom: '10px',
					width: '6px',
				}}
				onPointerDown={props.onResizePointerDown('w')}
			/>
			<div
				style={{
					...resizeHandleStyle('ew-resize'),
					right: 0,
					top: '10px',
					bottom: '10px',
					width: '6px',
				}}
				onPointerDown={props.onResizePointerDown('e')}
			/>
			<div
				style={{
					...resizeHandleStyle('nwse-resize'),
					top: 0,
					left: 0,
					width: '10px',
					height: '10px',
				}}
				onPointerDown={props.onResizePointerDown('nw')}
			/>
			<div
				style={{
					...resizeHandleStyle('nesw-resize'),
					top: 0,
					right: 0,
					width: '10px',
					height: '10px',
				}}
				onPointerDown={props.onResizePointerDown('ne')}
			/>
			<div
				style={{
					...resizeHandleStyle('nesw-resize'),
					bottom: 0,
					left: 0,
					width: '10px',
					height: '10px',
				}}
				onPointerDown={props.onResizePointerDown('sw')}
			/>
			<div
				style={{
					...resizeHandleStyle('nwse-resize'),
					bottom: 0,
					right: 0,
					width: '10px',
					height: '10px',
				}}
				onPointerDown={props.onResizePointerDown('se')}
			/>
		</>
	);
};
