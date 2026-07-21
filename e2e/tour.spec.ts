import { expect, Page, test, TestInfo } from "@playwright/test";
import path from "path";

/**
 * Visual tour — a curated walk of the app's key UX surfaces that writes a full-page
 * screenshot of each into ./screenshots (gitignored — the shots contain game-derived
 * icons/data and must never be committed).
 *
 * This is NOT part of the functional e2e suite: it asserts almost nothing, it just
 * navigates and captures. Run it on demand when a change needs visual review, then
 * eyeball the images before deploying:
 *
 *     npm run test:e2e:tour           # → ./screenshots/*.png (+ attached to the HTML report)
 *
 * It runs against the same production build + live FactorioLab data as app.spec.ts
 * (see playwright.config.js), so the screenshots reflect the real deployed shape.
 *
 * Pack ids are the synthetic combination ids from src/api/static/packs.ts; navigating
 * by full id boots the app and redirects to the short-id URL.
 */

const SHORT_ID = /[0-9a-zA-Z]{22}/;

const PACKS = {
    vanilla: "fab1a000-0000-4000-8000-000000000001",
    spaceAge: "fab1a000-0000-4000-8000-000000000002",
    spaceExploration: "fab1a000-0000-4000-8000-000000000003",
} as const;

const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots");

/**
 * Capture a screenshot to ./screenshots and attach it to the HTML report. Full-page by
 * default; pass fullPage: false for fixed overlays (e.g. the off-canvas drawer) that a
 * full-page capture would stretch across the whole scrollable document.
 */
async function shot(page: Page, testInfo: TestInfo, name: string, { fullPage = true } = {}): Promise<void> {
    const file = path.join(SCREENSHOT_DIR, `${name}.png`);
    const buffer = await page.screenshot({ path: file, fullPage });
    await testInfo.attach(name, { body: buffer, contentType: "image/png" });
}

/** Navigate to an item list and wait for its links to render. */
async function gotoItemList(page: Page, packId: string): Promise<void> {
    await page.goto(`/${packId}/items`);
    await expect(page.locator("a[href*='/item/']").first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/factorio-item-browser/${SHORT_ID.source}/items`));
}

/**
 * Wait until the async icon CSS has been injected, so item icons are actually painted
 * in the screenshot rather than showing as blank tiles.
 *
 * The spritesheet background lives on different elements depending on the layout: the
 * item list paints it directly on the `<a href="/item/…">` tile, while entity boxes
 * (search results, detail pages) paint it on a child `<div class="icon …">`. Poll for
 * any element carrying it so this works across every surface in the tour.
 */
async function waitForIcons(page: Page): Promise<void> {
    await expect
        .poll(
            () =>
                page.evaluate(() =>
                    Array.from(document.querySelectorAll("a[href*='/item/'], a[href*='/fluid/'], .icon")).some((el) =>
                        getComputedStyle(el).backgroundImage.includes("icons.webp"),
                    ),
                ),
            { timeout: 20000 },
        )
        .toBe(true);
}

test.describe("visual tour — desktop", () => {
    // Above the 1200px large breakpoint: full inline header + persistent sidebar.
    test.use({ viewport: { width: 1280, height: 900 } });

    test("vanilla: item list", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-vanilla-items");
    });

    test("vanilla: item detail with recipes and sidebar", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        await waitForIcons(page);

        await page.locator("a[href*='/item/']").first().click();
        await expect(page.locator(".entity").first()).toBeVisible();
        await expect(page.locator("h1")).toContainText(/Item:/);
        await shot(page, testInfo, "desktop-vanilla-item-detail");
    });

    test("vanilla: item detail 'unlocked by' technology", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        // Electronic circuit is unlocked by the "Electronics" technology in vanilla.
        await page.goto(`/${shortId}/item/electronic-circuit`);
        await expect(page.locator("h2", { hasText: /Unlocked by/i })).toBeVisible();
        await expect(page.locator("a[href*='/technology/']").first()).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-vanilla-item-unlocked-by");
    });

    test("vanilla: technology detail with cost, prerequisites and unlocks", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        // Automation 2 shows all three sections: research cost, prerequisite
        // technologies (traversable) and the recipes it unlocks.
        await page.goto(`/${shortId}/technology/automation-2`);
        await expect(page.locator("h1")).toContainText("Automation 2");
        await expect(page.locator("h2", { hasText: "Research cost" })).toBeVisible();
        await expect(page.locator("h2", { hasText: /Requires researching/i })).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-vanilla-technology-detail");
    });

    test("vanilla: recipe detail with producing machines", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        await page.goto(`/${shortId}/recipe/electronic-circuit`);
        await expect(page.locator(".machine-entity").first()).toBeVisible();
        await shot(page, testInfo, "desktop-vanilla-recipe-detail");
    });

    test("vanilla: search results", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        await page.fill("input", "iron");
        await expect(page).toHaveURL(/\/search\/iron/);
        await expect(page.locator(".entity").first()).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-vanilla-search");
    });

    test("settings / pack switcher", async ({ page }, testInfo) => {
        await page.goto("/settings");
        await expect(page.locator("select").first()).toBeVisible();
        await shot(page, testInfo, "desktop-settings");
    });

    test("space age: item list", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.spaceAge);
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-space-age-items");
    });

    test("space exploration: item list", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.spaceExploration);
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-space-exploration-items");
    });

    test("space exploration: search disambiguation", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.spaceExploration);
        await page.fill("input", "cargo rocket");
        await expect(page.locator(".entity").first()).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "desktop-space-exploration-search");
    });
});

test.describe("visual tour — mobile", () => {
    // Portrait phone, below the medium/large breakpoints: collapsed header (hamburger +
    // search icons) and off-canvas sidebar drawer.
    test.use({ viewport: { width: 390, height: 844 } });

    const HAMBURGER = ".header-icon:has(svg[data-icon='bars'])";
    const SEARCH_ICON = ".header-icon:has(svg[data-icon='search'])";

    test("item list with collapsed header", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        await expect(page.locator(HAMBURGER)).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "mobile-vanilla-items");
    });

    test("off-canvas sidebar drawer open", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        await page.locator(HAMBURGER).click();
        await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
        await expect(page.locator(".sidebar-close-overlay")).toBeVisible();
        // Wait for the slide-in to finish (drawer fully on-screen, x >= 0) before
        // capturing, otherwise the shot catches it mid-animation off-canvas.
        await expect.poll(async () => (await page.locator(".sidebar").boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
        // Viewport-only: the drawer is a fixed overlay, so a full-page shot would leave
        // it pinned to the top over the whole scrollable item grid.
        await shot(page, testInfo, "mobile-sidebar-drawer", { fullPage: false });
    });

    test("search field revealed", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        await page.locator(SEARCH_ICON).click();
        const input = page.locator(".header-search input[type=search]");
        await expect(input).toBeVisible();
        await input.fill("iron");
        await expect(page).toHaveURL(/\/search\/iron/);
        await expect(page.locator(".entity").first()).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "mobile-search");
    });

    test("recipe detail stacked", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        await page.goto(`/${shortId}/recipe/electronic-circuit`);
        await expect(page.locator(".recipe-details").first()).toBeVisible();
        await shot(page, testInfo, "mobile-recipe-detail");
    });

    test("item detail 'unlocked by' technology", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        await page.goto(`/${shortId}/item/electronic-circuit`);
        await expect(page.locator("h2", { hasText: /Unlocked by/i })).toBeVisible();
        await expect(page.locator("a[href*='/technology/']").first()).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "mobile-item-unlocked-by");
    });

    test("technology detail with cost, prerequisites and unlocks", async ({ page }, testInfo) => {
        await gotoItemList(page, PACKS.vanilla);
        const shortId = (page.url().match(SHORT_ID) || [""])[0];

        await page.goto(`/${shortId}/technology/automation-2`);
        await expect(page.locator("h1")).toContainText("Automation 2");
        await expect(page.locator("h2", { hasText: "Research cost" })).toBeVisible();
        await expect(page.locator("h2", { hasText: /Requires researching/i })).toBeVisible();
        await waitForIcons(page);
        await shot(page, testInfo, "mobile-technology-detail");
    });

    test.describe("touch", () => {
        test.use({ hasTouch: true });

        test("long-press tooltip drawer", async ({ page }, testInfo) => {
            await gotoItemList(page, PACKS.vanilla);
            await waitForIcons(page);

            // Electronic circuit has recipes, so the drawer shows the full entity shape:
            // head link, compact recipe rows and the close button. Scoped to the grid tile
            // (.icon.large) because the opened drawer adds more links to the same item.
            const icon = page.locator("a.icon.large[href$='/item/electronic-circuit']");
            await icon.scrollIntoViewIfNeeded();
            await icon.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 20, clientY: 20 });
            await expect(page.locator(".tooltip-drawer .sheet")).toBeVisible({ timeout: 10000 });
            await icon.dispatchEvent("pointerup", { pointerType: "touch", clientX: 20, clientY: 20 });

            // Wait for the slide-in to finish (sheet docked to the bottom edge) and for the
            // drawer's own entity icons to paint, otherwise the shot catches it mid-animation
            // or with blank tiles.
            await expect
                .poll(async () => {
                    const viewport = page.viewportSize();
                    const sheet = await page.locator(".tooltip-drawer .sheet").boundingBox();
                    return sheet && viewport ? sheet.y + sheet.height - viewport.height : Number.MAX_SAFE_INTEGER;
                })
                .toBeLessThanOrEqual(1);
            await expect
                .poll(
                    () =>
                        page.evaluate(() =>
                            Array.from(document.querySelectorAll(".tooltip-drawer .icon")).some((el) =>
                                getComputedStyle(el).backgroundImage.includes("icons.webp"),
                            ),
                        ),
                    { timeout: 20000 },
                )
                .toBe(true);

            // Viewport-only: the drawer is a fixed overlay over the scrollable item grid.
            await shot(page, testInfo, "mobile-tooltip-drawer", { fullPage: false });
        });
    });
});
