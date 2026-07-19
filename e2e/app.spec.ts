import { expect, Page, test } from "@playwright/test";

/**
 * End-to-end coverage of the static fork against live FactorioLab data, served with
 * GitHub Pages semantics (path prefix + 404.html fallback) by e2e/server.js.
 *
 * Pack ids: the synthetic combination ids live in src/api/static/packs.ts; the short
 * forms appearing in URLs are their base62 encodings.
 */
const SHORT_ID = /[0-9a-zA-Z]{22}/;
const SXP_FULL_ID = "fab1a000-0000-4000-8000-000000000003";

async function gotoItemList(page: Page, path = "/items"): Promise<void> {
    await page.goto(path);
    await expect(page.locator("a[href*='/item/']").first()).toBeVisible();
}

test("boots via the 404 fallback and redirects to the short-id URL", async ({ page }) => {
    await gotoItemList(page);

    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID.source}/items`));
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
    const shortId = (url.match(SHORT_ID) || [""])[0];

    await page.goto(`/${shortId}/recipe/electronic-circuit`);
    await expect(page.locator(".machine-entity").first()).toBeVisible();
    expect(await page.locator(".machine-entity").count()).toBeGreaterThan(0);
});

test("machine item page lists the recipes it can craft", async ({ page }) => {
    await gotoItemList(page);
    const shortId = (page.url().match(SHORT_ID) || [""])[0];

    await page.goto(`/${shortId}/item/assembling-machine-3`);
    // The "Can craft" section only appears for machines and holds many recipe entities.
    await expect(page.locator("h2", { hasText: /Can craft/ })).toBeVisible();
    const section = page.locator("section", { has: page.locator("h2", { hasText: /Can craft/ }) });
    expect(await section.locator(".entity").count()).toBeGreaterThan(1);
});

test("search finds items", async ({ page }) => {
    await gotoItemList(page);

    await page.fill("input", "iron");
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
    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID.source}`));
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

        await page.fill("input", "cargo rocket");
        await expect(page.locator(".entity").first()).toBeVisible();

        const labels = await page.locator(".entity h3").allTextContents();
        const silos = labels.filter((label) => label.startsWith("Cargo rocket silo"));
        expect(silos.length).toBeGreaterThan(1);
        expect(new Set(silos).size).toBe(silos.length);
        expect(labels.join(",")).not.toContain("Hidden");
    });

    test("iconText overlays distinguish steam-temperature variants", async ({ page }) => {
        await gotoItemList(page, `/${SXP_FULL_ID}/items`);

        await page.fill("input", "decompressing");
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
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        await page.goto(`/${shortId}/recipe/electronic-circuit`);
        await expect(page.locator(".recipe-details").first()).toBeVisible();
        // The ingredients-to-products chevron separator only renders at medium and up.
        await expect(page.locator(".recipe-item-separator")).toHaveCount(0);
    });
});

test.describe("technology", () => {
    test("item links to its unlocking technology, whose page is traversable", async ({ page }) => {
        await gotoItemList(page);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

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
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

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
});
