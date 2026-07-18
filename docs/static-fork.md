# Static fork: fixed data packs from remote URLs, no backend

This fork converts `portal-frontend` into a **fully static SPA** that reads
pre-generated per-modpack data from remote URLs — no PHP backend, no database,
no per-user mod-combination system. It builds to static files hostable on
GitHub Pages / any CDN.

This document is the durable design record and progress tracker. Update it in
the **same change** that lands work (tick the boxes, note deviations). GitHub
Issues are currently disabled on this fork; if enabled later, a tracking issue
should mirror this checklist and the two must stay reconciled.

## Locked decisions

- **No game-derived data is ever committed to this repo.** The repo is
  GPL-3.0-or-later, and item/recipe/icon data derives from Factorio (Wube) and
  mod authors' assets. All pack data is fetched at runtime from external URLs.
- **Initial data source: FactorioLab's published packs.**
  `https://factoriolab.github.io/data/<id>/data.json` + `icons.webp` +
  `i18n/<lang>.json` — MIT-licensed pipeline, served with
  `Access-Control-Allow-Origin: *`. Covers vanilla `1.1`/`2.0`, `spa`
  (Space Age), `sxp` (Space Exploration + AAI), `kr2`, and more. Zero hosting
  to solve on our side. Schema spec: `factoriolab/factoriolab` repo,
  `src/data/schema/*.ts`.
- **Provider seam, not a rewrite.** A static implementation sits behind the
  existing `portalApi` singleton (`src/api/PortalApi.ts`) and returns the
  exact `src/api/transfer.ts` shapes, so stores and components stay untouched.
  `transfer.ts` is the spec — do not change its shapes.
- **Synthetic combination ids.** A bundled pack manifest (modeled on the fbe
  fork's `packs.json`) maps each pack id to a stable synthetic combination id.
  URLs (`/{shortId}/items`), `StorageManager` cache scoping, and icon CSS
  selectors keep working unchanged. `withCombinationId(id)` selects the pack.
- **Minimal build modernization.** Stay on webpack 5; a Vite migration (if
  ever) is a separate, isolated effort.

## Status

- [x] **Phase 0 — build resurrection + CI.** Builds/tests green on Node 22:
  `node-sass` → Dart `sass`, dropped `image-webpack-loader`, webpack ^5.108
  (OpenSSL-3 md4 fix), `buffer` polyfill for `base-x`. CI (`ci.yaml`) runs
  jest/eslint/tsc/build on Node 22 with `--legacy-peer-deps`.
- [ ] **Phase 1 — provider seam + pack manifest.** `StaticPortalApi` behind
  the `portalApi` export; bundled manifest of FactorioLab packs ↔ synthetic
  combination ids; per-pack `data.json` fetched once and cached in memory;
  item list / item ingredient+product pages / recipe details+machines /
  tooltips / random served from it. `initializeSession` synthesized from the
  manifest + localStorage.
- [ ] **Phase 2 — icons.** `getIconsStyle` generates CSS locally from the
  pack's `icons` rects + `icons.webp` (64 px cells on a 66 px stride;
  `background-position` + `background-size` scaling). Keep `IconsStyleData`
  shape; `IconManager` stays untouched.
- [ ] **Phase 3 — search.** Client-side substring/prefix search over pack
  item/recipe names wired into `search()` (an index library only if plain
  filtering proves too slow — packs are ≤ ~2k items).
- [ ] **Phase 4 — settings → pack picker.** Replace the settings pages with a
  static pack picker; delete the savegame wizard (`SaveGameReader`,
  `SettingsNewStore`, `settingNew/` components, `fflate`/`byte-buffer` deps),
  setting validation, and status polling (`GlobalSettingStatus`,
  `checkSettingStatus`); `sendSidebarEntities` persists to localStorage only.
- [ ] **Phase 5 — static hosting + deploy.** SPA fallback for GitHub Pages
  (404.html trick), drop `.htaccess` domain redirect, fix `index.ejs`
  canonical/og URLs, CI deploy workflow.

## FactorioLab → transfer.ts mapping (Phase 1 spec)

| PortalApi method | Static behavior against FactorioLab `data.json` |
|---|---|
| `initializeSession` | Synthesize `InitData` from manifest + localStorage; `status: available`. |
| `getItemList` | Items array minus `category: "technology"`; type = `"fluid"` when `category === "fluids"`, else `"item"`; paginate in memory. |
| `getItemIngredientRecipes` | Recipes where the item id is a key of `in`; paginate. |
| `getItemProductRecipes` | Recipes where the item id is a key of `out`; paginate. |
| `getRecipeDetails` | Recipe by id; `craftingTime = time`; `description: ""` (schema has none); no expensive mode. |
| `getRecipeMachines` | The recipe's `producers` list joined against items with a `machine` sub-object (`craftingSpeed = machine.speed`, `numberOfModules = machine.modules`, `energyUsage = machine.usage` kW; item/fluid slot counts defaulted). |
| `search` | Client-side name search (Phase 3). |
| `getRandom` | Random sample of items. |
| `getTooltip` | Item + up to `numberOfRecipesPerEntity` of its recipes. |
| `getIconsStyle` | CSS from `icons` rects + `icons.webp` (Phase 2). |
| `getSettings` / `getSetting` / `getSettingMods` | From the bundled manifest (mods list is informational). |
| `validateSetting` | Match against manifest, else `unknown` (removed with Phase 4 UI). |
| `saveSetting` / `deleteSetting` / `sendSidebarEntities` | localStorage. |

Accepted gaps with this source: no descriptions; thin localization (inline
English; `i18n/ja|zh.json` for some packs); `sxp` is a stock SE set, not the
fbe fork's exact SE-on-2.0 mod list; technologies must be filtered; machine
slot counts absent; amounts may be fractional strings (Rational) — normalize
to numbers.

## Bigger picture

The companion fork [`trisiak/factorio-blueprint-editor`](https://github.com/trisiak/factorio-blueprint-editor)
vendors ~430 MB of per-pack `data.json` + `.basis` sprites and publishes them
at `https://trisiak.github.io/factorio-blueprint-editor/data/<pack>/…` (its
issue #8 tracks moving that data out of the repo). The long-term shape is a
shared **data plane**: pack data generated by the fbe exporter, published from
a dedicated data host, consumed by both apps. When that exists, this app gains
a second data-source adapter (same provider seam, different base URL + schema)
that serves the exact mod sets, full locales, and descriptions FactorioLab
lacks. Design the Phase 1 provider so a data source = (base URL, schema
adapter) and the FactorioLab specifics stay in the adapter.
