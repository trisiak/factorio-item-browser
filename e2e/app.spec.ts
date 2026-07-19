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
