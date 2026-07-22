import { expect, Page, test } from "@playwright/test";

/**
 * End-to-end coverage of the static fork against live FactorioLab data, served with
 * GitHub Pages semantics (path prefix + 404.html fallback) by e2e/server.js.
 *
 * Pack ids: the synthetic combination ids live in src/api/static/packs.ts; the short
 * forms appearing in URLs are their base62 encodings.
 */
// The 22-char base62 encoding of a synthetic combination id.
const SHORT_ID_PATTERN = "[0-9a-zA-Z]{22}";
// Anchored to a path segment (leading slash + trailing-slash lookahead, capture group 1)
// so extracting it from a URL can never accidentally latch onto an asset contenthash.
const SHORT_ID = new RegExp(`/(${SHORT_ID_PATTERN})(?=/)`);
const SXP_FULL_ID = "fab1a000-0000-4000-8000-000000000003";

// The header search field (desktop inline box / opened mobile drawer both expose it).
const SEARCH_INPUT = ".header-search input[type=search]";

async function gotoItemList(page: Page, path = "/items"): Promise<void> {
    await page.goto(path);
    await expect(page.locator("a[href*='/item/']").first()).toBeVisible();
}

test("boots via the 404 fallback and redirects to the short-id URL", async ({ page }) => {
    await gotoItemList(page);

    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID_PATTERN}/items`));
    expect(await page.locator("a[href*='/item/'], a[href*='/fluid/']").count()).toBeGreaterThan(100);
});

test("item icons render from the pack spritesheet", async ({ page }) => {
    await gotoItemList(page);

    // The icon CSS is injected asynchronously after the batched style request resolves.
    await expect
        .poll(() =>
            page
                .locator("a[href*='/item/']")
                .first()
                .evaluate((el) => getComputedStyle(el).backgroundImage),
        )
        .toContain("icons.webp");
});

test("item details show recipes and fill the sidebar", async ({ page }) => {
    await gotoItemList(page);

    await page.locator("a[href*='/item/']").first().click();
    await expect(page.locator(".entity").first()).toBeVisible();
    await expect(page.locator("h1")).toContainText(/Item:/);

    // The visited item lands in the "Last viewed" sidebar (persisted to localStorage).
    await expect(page.locator(".sidebar-entity, [class*=sidebar] .entity").first()).toBeVisible();
});

test("recipe details list producing machines", async ({ page }) => {
    await gotoItemList(page);
    const url = page.url();
    const shortId = (url.match(SHORT_ID) || ["", ""])[1];

    await page.goto(`/${shortId}/recipe/electronic-circuit`);
    await expect(page.locator(".machine-entity").first()).toBeVisible();
    expect(await page.locator(".machine-entity").count()).toBeGreaterThan(0);
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
    expect(packOptions.join(",")).toContain("Space Age");

    const spaceAgeValue = await page
        .locator("select")
        .first()
        .evaluate(
            (el: HTMLSelectElement) =>
                Array.from(el.options).find((option) => /Space Age/.test(option.textContent || ""))?.value,
        );
    await page.locator("select").first().selectOption(spaceAgeValue as string);
    await page.locator(".button", { hasText: "Change to" }).click();

    // Wait for the app to boot on the new pack before navigating on: the boot also
    // persists the last-pack memory that the id-less visit below relies on.
    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID_PATTERN}`));
    await expect(page.locator("text=Setting: Space Age").first()).toBeVisible();

    // An id-less visit remembers the switched pack (localStorage last-pack fallback).
    await gotoItemList(page, "/items");
    await expect(page.locator("text=Setting: Space Age").first()).toBeVisible();
});

test.describe("Space Exploration (sxp)", () => {
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
