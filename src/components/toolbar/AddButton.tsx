import { ItemPicker, MenuButton } from '@zylem/ui/components';
import Plus from 'lucide-solid/icons/plus';
import { type Component, createMemo, createSignal, onCleanup, Show } from 'solid-js';
import { debugStore } from '..';
import { isAddArmed, resolvePlacementTarget, toPickerItems } from './add-button-state';
import { catalogStore } from './catalog-state';
import { armAddTool, armAddType, registerAddPaletteOpener } from './toolbar-actions';
import { withShortcut } from './toolbar-shortcuts';

/**
 * The Add tool: a palette of entity types plus an armed placement mode.
 *
 * Split interaction, because choosing what to place and placing it are separate
 * jobs. The chevron half opens the palette; the button face toggles the armed
 * state for whatever is already chosen, so placing ten boxes is one pick and ten
 * clicks rather than ten trips through the menu.
 *
 * The palette's entries are game-owned — they arrive as `catalog:snapshot` — so a
 * host that registers its own entity types game-side gets them here for free.
 */
export const AddButton: Component = () => {
	const isArmed = () => isAddArmed(debugStore.tool, catalogStore.armedTypeId);

	/** What the face shows and what a press places. */
	const target = createMemo(() =>
		resolvePlacementTarget(catalogStore.entities, catalogStore.armedTypeId, catalogStore.lastTypeId)
	);

	const items = createMemo(() => toPickerItems(catalogStore.entities));

	const faceLabel = () => {
		const descriptor = target();
		return descriptor ? `Place ${descriptor.label}` : 'Add';
	};

	// Controlled, so the Shift+A shortcut can open it while this button is
	// mounted. Declines when the button is disabled, to match a click.
	const [paletteOpen, setPaletteOpen] = createSignal(false);
	onCleanup(
		registerAddPaletteOpener(() => {
			if (catalogStore.entities.length === 0) return false;
			setPaletteOpen(true);
			return true;
		})
	);

	return (
		<div class="zylem-add-tool">
			<MenuButton
				label={faceLabel()}
				tooltip={`${withShortcut(faceLabel(), 'add')} · ${withShortcut('Palette', 'addPalette')}`}
				selected={isArmed()}
				// An empty catalog is the one case with nothing to arm. Disabled
				// rather than silently inert, so a press that cannot work looks
				// like one; the game publishes its catalog on connect, so this is
				// only ever the no-game state.
				disabled={catalogStore.entities.length === 0}
				onAction={armAddTool}
				open={paletteOpen()}
				onOpenChange={setPaletteOpen}
				menu={(close) => (
					<ItemPicker
						items={items()}
						selectedId={catalogStore.armedTypeId}
						searchPlaceholder="Search entities…"
						emptyMessage="No entity types published. Is a game running?"
						onSelect={(item) => {
							armAddType(item.id);
							close();
						}}
					/>
				)}
			>
				{/* Follows `target`, not `current`, so the glyph, the label and what
				    a press actually places all agree before the first pick. */}
				<Show when={target()?.icon} fallback={<Plus class="zylem-icon" />}>
					{(icon) => <span class="zylem-add-tool__glyph" innerHTML={icon()} />}
				</Show>
			</MenuButton>
		</div>
	);
};
