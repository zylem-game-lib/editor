import { type Component, onCleanup, onMount } from 'solid-js';

/** The game's debug delegate listens for this and mounts the FPS graph here. */
export const FPS_HOST_EVENT = 'zylem-fps-host';

export interface FpsHostDetail {
	element: HTMLElement | null;
}

/**
 * Mount point for the game's FPS graph.
 * Lives in the main panel, so the graph leaves the page when that panel closes.
 */
export const FpsHost: Component = () => {
	let host: HTMLDivElement | undefined;

	const publish = (element: HTMLElement | null) => {
		window.dispatchEvent(new CustomEvent<FpsHostDetail>(FPS_HOST_EVENT, { detail: { element } }));
	};

	onMount(() => {
		if (host) publish(host);
	});

	onCleanup(() => {
		publish(null);
	});

	return (
		<div
			ref={host}
			data-zylem-fps-host
			style={{ display: 'flex', 'flex-shrink': '0', padding: '8px 8px 0' }}
		/>
	);
};
