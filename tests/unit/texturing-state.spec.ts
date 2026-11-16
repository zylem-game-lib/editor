// @vitest-environment happy-dom

import {
	type BrushVec3,
	boxBrush,
	getZylemBridge,
	type LevelDocument,
	type LevelSyncPayload,
	surfaceAxes,
	surfaceUv,
} from '@zylem/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyLevelGesture } from '../../src/bridge/sync-editing';
import { debugStore, setOpenSections } from '../../src/components/editor-store';
import { getDebugTool, setDebugTool } from '../../src/components/entities/entities-state';
import {
	levelState,
	loadLevelDocument,
	resetLevelEditor,
	setLevelEditorActive,
	undoLevel,
} from '../../src/components/level/level-state';
import { fitTextureSize, type TextureImage } from '../../src/components/texturing/texture-image';
import {
	addTextureImage,
	applyBrushToSelection,
	brushSurface,
	brushTextureId,
	clearSelectionTexture,
	importTextureFile,
	isUploadedTexture,
	MIN_TILE,
	PREVIEW_UNITS,
	previewTransform,
	removeTexture,
	resetTexturingState,
	setBrushOffset,
	setBrushRotation,
	setBrushScale,
	setBrushTexture,
	texturingState,
} from '../../src/components/texturing/texturing-state';
import { disarmTools } from '../../src/components/toolbar/tool-shortcuts';
import { togglePaintTool } from '../../src/components/toolbar/toolbar-actions';

const TOP = 2;
const MOSS: TextureImage = { dataUrl: 'data:image/png;base64,MOSS', width: 64, height: 32 };

let syncs: LevelSyncPayload[];
let toolMessages: string[];
let stopCapture: Array<() => void> = [];

const lastSync = () => syncs[syncs.length - 1];

function scene(): LevelDocument {
	return {
		version: 2,
		solids: [{ id: 'a', planes: boxBrush({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 2 }) }],
		doodads: [],
		entities: [],
	};
}

function texturesOn(id: string): Array<string | null> {
	const solid = levelState.document.solids.find((entry) => entry.id === id);
	return (solid?.planes ?? []).map((plane) => plane.surface?.textureId ?? null);
}

beforeEach(() => {
	const { channel } = getZylemBridge();
	channel.reset();
	resetLevelEditor();
	resetTexturingState();
	setDebugTool('none');
	setOpenSections(['console']);
	loadLevelDocument(scene());
	setLevelEditorActive(true);
	syncs = [];
	toolMessages = [];
	stopCapture = [
		channel.on('level:sync', (payload) => syncs.push(payload)),
		channel.on('tool:set', ({ tool }) => toolMessages.push(tool)),
	];
});

afterEach(() => {
	for (const stop of stopCapture) stop();
	stopCapture = [];
});

describe('the brush', () => {
	it('starts on the first built-in, one tile to a unit', () => {
		expect(brushSurface()).toEqual({
			textureId: 'builtin:grid',
			scale: { u: 1, v: 1 },
			offset: { u: 0, v: 0 },
			rotation: 0,
		});
	});

	it('sends every change to the game, with the rotation in radians', () => {
		setBrushTexture('builtin:brick');
		setBrushScale('u', 2);
		setBrushScale('v', 0.5);
		setBrushOffset('u', 0.25);
		setBrushOffset('v', -0.5);
		setBrushRotation(90);

		expect(syncs).toHaveLength(6);
		expect(lastSync()?.paintSurface).toEqual({
			textureId: 'builtin:brick',
			scale: { u: 2, v: 0.5 },
			offset: { u: 0.25, v: -0.5 },
			rotation: Math.PI / 2,
		});
		expect(levelState.undoDepth).toBe(0);
	});

	it('keeps a tile from shrinking to nothing, and ignores what is not a number', () => {
		setBrushScale('u', 0);
		setBrushScale('v', -3);
		expect(texturingState.scale).toEqual({ u: MIN_TILE, v: MIN_TILE });

		setBrushScale('u', Number.NaN);
		setBrushOffset('u', Number.POSITIVE_INFINITY);
		setBrushRotation(Number.NaN);
		expect(texturingState.scale.u).toBe(MIN_TILE);
		expect(texturingState.offset.u).toBe(0);
		expect(texturingState.rotation).toBe(0);
	});

	it('keeps the rotation within a full turn', () => {
		setBrushRotation(450);
		expect(texturingState.rotation).toBe(90);
		setBrushRotation(-405);
		expect(texturingState.rotation).toBe(-45);
		setBrushRotation(-360);
		expect(Object.is(texturingState.rotation, 0)).toBe(true);
	});

	it('erases on None, and keeps its tiling for the next texture', () => {
		setBrushScale('u', 3);
		setBrushTexture(null);
		expect(brushSurface()).toBeNull();
		expect(lastSync()?.paintSurface).toBeNull();

		setBrushTexture('builtin:checker');
		expect(brushSurface()?.scale.u).toBe(3);
	});
});

describe('the UV brush tool', () => {
	it('arms paint, opens the panel, and sends the brush', () => {
		togglePaintTool();
		expect(getDebugTool()).toBe('paint');
		expect(toolMessages).toEqual(['paint']);
		expect(debugStore.openSections).toContain('texturing');
		expect(lastSync()?.paintSurface?.textureId).toBe('builtin:grid');
	});

	it('enters level mode when it is off', () => {
		setLevelEditorActive(false);
		togglePaintTool();
		expect(levelState.active).toBe(true);
		expect(getDebugTool()).toBe('paint');
	});

	it('goes down on a second press, and on Escape', () => {
		togglePaintTool();
		togglePaintTool();
		expect(getDebugTool()).toBe('none');
		expect(toolMessages).toEqual(['paint', 'none']);

		togglePaintTool();
		expect(disarmTools()).toBe(true);
		expect(getDebugTool()).toBe('none');
	});

	it('stays armed after a stroke', () => {
		togglePaintTool();
		applyLevelGesture({
			kind: 'paint',
			faces: [{ brushId: 'a', kind: 'face', planes: [TOP] }],
			surface: brushSurface(),
		});
		expect(texturesOn('a')[TOP]).toBe('builtin:grid');
		expect(getDebugTool()).toBe('paint');
	});
});

describe('painting the selection', () => {
	it('applies the brush to the selected solid, and clears it', () => {
		levelState.selectedIds = ['a'];
		setBrushTexture('builtin:concrete');
		expect(applyBrushToSelection()).toBe(true);
		expect(texturesOn('a')).toEqual(Array(6).fill('builtin:concrete'));

		expect(applyBrushToSelection()).toBe(false);
		expect(clearSelectionTexture()).toBe(true);
		expect(texturesOn('a')).toEqual(Array(6).fill(null));
		expect(levelState.undoDepth).toBe(2);
	});

	it('clears with the brush on None', () => {
		levelState.selectedIds = ['a'];
		applyBrushToSelection();
		setBrushTexture(null);
		expect(applyBrushToSelection()).toBe(true);
		expect(levelState.undoLabel).toBe('Clear texture');
	});
});

describe('the level library', () => {
	it('adds an image under the file name and puts it on the brush', () => {
		const texture = addTextureImage('Mossy Wall.final.png', MOSS);
		expect(texture).toEqual({ id: 'tex-1', name: 'Mossy Wall.final', ...MOSS });
		expect(levelState.document.textures).toEqual([texture]);
		expect(levelState.undoLabel).toBe('Add texture');
		expect(brushTextureId()).toBe('tex-1');
		expect(lastSync()?.paintSurface?.textureId).toBe('tex-1');
		expect(lastSync()?.document.textures).toEqual([texture]);
		expect(isUploadedTexture('tex-1')).toBe(true);
		expect(isUploadedTexture('builtin:grid')).toBe(false);
		expect(isUploadedTexture(null)).toBe(false);
	});

	it('gives each image an id the library does not have yet', () => {
		addTextureImage('a.png', MOSS);
		addTextureImage('b.png', MOSS);
		removeTexture('tex-1');
		expect(addTextureImage('.png', MOSS)).toMatchObject({ id: 'tex-1', name: 'Texture' });
		expect(levelState.document.textures?.map((texture) => texture.id)).toEqual(['tex-2', 'tex-1']);
	});

	it('reads a file through the decoder, and reports one it cannot read', async () => {
		const file = new File(['x'], 'stone.jpg', { type: 'image/jpeg' });
		const added = await importTextureFile(file, async () => MOSS);
		expect(added).toMatchObject({ id: 'tex-1', name: 'stone' });
		expect(texturingState.message).toBe('');

		const broken = new File(['x'], 'notes.txt', { type: 'text/plain' });
		const failed = await importTextureFile(broken, async () => {
			throw new Error('not an image');
		});
		expect(failed).toBeNull();
		expect(texturingState.message).toBe('"notes.txt" is not an image this browser can read.');
		expect(levelState.document.textures).toHaveLength(1);

		await importTextureFile(file, async () => MOSS);
		expect(texturingState.message).toBe('');
	});

	it('removes an image from the level and the faces showing it, and drops it from the brush', () => {
		addTextureImage('moss.png', MOSS);
		levelState.selectedIds = ['a'];
		applyBrushToSelection();
		expect(texturesOn('a')).toEqual(Array(6).fill('tex-1'));

		expect(removeTexture('tex-1')).toBe(true);
		expect(levelState.document.textures).toEqual([]);
		expect(texturesOn('a')).toEqual(Array(6).fill(null));
		expect(texturingState.textureId).toBeNull();
		expect(lastSync()?.paintSurface).toBeNull();
		expect(removeTexture('tex-1')).toBe(false);
		expect(removeTexture('builtin:grid')).toBe(false);

		undoLevel();
		expect(texturesOn('a')).toEqual(Array(6).fill('tex-1'));
	});

	it('treats a brush whose image left the library as None', () => {
		addTextureImage('moss.png', MOSS);
		undoLevel();
		expect(texturingState.textureId).toBe('tex-1');
		expect(brushTextureId()).toBeNull();
		expect(brushSurface()).toBeNull();
	});
});

describe('fitTextureSize', () => {
	it('keeps an image that fits', () => {
		expect(fitTextureSize(512, 256)).toEqual({ width: 512, height: 256 });
		expect(fitTextureSize(16, 16)).toEqual({ width: 16, height: 16 });
	});

	it('shrinks the longer side to the limit and keeps the shape', () => {
		expect(fitTextureSize(2048, 1024)).toEqual({ width: 512, height: 256 });
		expect(fitTextureSize(600, 1200)).toEqual({ width: 256, height: 512 });
		expect(fitTextureSize(4000, 3)).toEqual({ width: 512, height: 1 });
		expect(fitTextureSize(100, 50, 10)).toEqual({ width: 10, height: 5 });
	});
});

describe('previewTransform', () => {
	const SIZE = 256;
	const PIXELS = SIZE / PREVIEW_UNITS;

	function place(transform: number[], x: number, y: number): [number, number] {
		const [a, b, c, d, e, f] = transform as [number, number, number, number, number, number];
		return [a * x + c * y + e, b * x + d * y + f];
	}

	it('puts one tile on the bottom-left unit square for a plain brush', () => {
		const transform = previewTransform(texturingState, SIZE);
		// The tile's top-left and bottom-right corners, image top at y = 0.
		expect(place(transform, 0, 0)).toEqual([0, SIZE - PIXELS]);
		expect(place(transform, 1, 1)).toEqual([PIXELS, SIZE]);
	});

	it('agrees with the UVs the level draws', () => {
		const brushes = [
			{ scale: { u: 1, v: 1 }, offset: { u: 0, v: 0 }, rotation: 0 },
			{ scale: { u: 2, v: 0.5 }, offset: { u: 0.25, v: -0.75 }, rotation: 0 },
			{ scale: { u: 1.5, v: 3 }, offset: { u: -0.4, v: 0.1 }, rotation: 30 },
			{ scale: { u: 1, v: 1 }, offset: { u: 0, v: 0 }, rotation: -90 },
		];
		const normals: BrushVec3[] = [
			{ x: 0, y: 0, z: 1 },
			{ x: 0, y: 1, z: 0 },
			{ x: -1, y: 0, z: 0 },
		];
		const points: Array<[number, number]> = [
			[0, 0],
			[1, 0],
			[0.5, 2.25],
			[3.75, 1.5],
		];
		for (const brush of brushes) {
			const surface = brushSurface({ textureId: 'builtin:grid', ...brush });
			const transform = previewTransform(brush, SIZE);
			for (const normal of normals) {
				const axes = surfaceAxes(normal);
				for (const [x, y] of points) {
					// A point on the face, `x` along U and `y` along V from the origin.
					const world = {
						x: axes.u.x * x + axes.v.x * y,
						y: axes.u.y * x + axes.v.y * y,
						z: axes.u.z * x + axes.v.z * y,
					};
					const uv = surfaceUv(world, normal, surface);
					// The preview draws image row 0 at the top, where v = 1.
					const [px, py] = place(transform, uv.u, 1 - uv.v);
					expect(px).toBeCloseTo(x * PIXELS, 6);
					expect(py).toBeCloseTo(SIZE - y * PIXELS, 6);
				}
			}
		}
	});
});
