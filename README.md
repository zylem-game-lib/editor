# @zylem/editor

SolidJS debug UI and scene editor for [Zylem](https://github.com/zylem-game-lib/zylem)
games. The editor ships as a `<zylem-editor>` web component plus a host API, and
talks to a running `@zylem/game-lib` game over the typed
[`@zylem/bridge`](https://github.com/zylem-game-lib/zylem/tree/main/packages/bridge)
channel. It never imports game internals; everything it knows about the scene
arrives as bridge payloads.

## Install

```bash
pnpm add @zylem/editor @zylem/game-lib
```

`@zylem/game-lib` is a peer dependency. `@zylem/bridge` and `@zylem/ui` are
regular dependencies; the UI package is bundled (with its CSS inlined for the
shadow-DOM mount), while the bridge stays external so the editor and the game
share one module instance and therefore one channel.

## Usage

```ts
import '@zylem/game-lib/web-components';
import { registerZylemEditor } from '@zylem/editor';

registerZylemEditor();
```

```html
<zylem-game></zylem-game>
<zylem-editor launcher-mode="floating"></zylem-editor>
```

For a host that wants to drive the editor programmatically, see
`mountZylemEditor`, `attachEditorStateBridge`, and the undo/redo, catalog, and
transform exports in `src/index.ts`.

## Development

Requires Node `v22.12.0` (see `.nvmrc`) and [pnpm](https://pnpm.io/).

```bash
pnpm install

# Dev harness at http://localhost:3332 -- boots a real game (WebGL, wasm
# physics, game-side bridge adapter) with the editor overlaid on it.
pnpm dev

# Library build (tsup) into dist/
pnpm build

pnpm typecheck
pnpm lint
pnpm test
```

### Working against local checkouts

This repo is one of the Zylem polyrepos managed by
[`zylem-workspace`](https://github.com/zylem-game-lib/zylem-workspace) (`zw`).
By default the editor resolves `@zylem/game-lib`, `@zylem/bridge`, and
`@zylem/ui` from npm. To develop against sibling checkouts instead:

```bash
zw link dev     # swap @zylem/* deps for link:../<repo> overrides
zw link prod    # back to registry ranges before committing
```

`vite.config.ts` already allows the sibling directories (`../zylem`,
`../zylem-ui`, `../behaviors`, `../runtime`) in `server.fs.allow`, so linked
packages -- including the physics wasm served from `../runtime/dist` -- work
in the dev harness without further configuration.

Commit registry ranges, not `link:` specifiers.

### Bridge protocol

The editor and `@zylem/game-lib` are versioned independently but both pin
`@zylem/bridge`. When the bridge protocol changes, bump this package's
`@zylem/bridge` range (`zw update @zylem/bridge --to latest`) and cut an editor
release that matches the game-lib release consuming the same bridge version.

## Release

```bash
zw bump @zylem/editor --message "..."   # bump, build, commit, tag
zw publish @zylem/editor
```

Or manually: `pnpm version patch && git push --follow-tags`. The
`prepublishOnly` script runs the production build and the unit tests.
