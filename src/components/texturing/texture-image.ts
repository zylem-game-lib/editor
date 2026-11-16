/**
 * Images for the UV brush: reading an upload, and drawing the built-ins.
 *
 * Everything here needs a browser canvas except {@link fitTextureSize}.
 */

import {
	BUILTIN_TEXTURE_SIZE,
	type BuiltinTextureKey,
	builtinTextureKey,
	builtinTexturePixels,
	type LevelDocument,
} from '@zylem/bridge';

/** The longest side an uploaded image keeps, in pixels. */
export const MAX_TEXTURE_SIZE = 512;

/** File types the picker offers. */
export const TEXTURE_FILE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

export interface TextureImage {
	dataUrl: string;
	width: number;
	height: number;
}

/** The size an image is stored at: the same shape, {@link MAX_TEXTURE_SIZE} on its longer side at most. */
export function fitTextureSize(
	width: number,
	height: number,
	max: number = MAX_TEXTURE_SIZE
): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (!(longest > max)) return { width, height };
	const shrink = max / longest;
	return {
		width: Math.max(1, Math.round(width * shrink)),
		height: Math.max(1, Math.round(height * shrink)),
	};
}

function readAsDataUrl(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
		reader.readAsDataURL(file);
	});
}

/** An image element once its pixels are in. Rejects for a URL that is not an image. */
export function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('The image could not be decoded.'));
		image.src = url;
	});
}

/**
 * Read an image file as a data URL for the level document.
 *
 * An image within {@link MAX_TEXTURE_SIZE} keeps its own bytes. A larger one
 * is drawn smaller and re-encoded: JPEG stays JPEG, everything else becomes
 * PNG.
 */
export async function readTextureFile(file: File): Promise<TextureImage> {
	const original = await readAsDataUrl(file);
	const image = await loadImage(original);
	const { naturalWidth, naturalHeight } = image;
	if (!(naturalWidth > 0 && naturalHeight > 0)) throw new Error('The image is empty.');

	const size = fitTextureSize(naturalWidth, naturalHeight);
	if (size.width === naturalWidth && size.height === naturalHeight) {
		return { dataUrl: original, ...size };
	}
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('No 2D canvas.');
	context.imageSmoothingQuality = 'high';
	context.drawImage(image, 0, 0, size.width, size.height);
	const dataUrl =
		file.type === 'image/jpeg'
			? canvas.toDataURL('image/jpeg', 0.9)
			: canvas.toDataURL('image/png');
	return { dataUrl, ...size };
}

const builtinUrls = new Map<BuiltinTextureKey, string>();

/** A built-in texture as an image URL, drawn once. */
export function builtinTextureUrl(key: BuiltinTextureKey): string {
	const cached = builtinUrls.get(key);
	if (cached) return cached;
	const canvas = document.createElement('canvas');
	canvas.width = BUILTIN_TEXTURE_SIZE;
	canvas.height = BUILTIN_TEXTURE_SIZE;
	const context = canvas.getContext('2d');
	if (!context) return '';
	const pixels = builtinTexturePixels(key);
	const image = context.createImageData(BUILTIN_TEXTURE_SIZE, BUILTIN_TEXTURE_SIZE);
	image.data.set(pixels);
	context.putImageData(image, 0, 0);
	const url = canvas.toDataURL('image/png');
	builtinUrls.set(key, url);
	return url;
}

/** The image URL of a texture the level can draw, or `null` for one it cannot. */
export function textureUrl(document: LevelDocument, textureId: string | null): string | null {
	if (!textureId) return null;
	const key = builtinTextureKey(textureId);
	if (key) return builtinTextureUrl(key) || null;
	return document.textures?.find((texture) => texture.id === textureId)?.dataUrl ?? null;
}
