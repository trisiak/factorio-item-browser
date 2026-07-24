import { CombinationId } from "../../class/CombinationId";
import { StorageManager } from "../../class/StorageManager";
import { ServiceNotAvailableError } from "../../error/page";
import { clearPackDataCache, StaticPortalApi } from "./StaticPortalApi";
import { FbeCatalog, FbeIcons } from "./fbe";
import { packs } from "./packs";

/**
 * The fbe browser artifact adapter, exercised end-to-end through the static api (like the
 * FactorioLab tests do) so the mapping, the icon CSS and the format validation are all
 * covered against the same synthetic fixture.
 *
 * The fixture is deliberately unlike any real game data — no dump of ours is ever committed
 * here (see CLAUDE.md) — but it mirrors the shapes the real catalogs use: items and fluids
 * as separate display-ordered arrays sharing the 2.0 `parameter-N` id, a recipe without an
 * own icon, descriptions only where the game has one, real research-unit counts, a formula
 * technology without a count, and a trigger technology without a unit at all.
 */
const catalog: FbeCatalog = {
    schemaVersion: 1,
    generated: "2026-01-01T00:00:00Z",
    pack: {
        id: "test-pack",
        label: "Test pack",
        factorioVersion: "2.0",
        mods: [
            { name: "base", version: "2.0.76" },
            { name: "mod-alpha", version: "1.2.3" },
        ],
    },
    items: [
        {
            id: "widget",
            label: "Widget",
            description: "A widget.",
            stackSize: 50,
            group: "parts",
            subgroup: "small",
            iconId: "item/widget",
        },
        { id: "gizmo", label: "Gizmo", stackSize: 50, group: "parts", subgroup: "small", iconId: "item/gizmo" },
        {
            id: "assembler",
            label: "Assembler",
            stackSize: 10,
            group: "production",
            subgroup: "machine",
            iconId: "item/assembler",
            machine: { speed: 1.5, moduleSlots: 2, energyUsageKw: 1500, craftingCategories: ["parts"] },
        },
        {
            id: "parameter-0",
            label: "Parameter 0",
            stackSize: 1,
            group: "other",
            subgroup: "parameters",
            iconId: "item/parameter-0",
        },
    ],
    fluids: [
        { id: "goo", label: "Goo", description: "Sticky.", group: "fluids", subgroup: "fluid", iconId: "fluid/goo" },
        // Same id as the item above: 2.0 publishes blueprint parameters in both namespaces.
        {
            id: "parameter-0",
            label: "Parameter 0",
            group: "other",
            subgroup: "parameters",
            iconId: "fluid/parameter-0",
        },
    ],
    recipes: [
        {
            id: "gizmo",
            label: "Gizmo",
            description: "Assemble a gizmo.",
            time: 1.5,
            category: "parts",
            ingredients: [
                { type: "item", id: "widget", amount: 2 },
                { type: "fluid", id: "goo", amount: 2.5 },
            ],
            results: [{ type: "item", id: "gizmo", amount: 1 }],
            producers: ["assembler"],
            // No iconId: the recipe shares its first result's icon.
        },
        {
            id: "widget-casting",
            label: "Casting widget",
            time: 2,
            category: "parts",
            ingredients: [{ type: "fluid", id: "goo", amount: 10 }],
            results: [{ type: "item", id: "widget", amount: 1, probability: 0.5 }],
            producers: ["assembler"],
            iconId: "recipe/widget-casting",
        },
    ],
    technologies: [
        {
            id: "widget-tech",
            label: "Widget technology",
            description: "Unlocks widget casting.",
            prerequisites: [],
            unlocks: ["widget-casting"],
            iconId: "technology/widget-tech",
            unit: { count: 200, time: 15, ingredients: [{ id: "widget", amount: 1 }] },
        },
        {
            id: "gizmo-tech",
            label: "Gizmo technology",
            prerequisites: ["widget-tech"],
            unlocks: ["gizmo"],
            iconId: "technology/gizmo-tech",
            // An infinite technology: a formula instead of a fixed unit count.
            unit: { time: 60, ingredients: [{ id: "widget", amount: 2 }] },
            countFormula: "2^L*1000",
            maxLevel: "infinite",
        },
        {
            id: "trigger-tech",
            label: "Trigger technology",
            prerequisites: [],
            unlocks: [],
            iconId: "technology/trigger-tech",
            researchTrigger: "craft-item",
        },
    ],
};

// A 196x130 sheet, so the percentage math has exact values: background-size x =
// 196/64*100 = 306.25%, and the icon at x = 66 sits at 66/(196-64)*100 = 50%.
const icons: FbeIcons = {
    schemaVersion: 1,
    sheet: { file: "icons.webp", width: 196, height: 130, cell: 64, padding: 2 },
    icons: {
        "item/widget": { x: 0, y: 0 },
        "item/gizmo": { x: 66, y: 0 },
        "item/assembler": { x: 132, y: 0 },
        "fluid/goo": { x: 0, y: 66 },
        "recipe/widget-casting": { x: 66, y: 66 },
        "technology/widget-tech": { x: 132, y: 66 },
    },
};

const fbePack = packs.find((pack) => pack.source.kind === "fbe") as (typeof packs)[number];

/** An Image that fails the test if it is ever constructed: fbe sheets are never measured. */
class ForbiddenImage {
    public constructor() {
        throw new Error("The fbe icon sheet must not be measured — icons.json carries its dimensions.");
    }
}

/**
 * Builds an api for the fbe pack whose downloads resolve to the given catalog/icons files,
 * serving each by URL suffix the way the real host does.
 */
function apiFor(catalogData: unknown, iconsData: unknown): StaticPortalApi {
    clearPackDataCache();
    (global as { fetch?: unknown }).fetch = jest.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => (url.endsWith("/icons.json") ? iconsData : catalogData),
    }));

    const storageManager = new StorageManager(window.localStorage);
    storageManager.combinationId = CombinationId.fromFull(fbePack.combinationId);
    return new StaticPortalApi(storageManager);
}

describe("fbe pack adapter", (): void => {
    let api: StaticPortalApi;

    beforeEach((): void => {
        window.localStorage.clear();
        (window as unknown as { Image: unknown }).Image = ForbiddenImage;
        api = apiFor(catalog, icons);
    });

    test("merges items and fluids into one display-ordered list, items winning shared ids", async (): Promise<void> => {
        const itemList = await api.getItemList(1);

        // Items in catalog order first, then the fluids; the duplicate "parameter-0" fluid is
        // dropped in favor of the item of that id.
        expect(itemList.results).toEqual([
            { type: "item", name: "widget" },
            { type: "item", name: "gizmo" },
            { type: "item", name: "assembler" },
            { type: "item", name: "parameter-0" },
            { type: "fluid", name: "goo" },
        ]);
        expect(itemList.numberOfResults).toBe(5);
    });

    test("lists every published recipe in catalog order and resolves ingredient types", async (): Promise<void> => {
        expect((await api.getRecipeList(1)).results).toEqual([
            { name: "gizmo", label: "Gizmo" },
            { name: "widget-casting", label: "Casting widget" },
        ]);

        const details = await api.getRecipeDetails("gizmo");
        expect(details.recipe?.craftingTime).toBe(1.5);
        expect(details.recipe?.ingredients).toEqual([
            { type: "item", name: "widget", label: "Widget", amount: 2 },
            { type: "fluid", name: "goo", label: "Goo", amount: 2.5 },
        ]);
        expect(details.recipe?.products).toEqual([{ type: "item", name: "gizmo", label: "Gizmo", amount: 1 }]);
    });

    test("populates the descriptions the artifact carries, and empties the ones it omits", async (): Promise<void> => {
        expect((await api.getRecipeDetails("gizmo")).description).toBe("Assemble a gizmo.");
        expect((await api.getRecipeDetails("widget-casting")).description).toBe("");

        expect((await api.getItemProductRecipes("item", "widget", 1)).description).toBe("A widget.");
        expect((await api.getItemProductRecipes("fluid", "goo", 1)).description).toBe("Sticky.");
        expect((await api.getItemProductRecipes("item", "gizmo", 1)).description).toBe("");

        expect((await api.getTechnology("widget-tech")).description).toBe("Unlocks widget casting.");
        expect((await api.getTechnology("gizmo-tech")).description).toBeUndefined();
    });

    test("carries the real research-unit counts, formulas and trigger technologies", async (): Promise<void> => {
        const counted = await api.getTechnology("widget-tech");
        expect(counted.researchCount).toBe(200);
        expect(counted.researchTime).toBe(15);
        expect(counted.researchCountFormula).toBeUndefined();
        expect(counted.ingredients).toEqual([{ type: "item", name: "widget", label: "Widget", amount: 1 }]);
        expect(counted.unlockedRecipes.map((entity) => entity.name)).toEqual(["widget-casting"]);
        expect(counted.unlockedTechnologies).toEqual([{ name: "gizmo-tech", label: "Gizmo technology" }]);

        // An infinite technology has no fixed count, only its level formula.
        const infinite = await api.getTechnology("gizmo-tech");
        expect(infinite.researchCount).toBeUndefined();
        expect(infinite.researchCountFormula).toBe("2^L*1000");
        expect(infinite.researchTime).toBe(60);
        expect(infinite.prerequisites).toEqual([{ name: "widget-tech", label: "Widget technology" }]);

        // A trigger technology carries no unit at all.
        const trigger = await api.getTechnology("trigger-tech");
        expect(trigger.researchTime).toBe(0);
        expect(trigger.researchCount).toBeUndefined();
        expect(trigger.ingredients).toEqual([]);
    });

    test("orders the technology list by total research cost, prerequisites first", async (): Promise<void> => {
        // trigger-tech is free, widget-tech costs 200 x 15 s, and gizmo-tech can only follow
        // its prerequisite even though its own per-unit cost is smaller.
        expect((await api.getTechnologyList(1)).results.map((technology) => technology.name)).toEqual([
            "trigger-tech",
            "widget-tech",
            "gizmo-tech",
        ]);
    });

    test("finds the technologies unlocking a recipe and an item", async (): Promise<void> => {
        expect((await api.getRecipeResearch("widget-casting")).map((technology) => technology.name)).toEqual([
            "widget-tech",
        ]);

        const research = await api.getItemResearch("item", "gizmo");
        expect(research.technologies.map((technology) => technology.name)).toEqual(["gizmo-tech"]);
        expect(research.technologies[0].researchCountFormula).toBe("2^L*1000");
    });

    test("maps machines with their module slots and scaled energy usage", async (): Promise<void> => {
        const machines = await api.getRecipeMachines("gizmo", 1);

        expect(machines.numberOfResults).toBe(1);
        expect(machines.results[0]).toEqual({
            name: "assembler",
            label: "Assembler",
            craftingSpeed: 1.5,
            // The artifact publishes no slot counts; 255 renders as "unlimited".
            numberOfItems: 255,
            numberOfFluids: 255,
            numberOfModules: 2,
            energyUsage: 1.5,
            energyUsageUnit: "MW",
        });

        // ...and the inverse lookup lists what the machine can craft.
        const crafted = await api.getMachineRecipes("item", "assembler", 1);
        expect(crafted.results.map((entity) => entity.name)).toEqual(["gizmo", "widget-casting"]);
    });

    test("builds the icon CSS from the sheet dimensions, without loading the image", async (): Promise<void> => {
        const result = await api.getIconsStyle({
            cssSelector: ".icon-{type}-{name}",
            entities: {
                item: ["gizmo", "unknown-thing"],
                fluid: ["goo"],
                recipe: ["gizmo", "widget-casting"],
                machine: ["assembler"],
                technology: ["widget-tech"],
            },
        });

        expect(result.processedEntities).toEqual({
            item: ["gizmo"],
            fluid: ["goo"],
            recipe: ["gizmo", "widget-casting"],
            machine: ["assembler"],
            technology: ["widget-tech"],
        });

        // Same percentage geometry as the FactorioLab sheets (64 px cells, 66 px stride), but
        // taken from icons.json — the ForbiddenImage above would have thrown otherwise.
        expect(result.style).toContain(
            `.icon-item-gizmo{background-image:url("${fbePack.source.baseUrl}/icons.webp");` +
                "background-size:306.25% 203.125%;background-position:50% 0%;}",
        );
        expect(result.style).toContain("background-position:0% 100%;}");
        expect(result.style).not.toContain("unknown-thing");
    });

    test("falls back to the first result's icon for recipes without an own icon", async (): Promise<void> => {
        const result = await api.getIconsStyle({
            cssSelector: ".icon-{type}-{name}",
            entities: { recipe: ["gizmo", "widget-casting"] },
        });

        // "gizmo" has no iconId and reuses the gizmo item's cell (x = 66 → 50%)...
        expect(result.style).toContain(".icon-recipe-gizmo{background-image");
        expect(result.style).toContain("background-position:50% 0%;}");
        // ...while "widget-casting" has its own recipe icon (66, 66 → 50% / 100%).
        expect(result.style).toContain(".icon-recipe-widget-casting{background-image");
        expect(result.style).toContain("background-position:50% 100%;}");
    });

    test("reports the exact mod set of the pack", async (): Promise<void> => {
        expect(await api.getSettingMods(fbePack.combinationId)).toEqual([
            { name: "base", label: "base", author: "", version: "2.0.76" },
            { name: "mod-alpha", label: "mod-alpha", author: "", version: "1.2.3" },
        ]);
    });

    test("downloads the catalog and the icons once per pack", async (): Promise<void> => {
        await api.getItemList(1);
        await api.getIconsStyle({ cssSelector: ".icon-{type}-{name}", entities: { item: ["gizmo"] } });
        await api.search("widget", 1);

        expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledTimes(2);
    });

    test("a malformed catalog fails with a legible error naming the pack", async (): Promise<void> => {
        const badApi = apiFor({ schemaVersion: 1, items: [], fluids: [], recipes: [] }, icons);
        await expect(badApi.getItemList(1)).rejects.toBeInstanceOf(ServiceNotAvailableError);
        await expect(badApi.getItemList(1)).rejects.toThrow(new RegExp(`catalog of pack "${fbePack.id}" is malformed`));
    });

    test("a malformed icons file fails with a legible error", async (): Promise<void> => {
        const badApi = apiFor(catalog, { schemaVersion: 1, icons: {} });
        await expect(badApi.getItemList(1)).rejects.toBeInstanceOf(ServiceNotAvailableError);
    });

    test("a sheet without valid file/dimensions fails loudly instead of degrading", async (): Promise<void> => {
        // The contract guarantees file + positive dimensions; zero, missing or
        // non-numeric values must be a clear pack-named error, never NaN CSS or a
        // silent fall-back to image measuring.
        for (const sheet of [
            { file: "icons.webp", width: 0, height: 832 },
            { file: "icons.webp", height: 832 },
            { file: "", width: 1024, height: 832 },
            { file: "icons.webp", width: "1024", height: 832 },
        ]) {
            const badApi = apiFor(catalog, { schemaVersion: 1, sheet, icons: {} });
            await expect(badApi.getItemList(1)).rejects.toThrow(
                new RegExp(`icons of pack "${fbePack.id}" are malformed`),
            );
        }
    });
});
