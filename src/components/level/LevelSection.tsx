import { type Component, createSignal, For, Show } from 'solid-js';
import { debugStore } from '../editor-store';
import { type LevelAnnotation, levelStore, setActorProp } from './level-state';

function roleLabel(note: LevelAnnotation | undefined): string {
	if (note?.role === 'actor') return 'Actor';
	if (note?.role === 'level') return 'Level · bake';
	return 'Doodad';
}

/**
 * Recorded level buffer. Actor fields live on the selected actor row; they are
 * not a separate panel, and editing them does not send a new bridge message.
 */
export const LevelSection: Component = () => {
	const entries = () => levelStore.buffer?.entries ?? [];
	const selectedId = () => debugStore.selected[0] ?? null;

	return (
		<div class="panel-content">
			<Show
				when={entries().length > 0}
				fallback={<p class="zylem-transform-empty">Nothing recorded yet.</p>}
			>
				<ul class="zylem-level-list">
					<For each={entries()}>
						{(entry) => {
							const note = () => levelStore.annotations[entry.id];
							const selected = () => selectedId() === entry.id;
							return (
								<li class="zylem-level-row" classList={{ 'is-selected': selected() }}>
									<span class="zylem-level-row__type">{entry.typeId}</span>
									<span class="zylem-level-row__role">{roleLabel(note())}</span>
									<Show when={selected() && note()?.role === 'actor'}>
										<ActorProps id={entry.id} fields={note()?.props ?? {}} />
									</Show>
								</li>
							);
						}}
					</For>
				</ul>
			</Show>
		</div>
	);
};

const ActorProps: Component<{ id: string; fields: Record<string, string> }> = (props) => {
	const [draftKey, setDraftKey] = createSignal('');
	const [draftValue, setDraftValue] = createSignal('');
	const rows = () => Object.entries(props.fields);

	const add = () => {
		const key = draftKey().trim();
		if (!key) return;
		setActorProp(props.id, key, draftValue());
		setDraftKey('');
		setDraftValue('');
	};

	return (
		<div class="zylem-level-props">
			<For each={rows()}>
				{([key, value]) => (
					<label class="zylem-level-props__row">
						<span>{key}</span>
						<input
							class="zylem-transform-row__field"
							value={value}
							onInput={(event) => setActorProp(props.id, key, event.currentTarget.value)}
						/>
					</label>
				)}
			</For>
			<div class="zylem-level-props__row">
				<input
					class="zylem-transform-row__field"
					placeholder="Key"
					value={draftKey()}
					onInput={(event) => setDraftKey(event.currentTarget.value)}
				/>
				<input
					class="zylem-transform-row__field"
					placeholder="Value"
					value={draftValue()}
					onInput={(event) => setDraftValue(event.currentTarget.value)}
				/>
				<button type="button" class="zylem-level-props__add" onClick={add}>
					Add
				</button>
			</div>
		</div>
	);
};
