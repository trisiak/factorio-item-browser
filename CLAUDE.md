# CLAUDE.md

Guidance for AI agents working in this repo. Optimized for getting useful work
done quickly and safely; humans should also read `README.md`.

## What this is

A fork of
[`factorio-item-browser/portal-frontend`](https://github.com/factorio-item-browser/portal-frontend)
— the React 17 + TypeScript + MobX frontend of the Factorio Item Browser —
being converted into a **fully static SPA** that reads fixed, pre-generated
per-modpack data from remote URLs. No PHP backend, no database, no per-user
mod-combination system. This fork is an independent line of development; don't
open upstream PRs.

**Read `docs/static-fork.md` before doing anything** — it is the durable
design record, the phase tracker, and the spec for the data-source mapping.
Keep its checkboxes up to date in the same change that lands work.

## Hard constraints

- **NEVER commit game-derived data or assets to this repo.** No item/recipe
  dumps, no icons, no spritesheets, no locale dumps — nothing derived from
  Factorio (Wube) or mod authors' assets. The repo is GPL-3.0-or-later and
  the data is third-party IP; all pack data is fetched at runtime from
  external URLs (currently FactorioLab's published packs).
- **Do not change the `src/api/transfer.ts` type shapes.** The whole
  conversion strategy is that stores/components stay interface-compatible
  and are fed through the `portalApi` seam (`src/api/PortalApi.ts`).
- Preserve the `portalApi` singleton export name and method signatures.
- **Never change the synthetic combination ids in `src/api/static/packs.ts`.**
  They scope users' localStorage (sidebar, options, last pack) and appear in
  shareable URLs — changing one silently wipes user state and breaks links.
  New packs get new ids; existing ids are forever.

## Architecture in one paragraph

Every data access funnels through the `PortalApi` interface
(`src/api/PortalApi.ts`), whose request/response shapes live in
`src/api/transfer.ts`; the static implementation and the pack manifest live
in `src/api/static/`. Icons are CSS classes injected from a generated
stylesheet (`src/class/IconManager.ts`). Every URL is prefixed with a
"combination id" (`src/class/CombinationId.ts`); localStorage caching is
scoped by it (`src/class/StorageManager.ts`). The static fork keeps all of
that, mapping packs to **synthetic** combination ids via the bundled
manifest, and satisfies the API from fetched pack data. `docs/static-fork.md`
has the full method-by-method mapping.

## Commands

Node 22 (CI matches). A plain install works:

```bash
npm install
```

| Task | Command |
| --- | --- |
| Dev server | `npm start` |
| Production build | `npm run build` (reads `./.env`; `cp .env.development .env` first if absent) |
| Full test suite | `npm test` (= tsc + jest + eslint) |
| Type-check only | `npm run test-tsc` |
| Unit tests only | `npm run test-jest` |
| Lint only | `npm run test-eslint` (`npm run fix` to autofix) |
| E2E tests | `npm run test:e2e` (Playwright; builds + serves automatically) |

Before declaring a change done, run `npm test` and `npm run build`; run
`npm run test:e2e` when the change touches the data layer, routing, icons or
anything user-visible.

### E2E notes

- The suite (`e2e/app.spec.ts`) runs against the **production build** served by
  `e2e/server.js` with real GitHub Pages semantics (path prefix +
  `404.html` fallback) and fetches **live FactorioLab data** — it doubles as a
  canary for upstream data-format drift. No mocks.
- In sandboxed environments set `PLAYWRIGHT_CHROMIUM_PATH` (e.g.
  `/opt/pw-browsers/chromium`); the config routes only `https://` through
  `HTTPS_PROXY` so the local test server stays direct.
- Playwright specs are excluded from jest (`testPathIgnorePatterns`) and from
  the app's tsc (`tsconfig.json` includes `src` only) — keep it that way, the
  app toolchain is TS 4.2.

## Conventions

- TypeScript + React function components + MobX stores (`src/store/`), one
  module-level singleton per store; route registration happens in store
  constructors, so import order matters.
- Prettier + ESLint enforced (CI runs them); match existing style.
- Routing is router5 (`src/class/Router.ts`); each logical route registers
  short-id / missing-id / long-id variants — don't bypass that helper.
- The deployed site lives under a path prefix (GitHub Pages project site,
  `pages.yaml` deploys on master pushes). `BASE_PATH` at build time must stay
  wired through **all** of: webpack `publicPath`, the `<base>` tag, the
  router5 `base` option, `Router.buildPath`, and the combination-id sniffing
  in `GlobalStore` — partial changes break deep links. `404.html` is the SPA
  fallback and must keep asset/CSS parity with `index.html` (the CSS inliner
  is filtered to cover both; the e2e suite guards this).

## Working agreements

- Commit and push only when asked; never open a PR unless explicitly
  requested.
- Keep `docs/static-fork.md` reconciled with the work in the same change.
  GitHub Issues are currently disabled on this fork; if they get enabled,
  mirror the doc's checklist into a tracking issue and cross-link.
- The sibling fork `trisiak/factorio-blueprint-editor` (MIT, PixiJS editor)
  publishes its own pack data on GitHub Pages and is the long-term shared
  "data plane" (see the doc's Bigger picture section). Don't couple this app
  to its internals — only to published URLs behind the data-source adapter.
