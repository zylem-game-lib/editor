import { BUILTIN_TEXTURES } from '@zylem/bridge';
import {
	AddTile,
	Button,
	Callout,
	FrameStrip,
	FrameThumb,
	NumberField,
	PropertyList,
	ToolGroup,
} from '@zylem/ui/components';
import { type Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { PropertyRow } from '../common/PropertyRow';
import { debugStore } from '../editor-store';
import { levelStore } from '../level/level-state';
import { togglePaintTool } from '../toolbar/toolbar-actions';
import { builtinTextureUrl, loadImage, TEXTURE_FILE_TYPES, textureUrl } from './texture-image';
import {
	applyBrushToSelection,
	brushTextureId,
	clearSelectionTexture,
	importTextureFile,
	isUploadedTexture,
	MIN_TILE,
	PREVIEW_UNITS,
	type PreviewTransform,
	previewTransform,
	removeTexture,
	setBrushOffset,
	setBrushRotation,
	setBrushScale,
	setBrushTexture,
	texturingStore,
} from './texturing-state';

/** The preview canvas, in backing pixels a side. CSS sizes it to the panel. */
const PREVIEW_SIZE = 256;

/** Images already decoded, so going back to a texture does not blank the preview. */
const decoded = new Map<string, HTMLImageElement>();

function drawPreview(
	canvas: HTMLCanvasElement,
	image: HTMLImageElement | null,
	transform: PreviewTransform
): void {
	const context = canvas.getContext('2d');
	if (!context) return;
	const size = canvas.width;
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, size, size);

	const pattern = image && context.createPattern(image, 'repeat');
	if (image && pattern) {
		// The transform places a unit tile; the pattern's own unit is an image pixel.
		pattern.setTransform(
			new DOMMatrix(transform).scale(1 / image.naturalWidth, 1 / image.naturalHeight)
		);
		context.fillStyle = pattern;
		context.fillRect(0, 0, size, size);
	}

	// One line per world unit: dark with a light edge, so it reads on any texture.
	const step = size / PREVIEW_UNITS;
	for (const [style, shift] of [
		['rgba(6, 14, 26, 0.6)', 0],
		['rgba(232, 244, 255, 0.4)', 1],
	] as const) {
		context.strokeStyle = style;
		context.lineWidth = 1;
		context.beginPath();
		for (let line = 1; line < PREVIEW_UNITS; line += 1) {
			const at = Math.round(line * step) + 0.5 + shift;
			context.moveTo(at, 0);
			context.lineTo(at, size);
			context.moveTo(0, at);
			context.lineTo(size, at);
		}
		context.stroke();
	}
}

/** The brush as a face would show it: the texture tiled over a square of world units. */
const BrushPreview: Component = () => {
	let canvas: HTMLCanvasElement | undefined;
	const url = () =>
		textureUrl(levelStore.document, brushTextureId(texturingStore, levelStore.document));
	const [image, setImage] = createSignal<HTMLImageElement | null>(null);

	createEffect(() => {
		const source = url();
		const ready = source ? decoded.get(source) : undefined;
		setImage(ready ?? null);
		if (!source || ready) return;
		let current = true;
		onCleanup(() => {
			current = false;
		});
		loadImage(source).then(
			(loaded) => {
				decoded.set(source, loaded);
				if (current) setImage(loaded);
			},
			() => {}
		);
	});

	createEffect(() => {
		if (canvas) drawPreview(canvas, image(), previewTransform(texturingStore, PREVIEW_SIZE));
	});

	return (
		<canvas
			ref={canvas}
			class="zylem-texturing-preview"
			width={PREVIEW_SIZE}
			height={PREVIEW_SIZE}
			role="img"
			aria-label={`Brush preview, ${PREVIEW_UNITS} by ${PREVIEW_UNITS} units`}
		/>
	);
};

export const TexturingSection: Component = () => {
	let picker: HTMLInputElement | undefined;
	const brush = () => brushTextureId(texturingStore, levelStore.document);
	const uploads = () => levelStore.document.textures ?? [];
	const armed = () => debugStore.tool === 'paint';
	const hasTarget = () => {
		const faces = levelStore.selectedElements.some((element) => element.kind === 'face');
		if (levelStore.elementMode === 'face' && faces) return true;
		return levelStore.document.solids.some((solid) => levelStore.selectedIds.includes(solid.id));
	};
	const brushName = () => {
		const id = brush();
		if (!id) return 'No texture';
		const builtin = BUILTIN_TEXTURES.find((texture) => texture.id === id);
		return builtin?.label ?? uploads().find((texture) => texture.id === id)?.name ?? id;
	};

	const addFiles = async (files: FileList | null) => {
		for (const file of files ? [...files] : []) await importTextureFile(file);
	};

	return (
		<div class="panel-content zylem-texturing">
			<BrushPreview />
			<p class="zylem-texturing-caption">
				{brushName()} · {PREVIEW_UNITS} × {PREVIEW_UNITS} units
			</p>

			<FrameStrip label="Textures">
				<FrameThumb
					index={1}
					label="No texture"
					selected={brush() === null}
					onClick={() => setBrushTexture(null)}
				/>
				<For each={BUILTIN_TEXTURES}>
					{(texture, index) => (
						<FrameThumb
							index={index() + 2}
							label={texture.label}
							selected={brush() === texture.id}
							onClick={() => setBrushTexture(texture.id)}
						>
							<img src={builtinTextureUrl(texture.key)} alt="" />
						</FrameThumb>
					)}
				</For>
				<For each={uploads()}>
					{(texture, index) => (
						<FrameThumb
							index={index() + BUILTIN_TEXTURES.length + 2}
							label={texture.name}
							selected={brush() === texture.id}
							onClick={() => setBrushTexture(texture.id)}
						>
							<img src={texture.dataUrl} alt="" />
						</FrameThumb>
					)}
				</For>
				<AddTile variant="tall" label="Image" onClick={() => picker?.click()} />
			</FrameStrip>
			<input
				ref={picker}
				type="file"
				accept={TEXTURE_FILE_TYPES}
				multiple
				hidden
				aria-label="Add texture images"
				onChange={(event) => {
					const input = event.currentTarget;
					void addFiles(input.files).then(() => {
						// Cleared so picking the same file again is a change.
						input.value = '';
					});
				}}
			/>
			<Show when={texturingStore.message}>
				<Callout tone="error">{texturingStore.message}</Callout>
			</Show>
			<Show when={isUploadedTexture(brush(), levelStore.document)}>
				<ToolGroup label={brushName()}>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							const id = brush();
							if (id) removeTexture(id);
						}}
					>
						Remove from level
					</Button>
				</ToolGroup>
			</Show>

			<PropertyList labelWidth="96px">
				<PropertyRow label="Scale U" valueClass="zylem-level-field">
					<NumberField
						aria-label="Scale U, in units a tile"
						value={texturingStore.scale.u}
						minValue={MIN_TILE}
						step={0.25}
						onCommit={(value) => setBrushScale('u', value)}
					/>
				</PropertyRow>
				<PropertyRow label="Scale V" valueClass="zylem-level-field">
					<NumberField
						aria-label="Scale V, in units a tile"
						value={texturingStore.scale.v}
						minValue={MIN_TILE}
						step={0.25}
						onCommit={(value) => setBrushScale('v', value)}
					/>
				</PropertyRow>
				<PropertyRow label="Offset U" valueClass="zylem-level-field">
					<NumberField
						aria-label="Offset U, in tiles"
						value={texturingStore.offset.u}
						step={0.125}
						onCommit={(value) => setBrushOffset('u', value)}
					/>
				</PropertyRow>
				<PropertyRow label="Offset V" valueClass="zylem-level-field">
					<NumberField
						aria-label="Offset V, in tiles"
						value={texturingStore.offset.v}
						step={0.125}
						onCommit={(value) => setBrushOffset('v', value)}
					/>
				</PropertyRow>
				<PropertyRow label="Rotation (°)" valueClass="zylem-level-field">
					<NumberField
						aria-label="Rotation, in degrees"
						value={texturingStore.rotation}
						minValue={-360}
						maxValue={360}
						step={15}
						onCommit={setBrushRotation}
					/>
				</PropertyRow>
			</PropertyList>

			<ToolGroup label="Brush">
				<Button size="sm" on={armed()} onClick={() => togglePaintTool()}>
					UV brush
				</Button>
			</ToolGroup>
			<ToolGroup label="Selection">
				<Button size="sm" disabled={!hasTarget()} onClick={() => applyBrushToSelection()}>
					Apply to selection
				</Button>
				<Button size="sm" disabled={!hasTarget()} onClick={() => clearSelectionTexture()}>
					Clear selection
				</Button>
			</ToolGroup>
			<Show when={armed()}>
				<Callout>
					Click a face to {brush() ? 'paint it' : 'take its texture off'}. Drag to cover every face
					the pointer crosses. Shift-click covers the whole solid. Press Escape to put the brush
					down.
				</Callout>
			</Show>
		</div>
	);
};
