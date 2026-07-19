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
- [x] **Phase 5 — static hosting + deploy.** The build is base-path aware:
  `BASE_PATH` (env, build-time) flows into webpack `publicPath`, the
  `<base>` tag, the router5 browser plugin (`base` option), built hrefs and
  the combination-id sniffing; `PUBLIC_URL` re-adds the `og:url` meta. The
  build emits `404.html` (same app, same inlined CSS) as the GitHub Pages
  SPA fallback; the upstream `.htaccess` (Apache domain redirect) is gone;
  the manifest scope is subpath-safe. `pages.yaml` deploys `build/` via the
  official Pages actions on master pushes (+ manual dispatch), building
  with `BASE_PATH=/<repo>/`. Verified locally against a GH-Pages-simulating
  server (subpath + 404 fallback): deep links boot, redirect to the
  prefixed short-id URL, click-through and fresh deep links work.
  `opensearch.xml` stays dropped (niche; revisit on request).

## FactorioLab → transfer.ts mapping (Phase 1 spec)

| PortalApi method | Static behavior against FactorioLab `data.json` |
|---|---|
| `initializeSession` | Synthesize `InitData` from manifest + localStorage; `status: available`. |
| `getItemList` | Items array minus `category: "technology"`; type = `"fluid"` when `category === "fluids"`, else `"item"`; paginate in memory. |
| `getItemIngredientRecipes` | Recipes where the item id is a key of `in`; paginate. |
| `getItemProductRecipes` | Recipes where the item id is a key of `out`; paginate. |
| `getRecipeDetails` | Recipe by id; `craftingTime = time`; `description: ""` (schema has none); no expensive mode. |
| `getRecipeMachines` | The recipe's `producers` list joined against items with a `machine` sub-object (`craftingSpeed = machine.speed`, `numberOfModules = machine.modules`, `energyUsage = machine.usage` kW; item/fluid slot counts defaulted). |
| `getMachineRecipes` | The inverse of `producers`: recipes naming the given machine item as a producer, as `ItemRecipesData` (same shape as the item recipe lists). Empty for non-producer items, so the machine's item page only shows a "Can craft" section when it is a crafting machine. |
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

- [x] **E2E suite (post-merge).** Playwright specs (`e2e/app.spec.ts`)
  covering boot/redirect via the 404 fallback, icon CSS application, item →
  recipe → machines flows, search, pack switching, and the sxp specifics
  (dummy/orphan hiding, duplicate-name disambiguation, iconText overlays).
  Runs against the production build served with GitHub Pages semantics
  (`e2e/server.js`) and live FactorioLab data — a canary for upstream
  format drift. CI job `E2E (Playwright)` in `ci.yaml`. Writing the suite
  surfaced and fixed a real gap: the selected pack is now remembered in
  localStorage (`staticLastPack`), so id-less visits (bare `/`) resolve to
  the last browsed pack instead of always reverting to the default.

## FactorioLab sxp (Space Exploration) quirk inventory

Full audit of `factoriolab.github.io/data/sxp/data.json` (2026-07-18), so sxp
can be made comfortably usable *before* investing in the custom exporter. The
good news: the data is structurally sound — every recipe ingredient/product id
resolves to an item, every `producers` entry is a machine item, every recipe
has producers, every item and recipe resolves to an icon, and no
fractional-string amounts occur. The remaining quirks, with counts and
proposed mitigations:

1. **2 dummy pseudo-items** — `se-rocket-launch-pad-silo-dummy-{ingredient,result}-item`
   ("Cargo rocket (Hidden Ingredient/Result)"). SE's own internal items for
   the cargo-rocket mechanic; they clutter list and search.
   - [x] Mitigation: items whose id contains `-dummy-` are excluded from
     the item list, search and random picks (still resolvable as recipe
     ingredients and by URL).
2. **2 duplicated display names** — "Cargo rocket silo" and "Energy beam
   injector" each exist twice as genuinely distinct entities (delivery
   variants). Indistinguishable in search results.
   - [x] Mitigation: search results sharing a label get the raw id
     appended ("Cargo rocket silo (se-rocket-launch-pad)").
3. **28 orphaned items** — appear in no recipe at all; nearly all are
   `se-decompressing-steam-<temp>` temperature variants (FactorioLab models
   steam temperatures as separate items). Their item pages show
   "Ingredient in 0 recipes / Result of 0 recipes".
   - [x] Mitigation: recipe-less items are hidden from the list, search
     and random picks — except machines, which stay listable even when no
     bundled recipe crafts them (this keeps SE's grounded/spaced building
     variants visible). Pages remain reachable by URL. sxp: 899 → 889
     listed (2 dummies + 8 orphaned steam variants).
4. **16 items rely on `iconText`** — the icon-overlay text (steam
   temperature numbers) that FactorioLab renders on top of a shared icon. We
   ignore `iconText`, so all steam variants currently show an identical icon.
   - [x] Mitigation: the generated icon CSS emits an `::after` overlay rule
     with the iconText (white, dark-outlined, bottom-right), so steam
     variants are visually distinguishable — verified on sxp's internal
     turbine steam icons.
5. **20 items in category `other`** — SE's grounded/spaced building variants
   (`se-*-grounded`, `se-fuel-refinery-spaced`, …). Real entities, slightly
   noisy in the list. No action planned.
6. **Version basis mismatch** — FactorioLab's sxp is **Factorio 1.1.109 +
   SE 0.6.138**, while the fbe fork's own SE pack is SE 0.7.56 on Factorio
   2.0.76. Content differs accordingly (recipes, buildings, balancing).
   Accepted until the own-pack adapter exists — this, not the cosmetic
   quirks above, is the real reason the custom exporter will eventually be
   worth it.

## Next steps (roadmap, in leverage order)

1. **Exact packs without the custom exporter (the cheap big win).**
   FactorioLab's export pipeline is an MIT-licensed Factorio *mod*
   ([`factoriolab/factoriolab-export`](https://github.com/factoriolab/factoriolab-export)):
   load the exact mod set (e.g. the fbe fork's SE 0.7.56 on Factorio 2.0.76)
   in a local Factorio and it dumps `data.json` + `icons.png` in exactly the
   format this app already consumes. Host the two files anywhere with CORS
   (the fbe fork's Pages data dir, or the future data repo — never this
   repo), and it's **one new entry in `src/api/static/packs.ts`, zero code
   changes**. Closes the sxp version-basis gap (quirk #6). Descriptions
   remain out of reach (the FL schema has none).
2. **More ready-made FactorioLab packs** are one manifest entry away if ever
   wanted: `kr2` (Krastorio 2), `kr2sxp`, `sea` (Sea Block), `pys`
   (Pyanodons), `bobang`, `ir3`, `nls`, vanilla `1.1`, and more — see
   `factoriolab/factoriolab` `src/data/datasets.ts` for the registry.
3. **Data plane (fbe-side, resolves fbe issue #8).** Evict `data/output/`
   from the fbe repo into a dedicated data repo with its own Pages deploy;
   fbe consumes via `VITE_DATA_URL` (proven by its PR previews); the packs
   from step 1 live on the same host. Cross-link the two repos' docs — fbe's
   currently don't mention this fork at all.
4. **Custom exporter browser-artifacts** (descriptions, multi-locale labels)
   only when step 1's FL-format output feels limiting. Park until then.

**Machine "Can craft" list — UI alternatives (parked).** The shipped version
reuses the paginated recipe list from the item page, so a machine that produces
hundreds of recipes (an assembler) is bounded by the same "Load more" widget as
the other lists — fine in practice. Two denser presentations were considered and
deferred, neither needed yet:
- **Icon grid** instead of a text list — denser for long lists, but a bigger
  change: `EntityList`/`Entity` render name + recipe rows, so it wants a compact
  icon-only entity variant (reusable elsewhere, non-trivial).
- **Dedicated "show all crafted" route** — the machine page shows a short preview
  (first page) linking out to a full grid/list, keeping the item page light.
  Cleanest if a preview-vs-full split is wanted; costs a new route (×3 variants)
  plus a small store/page.

Housekeeping still pending: GitHub Issues are disabled on this fork — once
enabled, mirror this checklist into a tracking issue (see CLAUDE.md).

**Per-PR previews (evaluated, not planned):** fbe's `pr-preview/pr-N/`
pattern relies on branch-based Pages deployment (directories coexist on the
`gh-pages` branch). This repo deploys via the "GitHub Actions" source, where
each deployment replaces the whole site — previews would require switching
to branch-based deploys plus a per-PR `BASE_PATH`. Skipped for now: builds
are ~10 s and the e2e suite already exercises the deployed shape (subpath +
404 fallback) on every push.

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
