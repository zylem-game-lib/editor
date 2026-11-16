/**
 * The UV brush: the texture it lays on level faces, and how that texture tiles.
 *
 * The brush lives here and is copied into level state, which sends it to the
 * game with each sync. The textures themselves are the built-ins from
 * `@zylem/bridge` plus the images saved in the level document.
 */

import {
	type BrushSurface,
	BUILTIN_TEXTURES,
	type LevelDocument,
	type LevelTexture,
} from '@zylem/bridge';
import { proxy } from 'valtio/vanilla';
import { mirrorProxy } from '../common/proxy-mirror';
import { debugStore, setOpenSections } from '../editor-store';
import {
	addLevelTextureEntry,
	levelHasTexture,
	levelState,
	paintLevelSelection,
	removeLevelTextureEntry,
	setLevelEditorActive,
	setLevelPaintSurface,
} from '../level/level-state';
import { readTextureFile, type TextureImage } from './texture-image';

/** World units along each side of the preview square. */
export const PREVIEW_UNITS = 4;
/** The smallest tile, in world units. Smaller would put a face on one texel. */
export const MIN_TILE = 0.05;

export type UvAxis = 'u' | 'v';

export interface TexturingState {
	/** The brush's texture. `null` is the None tile: the brush takes textures off. */
	textureId: string | null;
	/** World units one tile covers. */
	scale: { u: number; v: number };
	/** Shift, in tiles. */
	offset: { u: number; v: number };
	/** Degrees, counter-clockwise looking at the face. */
	rotation: number;
	/** Why the last image could not be added. */
	message: string;
}

const DEFAULT_TEXTURE = BUILTIN_TEXTURES[0]?.id ?? null;

export const texturingState = proxy<TexturingState>({
	textureId: DEFAULT_TEXTURE,
	scale: { u: 1, v: 1 },
	offset: { u: 0, v: 0 },
	rotation: 0,
	message: '',
});

/** Solid-reactive view of {@link texturingState}, for components. */
export const texturingStore = mirrorProxy(texturingState);

type Brush = Pick<TexturingState, 'textureId' | 'scale' | 'offset' | 'rotation'>;

/**
 * The brush's texture as the level can draw it. `null` when the brush is on
 * None, or its image is no longer in the level's library.
 */
export function brushTextureId(
	brush: Pick<Brush, 'textureId'> = texturingState,
	document: LevelDocument = levelState.document
): string | null {
	const id = brush.textureId;
	return id && levelHasTexture(document, id) ? id : null;
}

/** What the brush lays on a face. `null` takes the face's texture off. */
export function brushSurface(
	brush: Brush = texturingState,
	document: LevelDocument = levelState.document
): BrushSurface | null {
	const textureId = brushTextureId(brush, document);
	if (!textureId) return null;
	return {
		textureId,
		scale: { u: brush.scale.u, v: brush.scale.v },
		offset: { u: brush.offset.u, v: brush.offset.v },
		rotation: (brush.rotation * Math.PI) / 180,
	};
}

/** Hand the brush to level state, which sends it to the game. */
export function publishBrush(): void {
	setLevelPaintSurface(brushSurface());
}

/** Pick the brush's texture. `null` is None. */
export function setBrushTexture(textureId: string | null): void {
	texturingState.textureId = textureId;
	publishBrush();
}

/** World units one tile covers along an axis, {@link MIN_TILE} at the least. */
export function setBrushScale(axis: UvAxis, value: number): void {
	if (!Number.isFinite(value)) return;
	texturingState.scale[axis] = Math.max(MIN_TILE, value);
	publishBrush();
}

/** Shift the texture along an axis, in tiles. */
export function setBrushOffset(axis: UvAxis, value: number): void {
	if (!Number.isFinite(value)) return;
	texturingState.offset[axis] = value;
	publishBrush();
}

/** Turn the texture, in degrees. Kept within a full turn either way. */
export function setBrushRotation(degrees: number): void {
	if (!Number.isFinite(degrees)) return;
	// `+ 0` so a full turn reads 0, not -0.
	texturingState.rotation = (degrees % 360) + 0;
	publishBrush();
}

/** Show the Level Texture panel, entering level mode if need be. */
export function openTexturing(): void {
	setLevelEditorActive(true);
	setOpenSections([...new Set([...debugStore.openSections, 'texturing'])]);
}

/** Paint the selection with the brush as it is set. */
export function applyBrushToSelection(): boolean {
	return paintLevelSelection(brushSurface());
}

/** Take the textures off the selection. */
export function clearSelectionTexture(): boolean {
	return paintLevelSelection(null);
}

function nextTextureId(document: LevelDocument): string {
	const taken = new Set((document.textures ?? []).map((texture) => texture.id));
	let index = 1;
	while (taken.has(`tex-${index}`)) index += 1;
	return `tex-${index}`;
}

function textureName(fileName: string): string {
	const name = fileName.replace(/\.[^./\\]+$/, '').trim();
	return name || 'Texture';
}

/**
 * Add a decoded image to the level's library and put it on the brush.
 *
 * @returns The new texture.
 */
export function addTextureImage(name: string, image: TextureImage): LevelTexture {
	const texture: LevelTexture = {
		id: nextTextureId(levelState.document),
		name: textureName(name),
		dataUrl: image.dataUrl,
		width: image.width,
		height: image.height,
	};
	addLevelTextureEntry(texture);
	setBrushTexture(texture.id);
	return texture;
}

/**
 * Read an image file into the level's library, scaled to fit, and put it on
 * the brush. A file the browser cannot read leaves a message instead.
 */
export async function importTextureFile(
	file: File,
	read: (file: File) => Promise<TextureImage> = readTextureFile
): Promise<LevelTexture | null> {
	texturingState.message = '';
	try {
		return addTextureImage(file.name, await read(file));
	} catch {
		texturingState.message = `"${file.name}" is not an image this browser can read.`;
		return null;
	}
}

/**
 * Remove an uploaded image from the library and from every face showing it.
 * The brush falls back to None when it held that image.
 */
export function removeTexture(id: string): boolean {
	if (!removeLevelTextureEntry(id)) return false;
	if (texturingState.textureId === id) texturingState.textureId = null;
	publishBrush();
	return true;
}

/** Whether a texture is one of the level's own images, which can be removed. */
export function isUploadedTexture(
	id: string | null,
	document: LevelDocument = levelState.document
): boolean {
	return id !== null && (document.textures ?? []).some((texture) => texture.id === id);
}

/** A 2D affine transform as `[a, b, c, d, e, f]`: `x' = ax + cy + e`, `y' = bx + dy + f`. */
export type PreviewTransform = [number, number, number, number, number, number];

/**
 * Where one tile of the brush lands on the preview.
 *
 * The preview looks straight at a face: {@link PREVIEW_UNITS} world units on
 * a side, U to the right and V up, the face's origin at the bottom-left. The
 * transform takes a tile drawn in a unit square, image top at `y = 0`, to
 * preview pixels, and repeats from there. It is the inverse of the UV
 * projection in `@zylem/bridge`, so the preview and the level agree.
 *
 * @param size - The preview's side in pixels.
 */
export function previewTransform(
	brush: Pick<Brush, 'scale' | 'offset' | 'rotation'>,
	size: number
): PreviewTransform {
	const pixels = size / PREVIEW_UNITS;
	const turn = (brush.rotation * Math.PI) / 180;
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	const tileU = Math.max(MIN_TILE, brush.scale.u);
	const tileV = Math.max(MIN_TILE, brush.scale.v);
	// A tile's corner (u, 1 - v) sits at face point
	// (tileU·cos·(u - ou) - tileV·sin·(v - ov), tileU·sin·(u - ou) + tileV·cos·(v - ov)).
	const fromTop = 1 - brush.offset.v;
	return [
		pixels * tileU * cos,
		-pixels * tileU * sin,
		pixels * tileV * sin,
		pixels * tileV * cos,
		pixels * (-tileU * cos * brush.offset.u - tileV * sin * fromTop),
		pixels * (PREVIEW_UNITS + tileU * sin * brush.offset.u - tileV * cos * fromTop),
	];
}

/** Test hook. Does not talk to the game. */
export function resetTexturingState(): void {
	texturingState.textureId = DEFAULT_TEXTURE;
	texturingState.scale = { u: 1, v: 1 };
	texturingState.offset = { u: 0, v: 0 };
	texturingState.rotation = 0;
	texturingState.message = '';
}
