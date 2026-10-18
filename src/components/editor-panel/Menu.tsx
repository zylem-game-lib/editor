import { type Accessor, type Component, Show } from 'solid-js';
import { AccordionMenu } from './AccordionMenu';
import { FpsHost } from './FpsHost';

interface MenuProps {
	isCollapsed: Accessor<boolean>;
}

/** Accordion of every section. The toolbar is its own window. */
export const Menu: Component<MenuProps> = (props) => {
	return (
		<Show when={!props.isCollapsed()}>
			<div class="zylem-menu">
				<FpsHost />
				<AccordionMenu />
			</div>
		</Show>
	);
};
