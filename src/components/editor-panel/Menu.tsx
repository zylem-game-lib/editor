import { type Accessor, type Component, Show } from 'solid-js';
import { AccordionMenu } from './AccordionMenu';

interface MenuProps {
	isCollapsed: Accessor<boolean>;
}

/** Accordion of every section. The toolbar is its own window. */
export const Menu: Component<MenuProps> = (props) => {
	return (
		<Show when={!props.isCollapsed()}>
			<div class="zylem-menu">
				<AccordionMenu />
			</div>
		</Show>
	);
};
