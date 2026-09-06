import type { LucideProps } from 'lucide-solid';
import { type Component, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';

interface IconProps extends LucideProps {
	icon: Component<LucideProps>;
}

export const Icon: Component<IconProps> = (props) => {
	const [local, others] = splitProps(props, ['icon', 'class']);

	return <Dynamic component={local.icon} class={`text-current ${local.class || ''}`} {...others} />;
};
