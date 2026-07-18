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
- [x] **Phase 1 — provider seam + pack manifest.** `PortalApi` is now an
  interface (the axios implementation lives on as `HttpPortalApi`, unused);
  the `portalApi` singleton is a `StaticPortalApi` (`src/api/static/`)
  answering from the bundled manifest (`packs.ts`: vanilla-2.0 / space-age /
  space-exploration ↔ synthetic combination ids) and the pack's `data.json`,
  fetched once and cached in memory. Item list, item ingredient/product
  pages, recipe details+machines, tooltips, random, settings-read and a
  basic substring `search()` all work; verified in Chromium against live
  FactorioLab data (203 items, item/recipe pages render, no console
  errors). The false "does not support Factorio 2.x" banner was removed.
  Unit tests cover the mapping with a synthetic fixture.
- [x] **Branding / attribution pass.** Footer states "independent fork of
  the original Factorio Item Browser" (linked) and "data currently provided
  by FactorioLab" (linked); the Discord footer icon became a GitHub link to
  this fork; README carries the full fork/attribution disclaimer; the
  original site's `og:url` and `opensearch.xml` were removed. Remaining
  Discord references live only inside the settings pages that Phase 4
  deletes.
- [x] **Phase 2 — icons.** `getIconsStyle` generates CSS locally from the
  pack's `icons` rects + `icons.webp`: percentage-based `background-size` /
  `background-position` rules (so the same rule serves the 32 px and 64 px
  icon elements), sheet dimensions measured once via an `Image` load (they
  are not in `data.json`). Icon resolution: item/fluid/machine → the item's
  `icon ?? id`; recipe → `icon ?? id`, falling back to the primary product's
  icon. `IconManager` and `IconsStyleData` untouched. Verified in Chromium:
  item grid, recipe pages and machine cards all show real icons for both the
  vanilla-2.0 and space-age packs; search and the long-form combination-id
  redirect verified along the way. Mod icons (settings page) intentionally
  resolve to nothing — that page dies in Phase 4.
- [ ] **Phase 3 — search polish.** A basic prefix/substring item search
  shipped with Phase 1 (`PackData.search`). Remaining: evaluate result
  quality on the big packs (sxp) and improve ranking/matching only if it
  falls short in practice.
- [x] **Phase 4 — settings → pack picker.** The settings page is now a pack
  picker (pack dropdown + change button + locale option + mod list). Deleted
  wholesale: the savegame wizard (`SaveGameReader`, `SettingsNewStore`,
  `settingNew/` components, `fflate`/`byte-buffer` deps), setting
  validation/deletion, status polling (`GlobalSettingStatus`,
  `TemporarySettingStatus`, `SelectedSettingStatus`, `checkSettingStatus`,
  `useInterval`), the axios `HttpPortalApi` reference implementation (+ the
  `axios` dep and `PORTAL_API_URI`/`DISCORD_LINK`/
  `INTERVAL_CHECK_SETTING_STATUS` env vars — the git history keeps the
  reference), and the last Discord references. The `PortalApi` interface
  shrank to the 16 methods actually used. Locale files pruned of the dead
  blocks; the language picker lists only en/de (the locales that exist);
  its description now says labels are English-only. Mod cards hide the
  author row when the data source has no author (FactorioLab's `version`
  map doesn't).
- [x] **sxp (Space Exploration) basic checks.** Verified in Chromium: pack
  switch via the settings picker works; `data.json` loads fast (item list
  ~0.7 s cold); 899 items+fluids listed (= FactorioLab's 1470 items minus
  571 technologies — the tech filter accounts exactly); search finds SE
  content; item/recipe pages and icons render; no console errors. Data
  quirks observed and accepted as upstream-data realities, not mapping
  bugs: SE's own dummy pseudo-items appear (e.g. "Cargo rocket (Hidden
  Ingredient)" = `se-rocket-launch-pad-silo-dummy-ingredient-item`), and
  some display names are duplicated across genuinely distinct entities
  (`centrifuge` vs `se-centrifuge`, aai container base variants). A future
  own-pack adapter can model these more faithfully.
- [ ] **Phase 5 — static hosting + deploy.** SPA fallback for GitHub Pages
  (404.html trick), drop `.htaccess` domain redirect, CI deploy workflow.
  Re-add an `og:url` meta and an `opensearch.xml` once the fork has a real
  public URL (both were removed with the branding pass because they
  hardcoded the original site's domain).

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
