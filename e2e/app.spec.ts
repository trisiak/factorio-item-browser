import { expect, Page, test } from "@playwright/test";

/**
 * End-to-end coverage of the static fork against live pack data, served with GitHub Pages
 * semantics (path prefix + 404.html fallback) by e2e/server.js. Nothing is mocked, so the
 * suite doubles as a canary for data drift on both sources it fetches:
 *
 *  - **our own data plane** (the fbe fork's published `browser/` artifacts, see
 *    docs/data-plane.md) — `vanilla-2.0-fbe` is the default pack, so every spec that does
 *    not pin a combination id exercises it;
 *  - **FactorioLab** — kept under test by the specs that pin a FactorioLab pack via its
 *    long-form combination id, because the quirks they cover (dummy pseudo-items,
 *    duplicate display names, iconText overlays) are artifacts of that source alone.
 *
 * Pack ids: the synthetic combination ids live in src/api/static/packs.ts; the short
 * forms appearing in URLs are their base62 encodings.
 */
// The 22-char base62 encoding of a synthetic combination id.
const SHORT_ID_PATTERN = "[0-9a-zA-Z]{22}";
// Anchored to a path segment (leading slash + trailing-slash lookahead, capture group 1)
// so extracting it from a URL can never accidentally latch onto an asset contenthash.
const SHORT_ID = new RegExp(`/(${SHORT_ID_PATTERN})(?=/)`);
// The FactorioLab-sourced Space Exploration pack (Factorio 1.1 basis).
const SXP_FULL_ID = "fab1a000-0000-4000-8000-000000000003";
// The fbe-sourced Space Exploration pack — the same mod on Factorio 2.0 (SE 0.7.56).
const FBE_SXP_FULL_ID = "fab1a000-0000-4000-8000-000000000013";
// The spritesheets our own artifacts publish, which the generated icon CSS must reference.
const FBE_DATA_ROOT = "https://trisiak.github.io/factorio-pack-data";
const FBE_VANILLA_SHEET = `${FBE_DATA_ROOT}/vanilla-2.0/browser/icons.webp`;
const FBE_SXP_SHEET = `${FBE_DATA_ROOT}/space-exploration/browser/icons.webp`;
// The two Space Age entries in the settings picker. Their labels differ only by the source
// suffix, so pack selection must match a full option label, never a substring.
const FBE_SPACE_AGE_LABEL = "Space Age (2.0)";
const FL_SPACE_AGE_LABEL = "Space Age (2.0) (FactorioLab)";
// The default pack's name, as the sidebar/header renders it. Matched exactly (quoted text
// engine) so it cannot also match the "Vanilla 2.0 (FactorioLab)" entry.
const DEFAULT_PACK_SETTING = 'text="Setting: Vanilla 2.0"';

// The header search field (desktop inline box / opened mobile drawer both expose it).
const SEARCH_INPUT = ".header-search input[type=search]";

async function gotoItemList(page: Page, path = "/items"): Promise<void> {
    await page.goto(path);
    await expect(page.locator("a[href*='/item/']").first()).toBeVisible();
}

test("boots via the 404 fallback and redirects to the short-id URL", async ({ page }) => {
    await gotoItemList(page);

    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID_PATTERN}/items`));
    // With no stored state, an id-less visit resolves to the default pack — the fbe-sourced
    // vanilla set (src/api/static/packs.ts), not the identically-shaped FactorioLab entry.
    await expect(page.locator(DEFAULT_PACK_SETTING).first()).toBeVisible();
    // 200 items + 8 fluids in that catalog; asserted loosely to tolerate regenerations.
    expect(await page.locator("a[href*='/item/'], a[href*='/fluid/']").count()).toBeGreaterThan(100);
});

test("item icons render from the pack spritesheet", async ({ page }) => {
    await gotoItemList(page);

    // The icon CSS is injected asynchronously after the batched style request resolves, and
    // must point at the sheet our own artifact publishes next to its catalog — the file name
    // comes from icons.json, and its dimensions (also published there) drive the percentage
    // geometry without any image-measuring round trip.
    await expect
        .poll(() =>
            page
                .locator("a[href*='/item/']")
                .first()
                .evaluate((el) => getComputedStyle(el).backgroundImage),
        )
        .toContain(FBE_VANILLA_SHEET);
});

test("item details show recipes and fill the sidebar", async ({ page }) => {
    await gotoItemList(page);

    // The list keeps the catalog's display order, so the first tile is the first prototype of
    // the game's first item group — the wooden chest in vanilla.
    await expect(page.locator("a[href*='/item/']").first()).toHaveAttribute("href", /\/item\/wooden-chest$/);
    await page.locator("a[href*='/item/']").first().click();
    await expect(page.locator(".entity").first()).toBeVisible();
    await expect(page.locator("h1")).toContainText("Item: Wooden chest");

    // The visited item lands in the "Last viewed" sidebar (persisted to localStorage).
    await expect(page.locator(".sidebar-entity, [class*=sidebar] .entity").first()).toBeVisible();
});

test("recipe details list producing machines", async ({ page }) => {
    await gotoItemList(page);
    const url = page.url();
    const shortId = (url.match(SHORT_ID) || ["", ""])[1];

    await page.goto(`/${shortId}/recipe/electronic-circuit`);
    await expect(page.locator(".machine-entity").first()).toBeVisible();
    // The catalog bakes the producers into the recipe: the three assembling machines whose
    // crafting categories cover "crafting".
    expect(await page.locator(".machine-entity").count()).toBe(3);
    await expect(page.locator(".machine-entity h3").last()).toHaveText("Assembling machine 3");
});

test("machine item page lists the recipes it can craft", async ({ page }) => {
    await gotoItemList(page);
    const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

    await page.goto(`/${shortId}/item/assembling-machine-3`);
    // The "Can craft" section only appears for machines and holds many recipe entities.
    await expect(page.locator("h2", { hasText: /Can craft/ })).toBeVisible();
    const section = page.locator("section", { has: page.locator("h2", { hasText: /Can craft/ }) });
    expect(await section.locator(".entity").count()).toBeGreaterThan(1);
});

test("search finds items", async ({ page }) => {
    await gotoItemList(page);

    await page.locator(SEARCH_INPUT).fill("iron");
    await expect(page).toHaveURL(/\/search\/iron/);
    await expect(page.locator(".entity").first()).toBeVisible();
});

test("settings page switches packs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("select").first()).toBeVisible();

    const packOptions = await page
        .locator("select")
        .first()
        .evaluate((el: HTMLSelectElement) => Array.from(el.options).map((option) => option.textContent || ""));
    // Both sources are in the lineup, distinguishable only by the label suffix.
    expect(packOptions).toContain(FBE_SPACE_AGE_LABEL);
    expect(packOptions).toContain(FL_SPACE_AGE_LABEL);

    // Switch to the fbe-sourced Space Age pack. Matched on the FULL option label: the
    // FactorioLab entry's label contains this one as a prefix, so a substring match would
    // pick whichever entry the picker happens to sort first.
    const spaceAgeValue = await page
        .locator("select")
        .first()
        .evaluate(
            (el: HTMLSelectElement, label: string) =>
                Array.from(el.options).find((option) => (option.textContent || "").trim() === label)?.value,
            FBE_SPACE_AGE_LABEL,
        );
    await page.locator("select").first().selectOption(spaceAgeValue as string);
    await page.locator(".button", { hasText: "Change to" }).click();

    // Wait for the app to boot on the new pack before navigating on: the boot also
    // persists the last-pack memory that the id-less visit below relies on.
    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID_PATTERN}`));
    await expect(page.locator(`text="Setting: ${FBE_SPACE_AGE_LABEL}"`).first()).toBeVisible();

    // An id-less visit remembers the switched pack (localStorage last-pack fallback), i.e.
    // it no longer falls back to the default pack.
    await gotoItemList(page, "/items");
    await expect(page.locator(`text="Setting: ${FBE_SPACE_AGE_LABEL}"`).first()).toBeVisible();
    await expect(page.locator(DEFAULT_PACK_SETTING)).toHaveCount(0);
});

test.describe("Space Exploration, FactorioLab source (sxp)", () => {
    // These specs deliberately stay on the FactorioLab-sourced pack, pinned by its long-form
    // combination id so the default-pack flip cannot drag them onto our own data plane: every
    // behaviour under test is a mitigation of a FactorioLab artifact — mod-internal `-dummy-`
    // pseudo-items, entities sharing a display name, and the iconText overlays that tell
    // steam-temperature variants apart. Our own catalog has none of those (it carries the
    // game's real hidden flags and one steam fluid), so this is the FL adapter's coverage.
    test("loads via the long-form combination id and hides calculator artifacts", async ({ page }) => {
        await gotoItemList(page, `/${SXP_FULL_ID}/items`);

        // 889 listable items as of the audit; assert loosely to tolerate upstream updates.
        expect(await page.locator("a[href*='/item/'], a[href*='/fluid/']").count()).toBeGreaterThan(500);
        expect(await page.locator("a[href*='-dummy-']").count()).toBe(0);
    });

    test("search disambiguates duplicate names and hides dummies", async ({ page }) => {
        await gotoItemList(page, `/${SXP_FULL_ID}/items`);

        await page.locator(SEARCH_INPUT).fill("cargo rocket");
        await expect(page.locator(".entity").first()).toBeVisible();

        const labels = await page.locator(".entity h3").allTextContents();
        const silos = labels.filter((label) => label.startsWith("Cargo rocket silo"));
        expect(silos.length).toBeGreaterThan(1);
        expect(new Set(silos).size).toBe(silos.length);
        expect(labels.join(",")).not.toContain("Hidden");
    });

    test("iconText overlays distinguish steam-temperature variants", async ({ page }) => {
        await gotoItemList(page, `/${SXP_FULL_ID}/items`);

        await page.locator(SEARCH_INPUT).fill("decompressing");
        await expect(page.locator(".entity").first()).toBeVisible();

        // At least one result icon carries the ::after temperature overlay.
        const overlays = await page.locator(".entity .icon").evaluateAll((els) =>
            els.map((el) => getComputedStyle(el, "::after").content).filter((content) => /\d/.test(content)),
        );
        expect(overlays.length).toBeGreaterThan(0);
    });
});

test.describe("fbe data plane", () => {
    // What only our own artifacts carry (docs/data-plane.md): in-game descriptions, real
    // research-unit counts, the exact mod set, and Space Exploration on Factorio 2.0. The
    // vanilla specs run on the default pack; the SE ones pin the fbe SE combination id.

    test("the item page shows the item's in-game description", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        // One of the 36 vanilla items the locale dump has a description for. FactorioLab
        // carries none at all, so this text can only come from our own catalog.
        await page.goto(`/${shortId}/item/landfill`);
        await expect(page.locator("h1")).toContainText("Item: Landfill");
        await expect(page.locator(".details-head .detail").first()).toHaveText(
            "Can be placed on water to create terrain you can build on.",
        );
    });

    test("a technology page shows the real research-unit count", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        // Automation costs 10 units of 1 automation science pack at 10s each. FactorioLab
        // models research as a recipe and drops the count, so the row is absent there.
        await page.goto(`/${shortId}/technology/automation`);
        await expect(page.locator("h1")).toContainText("Technology: Automation");
        await expect(page.locator("h2", { hasText: "Research cost" })).toBeVisible();

        const countRow = page.locator(".recipe-item", { hasText: "Research units" });
        await expect(countRow).toBeVisible();
        await expect(countRow.locator(".amount")).toHaveText("× 10");

        // The technology description comes from the same dump.
        await expect(page.locator(".details-head .detail").first()).toHaveText(
            "Key technology for automatic mass production.",
        );
    });

    test("an infinite technology shows its level formula instead of a count", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        // Infinite technologies have no fixed unit count — the prototype states a formula
        // over the level instead, and it is rendered verbatim in the count's place.
        await page.goto(`/${shortId}/technology/mining-productivity-4`);
        await expect(page.locator("h1")).toContainText("Technology: Mining productivity");

        const countRow = page.locator(".recipe-item", { hasText: "Research units" });
        await expect(countRow).toBeVisible();
        await expect(countRow.locator(".amount")).toHaveText("× 2500*(L - 3)");
    });

    test("Space Exploration on Factorio 2.0 lists SE content with icons from its own sheet", async ({ page }) => {
        await gotoItemList(page, `/${FBE_SXP_FULL_ID}/items`);

        // 739 items + 35 fluids, all listable: the exporter applies the game's real hidden
        // flags, so there is nothing to filter out on this side.
        expect(await page.locator("a[href*='/item/'], a[href*='/fluid/']").count()).toBeGreaterThan(500);
        await expect(page.locator("a[href$='/item/se-rocket-launch-pad']").first()).toBeVisible();

        await expect
            .poll(() =>
                page
                    .locator("a[href$='/item/se-rocket-launch-pad']")
                    .first()
                    .evaluate((el) => getComputedStyle(el).backgroundImage),
            )
            .toContain(FBE_SXP_SHEET);
    });

    test("the Space Exploration pack reports its exact mod set", async ({ page }) => {
        // The catalog names every loaded mod with its version — the version basis this app
        // wanted (docs/static-fork.md quirk #6: FactorioLab's sxp pack is still on 1.1).
        await page.goto(`/${FBE_SXP_FULL_ID}/settings`);

        const mod = page.locator(".mod-entity", { has: page.locator("h3", { hasText: /^space-exploration$/ }) });
        await expect(mod).toBeVisible();
        await expect(mod).toContainText("0.7.56");
        await expect(page.locator(".mod-entity", { has: page.locator("h3", { hasText: /^base$/ }) })).toContainText(
            "2.0.76",
        );
    });

    test("recipe details show the recipe's own description", async ({ page }) => {
        // Recipe descriptions are rare (none in vanilla, 37 in SE) but they map through the
        // same locale dump as the item ones.
        await page.goto(`/${FBE_SXP_FULL_ID}/recipe/se-bio-sludge`);
        await expect(page.locator("h1")).toContainText("Recipe: Biosludge from Biomass");
        await expect(page.locator(".details-head .detail").first()).toHaveText(
            "The main way to generate biosludge long-term, this recipe can form part of a biosludge production loop.",
        );
    });
});

test.describe("mobile viewport (phone)", () => {
    // Portrait phone resolution, below both the medium (800px) and large (1200px)
    // breakpoints, so the responsive layout switches to its mobile form: the header
    // collapses to hamburger + search icons, the sidebar becomes an off-canvas drawer,
    // and medium-and-up affordances (recipe separator, tooltips) drop out.
    test.use({ viewport: { width: 390, height: 844 } });

    // The header icons are FontAwesome svgs tagged with data-icon; match on those so the
    // selectors don't depend on child order.
    const HAMBURGER = ".header-icon:has(svg[data-icon='bars'])";
    const SEARCH_ICON = ".header-icon:has(svg[data-icon='search'])";

    async function sidebarLeft(page: Page): Promise<number> {
        return (await page.locator(".sidebar").boundingBox())?.x ?? 0;
    }

    test("collapses the header to hamburger + search icons instead of the inline search box", async ({ page }) => {
        await gotoItemList(page);

        await expect(page.locator(HAMBURGER)).toBeVisible();
        await expect(page.locator(SEARCH_ICON)).toBeVisible();
        // The desktop inline search box is not mounted in the collapsed mobile header.
        await expect(page.locator(".header-search")).toHaveCount(0);
    });

    test("hamburger opens the off-canvas sidebar drawer and the close icon dismisses it", async ({ page }) => {
        await gotoItemList(page);

        // Off-canvas by default: translated left of the viewport (negative x).
        expect(await sidebarLeft(page)).toBeLessThan(0);

        await page.locator(HAMBURGER).click();
        await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
        await expect.poll(() => sidebarLeft(page)).toBeGreaterThanOrEqual(0);
        // The dimming overlay behind the drawer only mounts in the open mobile state.
        await expect(page.locator(".sidebar-close-overlay")).toBeVisible();

        // The drawer's close icon slides it back off-canvas (at phone width the drawer
        // all but fills the viewport, so this X — not the thin overlay sliver — is the
        // reachable close control).
        await page.locator(".sidebar-close-icon").click();
        await expect(page.locator(".sidebar")).not.toHaveClass(/is-open/);
        await expect.poll(() => sidebarLeft(page)).toBeLessThan(0);
        await expect(page.locator(".sidebar-close-overlay")).toHaveCount(0);
    });

    test("search icon reveals the search field and searches, then the close icon dismisses it", async ({ page }) => {
        await gotoItemList(page);

        await page.locator(SEARCH_ICON).click();
        const input = page.locator(".header-search input[type=search]");
        await expect(input).toBeVisible();
        await expect(input).toBeFocused();

        await input.fill("iron");
        await expect(page).toHaveURL(/\/search\/iron/);
        await expect(page.locator(".entity").first()).toBeVisible();

        await page.locator(".header-search .close-icon").click();
        await expect(page.locator(".header-search")).toHaveCount(0);
        await expect(page.locator(SEARCH_ICON)).toBeVisible();
    });

    test("recipe details stack without the medium-and-up separator", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        await page.goto(`/${shortId}/recipe/electronic-circuit`);
        await expect(page.locator(".recipe-details").first()).toBeVisible();
        // The ingredients-to-products chevron separator only renders at medium and up.
        await expect(page.locator(".recipe-item-separator")).toHaveCount(0);
    });
});

test.describe("touch long-press tooltip drawer", () => {
    // A touch-capable phone: below the breakpoints, hover tooltips no longer fire from
    // touch-emulated events, so the long-press interaction is the only way to reveal
    // entity info. It opens the bottom-drawer presentation instead of the anchored
    // tooltip. We drive it with raw touch pointer events (Playwright has no long-press
    // primitive) and rely on the 500ms hold timer plus the async tooltip fetch.
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    async function openDrawer(page: Page): Promise<void> {
        const icon = page.locator("a[href*='/item/']").first();
        await expect(icon).toBeVisible();

        // Start a touch press on the icon; the hold timer fires the drawer.
        await icon.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 20, clientY: 20 });
        await expect(page.locator(".tooltip-drawer .sheet")).toBeVisible({ timeout: 5000 });
        await icon.dispatchEvent("pointerup", { pointerType: "touch", clientX: 20, clientY: 20 });
    }

    test("long-pressing an item icon opens the drawer inside the viewport, closable via its button", async ({
        page,
    }) => {
        await gotoItemList(page);
        await openDrawer(page);

        // The sheet is anchored to the bottom edge and never exceeds the viewport width.
        const viewport = page.viewportSize();
        const sheet = await page.locator(".tooltip-drawer .sheet").boundingBox();
        expect(sheet).not.toBeNull();
        expect(sheet!.x).toBeGreaterThanOrEqual(0);
        expect(sheet!.x + sheet!.width).toBeLessThanOrEqual(viewport!.width);
        expect(sheet!.y + sheet!.height).toBeGreaterThanOrEqual(viewport!.height - 1);

        // The dedicated close button dismisses the drawer.
        await page.locator(".tooltip-drawer .close").click();
        await expect(page.locator(".tooltip-drawer")).toHaveCount(0);
    });

    test("tapping the backdrop dismisses the drawer", async ({ page }) => {
        await gotoItemList(page);
        await openDrawer(page);

        await page.touchscreen.tap(5, 5);
        await expect(page.locator(".tooltip-drawer")).toHaveCount(0);
    });

    test("the backdrop dismisses on click, not pointerdown, so the tap cannot reach the page beneath", async ({
        page,
    }) => {
        await gotoItemList(page);
        await openDrawer(page);
        const urlBefore = page.url();

        // The bug was dismissing on pointerdown: that unmounts the drawer before the browser
        // resolves the tap's click, which Firefox/Safari then deliver to the item link beneath the
        // backdrop — an unwanted navigation. So a bare pointerdown must NOT dismiss.
        const backdrop = page.locator(".tooltip-drawer .backdrop");
        await backdrop.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 20, clientY: 120 });
        await expect(page.locator(".tooltip-drawer")).toBeVisible();

        // The click dismisses it. Because the drawer was still mounted, the browser resolved this
        // click to the backdrop (which consumes it) — it cannot have fallen through to a link.
        await backdrop.dispatchEvent("click");
        await expect(page.locator(".tooltip-drawer")).toHaveCount(0);
        expect(page.url()).toBe(urlBefore);
    });

    test("the drawer tracks the visual viewport so browser chrome cannot occlude it", async ({ page }) => {
        // Simulate a browser with 64px of bottom chrome (e.g. Firefox's bottom URL bar): the
        // visual viewport is then shorter than the 844px layout viewport. The drawer must size
        // to the visual viewport so its bottom-anchored sheet stays above that chrome instead
        // of being drawn behind it.
        const CHROME = 64;
        await page.addInitScript((chrome) => {
            const vv = {
                offsetTop: 0,
                offsetLeft: 0,
                pageTop: 0,
                pageLeft: 0,
                scale: 1,
                width: 390,
                height: 844 - chrome,
                addEventListener: (): void => {},
                removeEventListener: (): void => {},
                dispatchEvent: (): boolean => false,
            };
            Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
        }, CHROME);

        await gotoItemList(page);
        await openDrawer(page);

        const sheet = await page.locator(".tooltip-drawer .sheet").boundingBox();
        expect(sheet).not.toBeNull();
        // The sheet's bottom edge is clear of the simulated bottom chrome (it would sit at the
        // full 844px layout-viewport bottom if the drawer ignored the visual viewport).
        expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(844 - CHROME + 1);
    });

    test("the drawer's entity link navigates to the item page", async ({ page }) => {
        await gotoItemList(page);
        await openDrawer(page);

        await page.locator(".tooltip-drawer .entity-head").click();
        await expect(page).toHaveURL(/\/item\//);
        await expect(page.locator("h1")).toContainText(/Item:|Fluid:/);
        // Navigating away also closed the drawer (route-change handler).
        await expect(page.locator(".tooltip-drawer")).toHaveCount(0);
    });
});

test.describe("list grids", () => {
    test("the recipe grid renders icons and clicking one opens the recipe page", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        await page.goto(`/${shortId}/recipes`);
        // The grid holds recipe icons — many of them for vanilla.
        await expect(page.locator("a[href*='/recipe/']").first()).toBeVisible();
        expect(await page.locator("a[href*='/recipe/']").count()).toBeGreaterThan(50);

        await page.locator("a[href*='/recipe/']").first().click();
        await expect(page).toHaveURL(/\/recipe\//);
        await expect(page.locator("h1")).toContainText(/Recipe:/);
    });

    test("the technology grid renders icons and clicking one opens the technology page", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        await page.goto(`/${shortId}/technologies`);
        await expect(page.locator("a[href*='/technology/']").first()).toBeVisible();
        expect(await page.locator("a[href*='/technology/']").count()).toBeGreaterThan(20);

        await page.locator("a[href*='/technology/']").first().click();
        await expect(page).toHaveURL(/\/technology\//);
        await expect(page.locator("h1")).toContainText(/Technology:/);
    });

    test("the sidebar buttons navigate to the recipe and technology grids", async ({ page }) => {
        await gotoItemList(page);

        await page.locator(".sidebar-button", { hasText: "All recipes" }).click();
        await expect(page).toHaveURL(/\/recipes/);
        await expect(page.locator("a[href*='/recipe/']").first()).toBeVisible();

        await page.locator(".sidebar-button", { hasText: "All technologies" }).click();
        await expect(page).toHaveURL(/\/technologies/);
        await expect(page.locator("a[href*='/technology/']").first()).toBeVisible();
    });
});

test.describe("technology", () => {
    test("item links to its unlocking technology, whose page is traversable", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        // Electronic circuit is unlocked by the "Electronics" technology in vanilla.
        await page.goto(`/${shortId}/item/electronic-circuit`);
        await expect(page.locator("h2", { hasText: /Unlocked by/i })).toBeVisible();

        const techLink = page.locator("a[href*='/technology/']").first();
        await expect(techLink).toBeVisible();
        await techLink.click();

        await expect(page).toHaveURL(/\/technology\//);
        await expect(page.locator("h1")).toContainText(/Technology:/);
    });

    test("a mid-tree technology shows research cost and clickable prerequisites", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        await page.goto(`/${shortId}/technology/automation-2`);
        await expect(page.locator("h1")).toContainText("Automation 2");

        // Research cost lists the science packs as recipe items with amounts.
        await expect(page.locator("h2", { hasText: "Research cost" })).toBeVisible();
        await expect(page.locator(".recipe-item-list .recipe-item").first()).toBeVisible();

        // Prerequisites are themselves technology links, so the tree can be walked.
        const prerequisite = page.locator("section a[href*='/technology/']").first();
        await expect(prerequisite).toBeVisible();
        await prerequisite.click();
        await expect(page).toHaveURL(/\/technology\//);
    });

    test("technology page lists the technologies it leads to", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        // Automation is an early tech that other technologies depend on.
        await page.goto(`/${shortId}/technology/automation`);
        await expect(page.locator("h1")).toContainText("Automation");
        const leadsTo = page.locator("section:has(h2:has-text('Leads to')) a[href*='/technology/']").first();
        await expect(leadsTo).toBeVisible();
    });

    test("recipe page shows the technology that unlocks it", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || ["", ""])[1];

        // The electronic-circuit recipe is unlocked by the "Electronics" technology.
        await page.goto(`/${shortId}/recipe/electronic-circuit`);
        await expect(page.locator("h2", { hasText: /Unlocked by/i })).toBeVisible();

        const techLink = page.locator("a[href*='/technology/']").first();
        await expect(techLink).toBeVisible();
        await techLink.click();
        await expect(page).toHaveURL(/\/technology\//);
    });
});
