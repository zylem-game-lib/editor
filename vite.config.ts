// Bare `@zylem/ui/vite` is a `.ts` file inside node_modules. Node 22.18+
// type-strips config imports and refuses to strip anything under
// node_modules. A relative path is bundled by Vite's config loader instead,
// so Node never has to execute that TypeScript.

import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { zylemVersionsPlugin } from './node_modules/@zylem/ui/vite/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devPort = 3333;

/**
 * Every package specifier the installed @zylem/game-lib imports, as
 * `optimizeDeps.include` entries.
 *
 * Vite does not look inside a dependency it was told not to prebundle, so it
 * meets these imports only when the browser asks for them. From a registry
 * install, a CommonJS one (stats.js, howler) then fails to load at all. An ES
 * module one that game-lib loads late (Recast on the first navmesh bake, a
 * model loader, Tone) makes Vite prebundle again and reload the page, which
 * throws away the level being edited. Reading the list from the package keeps
 * it right across upgrades, and for a `zw link dev` checkout as well.
 */
function gameLibImports(): string[] {
	const dist = path.resolve(__dirname, 'node_modules/@zylem/game-lib/dist');
	if (!existsSync(dist)) return [];
	const specifiers = new Set<string>();
	const bareImport = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'./][^"']*)["']/g;
	for (const name of readdirSync(dist)) {
		// The worker is one self-contained file.
		if (!name.endsWith('.js') || name === 'navigation-worker.js') continue;
		for (const match of readFileSync(path.join(dist, name), 'utf8').matchAll(bareImport)) {
			if (match[1]) specifiers.add(match[1]);
		}
	}
	return (
		[...specifiers]
			// The other @zylem packages are deliberately not prebundled.
			.filter((specifier) => !specifier.startsWith('@zylem/'))
			.sort()
			.map((specifier) => `@zylem/game-lib > ${specifier}`)
	);
}

// `@zylem/ui/styles.css` is resolved via the package's `exports` map
// (`"./styles.css": "./dist/styles.css"`), so no explicit alias is needed
// here — Vite, Rollup, and esbuild all honor the subpath export.
//
// Publish builds use `tsup` (`pnpm build`); this config is for `vite` serve
// (the dev harness, which boots a real game against `@zylem/game-lib`) and
// `vite preview` only.
export default defineConfig({
	plugins: [zylemVersionsPlugin(__dirname), solid()],
	build: {
		target: 'esnext',
	},
	// The physics runtime resolves its binary with
	// `new URL('./zylem_runtime.wasm', import.meta.url)`.
	assetsInclude: ['**/*.wasm'],
	resolve: {
		// Collapse solid-js onto one copy so `@zylem/ui/components` (shipped as
		// TSX source) shares the app Solid runtime instead of a duplicate. three
		// and the bridge are deduped for the same reason: two three.js copies
		// break `instanceof` checks, and two bridge copies would leave the editor
		// and the game talking on separate channels.
		dedupe: ['solid-js', 'three', '@zylem/bridge', '@zylem/game-lib'],
	},
	optimizeDeps: {
		// game-lib is served as it ships (see `exclude`), so everything it
		// imports is prebundled by name instead.
		include: gameLibImports(),
		exclude: [
			// Keep `@zylem/ui` out of esbuild prebundling so vite-plugin-solid
			// compiles its TSX components instead of the React JSX transform.
			'@zylem/ui',
			// Preserve the navigation worker URL relative to game-lib's dist.
			// Moving it into .vite/deps would detach it from its sibling worker.
			'@zylem/game-lib',
			// Prebundling rewrites the runtime into a flat chunk, which moves the
			// module away from its `.wasm` sibling and breaks the URL above.
			'@zylem/behaviors',
			'@zylem/runtime',
		],
	},
	server: {
		port: devPort,
		fs: {
			// This repo plus the sibling polyrepo checkouts when `zw link dev` has
			// swapped a dependency for a `link:` override. A published
			// `@zylem/runtime` serves its wasm from
			// `node_modules/.pnpm/@zylem+runtime@*/dist`, but a linked one resolves
			// through the symlink to `../simulation/packages/runtime/dist`, which
			// is outside this repo and would otherwise be refused with a 403.
			// `zylem` covers linked `@zylem/game-lib` and `@zylem/bridge`
			// (`zylem/packages/*`).
			allow: [
				path.resolve(__dirname),
				path.resolve(__dirname, '../zylem'),
				path.resolve(__dirname, '../ui'),
				path.resolve(__dirname, '../simulation'),
			],
		},
	},
});
