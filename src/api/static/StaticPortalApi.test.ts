import { CombinationId } from "../../class/CombinationId";
import { StorageManager } from "../../class/StorageManager";
import { PageNotFoundError, ServiceNotAvailableError } from "../../error/page";
import { SettingStatus } from "../../util/const";
import { SidebarEntityData } from "../transfer";
import { clearPackDataCache, StaticPortalApi } from "./StaticPortalApi";
import { FactorioLabData, FactorioLabItem } from "./factoriolab";
import { packs } from "./packs";

// A fully synthetic dataset — deliberately not resembling any real game data.
const fixture: FactorioLabData = {
    version: {
        "mod-alpha": "1.2.3",
        "mod-beta": "4.5.6",
    },
    items: [
        { id: "widget", name: "Widget", category: "parts", row: 0, stack: 50 },
        { id: "gizmo", name: "Gizmo", category: "parts", row: 0, stack: 50 },
        { id: "goo", name: "Goo", category: "fluids", row: 1, iconText: "42" },
        { id: "thing-dummy-item", name: "Thing (Hidden)", category: "parts", row: 0 },
        { id: "residue", name: "Residue", category: "parts", row: 0 },
        { id: "doubler-a", name: "Doubler", category: "parts", row: 0 },
        { id: "doubler-b", name: "Doubler", category: "parts", row: 0 },
        {
            id: "assembler",
            name: "Assembler",
            category: "production",
            row: 2,
            stack: 10,
            machine: { speed: 1.5, modules: 2, usage: 1500 },
        },
        {
            id: "widget-tech",
            name: "Widget technology",
            category: "technology",
            row: 3,
            technology: {},
        },
        { id: "science-pack", name: "Science pack", category: "science", row: 4 },
        {
            id: "mining-tech",
            name: "Mining technology",
            category: "technology",
            row: 4,
            technology: { recipeUnlock: ["doubler-recipe"], prerequisites: ["widget-tech"] },
        },
    ],
    recipes: [
        {
            id: "gizmo-recipe",
            name: "Gizmo",
            category: "parts",
            row: 0,
            time: "3/2",
            producers: ["assembler"],
            in: { "widget": 2, "goo": "5/2", "thing-dummy-item": 1 },
            out: { gizmo: 1 },
        },
        {
            id: "doubler-recipe",
            name: "Doubler",
            category: "parts",
            row: 0,
            time: 1,
            producers: ["assembler"],
            in: { widget: 1 },
            out: { "doubler-a": 1, "doubler-b": 1 },
        },
        {
            id: "widget-tech-recipe",
            name: "Widget technology",
            category: "technology",
            row: 3,
            time: 10,
            producers: ["lab"],
            in: { widget: 1 },
            out: { "widget-tech": 1 },
            flags: ["technology"],
        },
        {
            id: "mining-tech",
            name: "Mining technology",
            category: "technology",
            row: 4,
            time: 10,
            producers: ["lab"],
            in: { "science-pack": 3 },
            out: { "mining-tech": 1 },
            flags: ["technology"],
        },
    ],
    icons: [
        { id: "widget", x: 0, y: 0 },
        { id: "gizmo", x: 66, y: 0 },
        { id: "goo", x: 0, y: 66 },
        { id: "assembler", x: 132, y: 0 },
        { id: "mining-tech", x: 132, y: 66 },
    ],
};

// jsdom never loads images; fake a 196x130 sheet so the percentage math has exact values:
// background-size x = 196/64*100 = 306.25%, gizmo position x = 66/(196-64)*100 = 50%.
class FakeImage {
    public naturalWidth = 196;
    public naturalHeight = 130;
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;

    public set src(value: string) {
        setTimeout(() => this.onload && this.onload(), 0);
    }
}

/**
 * Builds an api whose pack download resolves to the given data, for tests that need a dataset
 * other than the shared fixture (pagination sizing, malformed data). Resets the pack cache so
 * the custom data is actually fetched.
 */
function apiForData(data: unknown): StaticPortalApi {
    clearPackDataCache();
    (global as { fetch?: unknown }).fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => data,
    }));
    const storageManager = new StorageManager(window.localStorage);
    storageManager.combinationId = CombinationId.fromFull(packs[0].combinationId);
    return new StaticPortalApi(storageManager);
}

describe("StaticPortalApi", (): void => {
    let storageManager: StorageManager;
    let api: StaticPortalApi;

    beforeEach((): void => {
        clearPackDataCache();
        window.localStorage.clear();
        storageManager = new StorageManager(window.localStorage);
        storageManager.combinationId = CombinationId.fromFull(packs[0].combinationId);

        (global as { fetch?: unknown }).fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => fixture,
        }));
        (window as unknown as { Image: unknown }).Image = FakeImage;

        api = new StaticPortalApi(storageManager);
    });

    test("initializeSession returns the pack as an available setting", async (): Promise<void> => {
        const initData = await api.initializeSession();

        expect(initData.setting.combinationId).toBe(packs[0].combinationId);
        expect(initData.setting.name).toBe(packs[0].label);
        expect(initData.setting.status).toBe(SettingStatus.Available);
        expect(initData.sidebarEntities).toEqual([]);
    });

    test("initializeSession remembers the last pack for id-less visits", async (): Promise<void> => {
        storageManager.combinationId = CombinationId.fromFull(packs[1].combinationId);
        await api.initializeSession();

        // A fresh visit without a combination id (new storage manager, nothing detected
        // from the URL) resolves to the previously browsed pack instead of the default.
        const freshApi = new StaticPortalApi(new StorageManager(window.localStorage));
        const initData = await freshApi.initializeSession();
        expect(initData.setting.combinationId).toBe(packs[1].combinationId);
    });

    test("an unknown combination id re-scopes to the fallback pack, preserving its sidebar", async (): Promise<void> => {
        const sidebar: SidebarEntityData[] = [
            {
                type: "item",
                name: "widget",
                label: "Widget",
                pinnedPosition: 0,
                lastViewTime: "2020-01-01T00:00:00.000Z",
            },
        ];

        // Store a sidebar under the default pack (packs[0]) scope.
        storageManager.combinationId = CombinationId.fromFull(packs[0].combinationId);
        storageManager.sidebarEntities = sidebar;

        // Simulate a visit carrying a well-formed but unknown/stale combination id, the way
        // GlobalStore.detectInitialCombinationId would scope storage from the URL.
        storageManager.combinationId = CombinationId.fromFull("00000000-0000-4000-8000-0000deadbeef");

        const initData = await api.initializeSession();

        // The session resolves to the fallback pack and, crucially, re-scopes storage to it
        // before reading, so the fallback pack's saved sidebar survives instead of being
        // read (and later overwritten) as an empty list under the phantom id.
        expect(initData.setting.combinationId).toBe(packs[0].combinationId);
        expect(initData.sidebarEntities).toEqual(sidebar);
        expect(storageManager.combinationId?.toFull()).toBe(packs[0].combinationId);
    });

    test("getItemList excludes technologies, dummies and orphans, and types fluids", async (): Promise<void> => {
        const itemList = await api.getItemList(1);

        expect(itemList.numberOfResults).toBe(6);
        expect(itemList.results).toContainEqual({ type: "item", name: "widget" });
        expect(itemList.results).toContainEqual({ type: "fluid", name: "goo" });
        // The machine is listable even though no bundled recipe crafts it.
        expect(itemList.results).toContainEqual({ type: "item", name: "assembler" });
        const names = itemList.results.map((item) => item.name);
        expect(names).not.toContain("widget-tech");
        expect(names).not.toContain("thing-dummy-item");
        expect(names).not.toContain("residue");
    });

    test("getRecipeList keeps data order and excludes technology recipes", async (): Promise<void> => {
        const list = await api.getRecipeList(1);

        // Only the two non-technology recipes, in their data-array order.
        expect(list.results).toEqual([
            { name: "gizmo-recipe", label: "Gizmo" },
            { name: "doubler-recipe", label: "Doubler" },
        ]);
        expect(list.numberOfResults).toBe(2);
    });

    test("getTechnologyList topologically orders technologies", async (): Promise<void> => {
        const list = await api.getTechnologyList(1);

        // widget-tech (a trigger tech with no research cost) is a prerequisite of mining-tech,
        // so it must come first.
        expect(list.results).toEqual([
            { name: "widget-tech", label: "Widget technology" },
            { name: "mining-tech", label: "Mining technology" },
        ]);
        expect(list.numberOfResults).toBe(2);
    });

    test("dummy and orphaned items stay resolvable by direct reference", async (): Promise<void> => {
        const dummy = await api.getTooltip("item", "thing-dummy-item");
        expect(dummy.label).toBe("Thing (Hidden)");

        const orphan = await api.getTooltip("item", "residue");
        expect(orphan.label).toBe("Residue");
        expect(orphan.numberOfRecipes).toBe(0);
    });

    test("search disambiguates duplicated display names", async (): Promise<void> => {
        const results = await api.search("doubler", 1);

        expect(results.results.map((entity) => entity.label).sort()).toEqual([
            "Doubler (doubler-a)",
            "Doubler (doubler-b)",
        ]);
    });

    test("search excludes dummy and orphaned items", async (): Promise<void> => {
        expect((await api.search("thing", 1)).numberOfResults).toBe(0);
        expect((await api.search("residue", 1)).numberOfResults).toBe(0);
    });

    test("getItemIngredientRecipes maps recipes, fractions and labels", async (): Promise<void> => {
        const data = await api.getItemIngredientRecipes("item", "widget", 1);

        expect(data.label).toBe("Widget");
        // The technology recipe consuming the widget is filtered out; doubler-recipe stays.
        expect(data.numberOfResults).toBe(2);

        const recipe = data.results[0];
        expect(recipe.type).toBe("recipe");
        expect(recipe.name).toBe("gizmo-recipe");
        expect(recipe.recipes[0].craftingTime).toBe(1.5);
        expect(recipe.recipes[0].ingredients).toContainEqual({
            type: "fluid",
            name: "goo",
            label: "Goo",
            amount: 2.5,
        });
        expect(recipe.recipes[0].products).toEqual([{ type: "item", name: "gizmo", label: "Gizmo", amount: 1 }]);
    });

    test("getItemProductRecipes finds the producing recipe", async (): Promise<void> => {
        const data = await api.getItemProductRecipes("item", "gizmo", 1);

        expect(data.numberOfResults).toBe(1);
        expect(data.results[0].name).toBe("gizmo-recipe");
    });

    test("getItemIngredientRecipes rejects unknown items", async (): Promise<void> => {
        await expect(api.getItemIngredientRecipes("item", "nope", 1)).rejects.toBeInstanceOf(PageNotFoundError);
    });

    test("getMachineRecipes lists the recipes a machine can craft", async (): Promise<void> => {
        const data = await api.getMachineRecipes("item", "assembler", 1);

        expect(data.label).toBe("Assembler");
        // Both non-technology recipes name the assembler as a producer; the technology
        // recipe (producer "lab") is filtered out.
        expect(data.numberOfResults).toBe(2);
        expect(data.results.map((entity) => entity.name).sort()).toEqual(["doubler-recipe", "gizmo-recipe"]);
    });

    test("getMachineRecipes is empty for non-machine items", async (): Promise<void> => {
        const data = await api.getMachineRecipes("item", "widget", 1);

        expect(data.numberOfResults).toBe(0);
        expect(data.results).toEqual([]);
    });

    test("getTechnology exposes research packs, time, prerequisites and unlocked recipes", async (): Promise<void> => {
        const technology = await api.getTechnology("mining-tech");

        expect(technology.name).toBe("mining-tech");
        expect(technology.label).toBe("Mining technology");
        expect(technology.researchTime).toBe(10);
        expect(technology.ingredients).toEqual([
            { type: "item", name: "science-pack", label: "Science pack", amount: 3 },
        ]);
        expect(technology.prerequisites).toEqual([{ name: "widget-tech", label: "Widget technology" }]);
        expect(technology.unlockedRecipes.map((entity) => entity.name)).toEqual(["doubler-recipe"]);
        expect(technology.numberOfUnlockedRecipes).toBe(1);
        // Nothing lists mining-tech as a prerequisite, so it leads to no further technology.
        expect(technology.unlockedTechnologies).toEqual([]);
    });

    test("getTechnology lists the technologies it leads to (reverse of prerequisites)", async (): Promise<void> => {
        // mining-tech lists widget-tech as a prerequisite, so widget-tech leads to it.
        const technology = await api.getTechnology("widget-tech");

        expect(technology.unlockedTechnologies).toEqual([{ name: "mining-tech", label: "Mining technology" }]);
    });

    test("getTechnology reports trigger technologies with no research cost", async (): Promise<void> => {
        // widget-tech has an empty technology object (no paired cost recipe by its id).
        const technology = await api.getTechnology("widget-tech");

        expect(technology.researchTime).toBe(0);
        expect(technology.ingredients).toEqual([]);
        expect(technology.prerequisites).toEqual([]);
        expect(technology.unlockedRecipes).toEqual([]);
    });

    test("getRecipeResearch lists the technologies that unlock a recipe", async (): Promise<void> => {
        const technologies = await api.getRecipeResearch("doubler-recipe");
        expect(technologies.map((technology) => technology.name)).toEqual(["mining-tech"]);
        expect(technologies[0].ingredients[0].name).toBe("science-pack");

        // A recipe no technology unlocks is start-available.
        expect(await api.getRecipeResearch("gizmo-recipe")).toEqual([]);
    });

    test("getTechnology rejects unknown technologies", async (): Promise<void> => {
        await expect(api.getTechnology("nope")).rejects.toBeInstanceOf(PageNotFoundError);
    });

    test("getItemResearch lists the technologies unlocking an item", async (): Promise<void> => {
        const research = await api.getItemResearch("item", "doubler-a");

        expect(research.type).toBe("item");
        expect(research.label).toBe("Doubler");
        expect(research.technologies.map((technology) => technology.name)).toEqual(["mining-tech"]);
        expect(research.technologies[0].ingredients[0].name).toBe("science-pack");
    });

    test("getItemResearch is empty for start-available items", async (): Promise<void> => {
        const research = await api.getItemResearch("item", "gizmo");

        expect(research.technologies).toEqual([]);
    });

    test("getTooltip represents a technology by the recipes it unlocks", async (): Promise<void> => {
        const entity = await api.getTooltip("technology", "mining-tech");

        expect(entity.type).toBe("technology");
        expect(entity.label).toBe("Mining technology");
        expect(entity.numberOfRecipes).toBe(1);
        expect(entity.recipes[0].products[0].name).toBe("doubler-a");
    });

    test("getIconsStyle resolves technology icons from their own namespace", async (): Promise<void> => {
        const result = await api.getIconsStyle({
            cssSelector: ".icon-{type}-{name}",
            entities: { technology: ["mining-tech"] },
        });

        expect(result.processedEntities).toEqual({ technology: ["mining-tech"] });
        expect(result.style).toContain(".icon-technology-mining-tech{");
    });

    test("getItemResearch rejects unknown items and keeps technologies out of the item namespace", async (): Promise<void> => {
        await expect(api.getItemResearch("item", "nope")).rejects.toBeInstanceOf(PageNotFoundError);
        // A technology id is not addressable as an item.
        await expect(api.getItemResearch("item", "mining-tech")).rejects.toBeInstanceOf(PageNotFoundError);
    });

    test("getRecipeDetails maps the recipe", async (): Promise<void> => {
        const details = await api.getRecipeDetails("gizmo-recipe");

        expect(details.label).toBe("Gizmo");
        expect(details.recipe?.craftingTime).toBe(1.5);
        expect(details.expensiveRecipe).toBeUndefined();
    });

    test("getRecipeMachines maps producers with scaled energy usage", async (): Promise<void> => {
        const machines = await api.getRecipeMachines("gizmo-recipe", 1);

        expect(machines.numberOfResults).toBe(1);
        expect(machines.results[0]).toEqual({
            name: "assembler",
            label: "Assembler",
            craftingSpeed: 1.5,
            numberOfItems: 255,
            numberOfFluids: 255,
            numberOfModules: 2,
            energyUsage: 1.5,
            energyUsageUnit: "MW",
        });
    });

    test("search matches items by label prefix and substring", async (): Promise<void> => {
        const results = await api.search("gi", 1);

        expect(results.query).toBe("gi");
        expect(results.results.map((entity) => entity.name)).toEqual(["gizmo"]);
        expect(results.results[0].recipes).toHaveLength(1);

        const substring = await api.search("zmo", 1);
        expect(substring.results.map((entity) => entity.name)).toEqual(["gizmo"]);
    });

    test("getTooltip assembles the entity with its product recipes", async (): Promise<void> => {
        const entity = await api.getTooltip("item", "gizmo");

        expect(entity.label).toBe("Gizmo");
        expect(entity.numberOfRecipes).toBe(1);
        expect(entity.recipes[0].products[0].name).toBe("gizmo");
    });

    test("getSettings lists every bundled pack", async (): Promise<void> => {
        const settings = await api.getSettings();

        expect(settings).toHaveLength(packs.length);
        expect(settings.map((setting) => setting.combinationId)).toEqual(packs.map((pack) => pack.combinationId));
    });

    test("saveSetting persists options and getSetting returns them", async (): Promise<void> => {
        await api.saveSetting(packs[0].combinationId, { name: "Renamed", locale: "de", recipeMode: "normal" });

        const setting = await api.getSetting(packs[0].combinationId);
        expect(setting.name).toBe("Renamed");
        expect(setting.locale).toBe("de");
        expect(setting.recipeMode).toBe("normal");
    });

    test("getIconsStyle builds percentage rules and reports processed entities", async (): Promise<void> => {
        const result = await api.getIconsStyle({
            cssSelector: ".icon-{type}-{name}",
            entities: {
                item: ["gizmo", "unknown-thing"],
                fluid: ["goo"],
                recipe: ["gizmo-recipe"],
                machine: ["assembler"],
            },
        });

        expect(result.processedEntities).toEqual({
            item: ["gizmo"],
            fluid: ["goo"],
            recipe: ["gizmo-recipe"],
            machine: ["assembler"],
        });

        expect(result.style).toContain(
            '.icon-item-gizmo{background-image:url("https://factoriolab.github.io/data/2.0/icons.webp");' +
                "background-size:306.25% 203.125%;background-position:50% 0%;}",
        );
        // The fluid sits one row down: y = 66/(130-64)*100 = 100%, and carries its
        // iconText overlay as an ::after rule.
        expect(result.style).toContain(".icon-fluid-goo{");
        expect(result.style).toContain("background-position:0% 100%;position:relative;}");
        expect(result.style).toContain('.icon-fluid-goo::after{content:"42";');
        // The recipe has no own icon entry and falls back to the item icon of the same name...
        expect(result.style).toContain(".icon-recipe-gizmo-recipe{");
        expect(result.style).not.toContain("unknown-thing");
    });

    test("getSettingMods returns the pack's mod versions", async (): Promise<void> => {
        const mods = await api.getSettingMods(packs[0].combinationId);

        expect(mods).toContainEqual({ name: "mod-alpha", label: "mod-alpha", author: "", version: "1.2.3" });
    });

    test("pack data is fetched only once across calls", async (): Promise<void> => {
        await api.getItemList(1);
        await api.getRecipeDetails("gizmo-recipe");
        await api.search("widget", 1);

        expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledTimes(1);
    });

    test("search paginates and disambiguates duplicate labels across the page boundary", async (): Promise<void> => {
        // 25 matching items: 23 uniquely-named ones followed by two that share the label "Zdup".
        // The page size is 24, so the two duplicates straddle the page-1/page-2 boundary — yet
        // both must be disambiguated, because the label counts consider every match, not a page.
        const items: FactorioLabItem[] = [];
        const out: { [id: string]: number } = {};
        for (let i = 0; i < 23; ++i) {
            const id = `gadget-${String(i).padStart(2, "0")}`;
            items.push({ id, name: `Item ${String(i).padStart(2, "0")}`, category: "parts", row: 0 });
            out[id] = 1;
        }
        items.push({ id: "gadget-dup-1", name: "Zdup", category: "parts", row: 0 });
        items.push({ id: "gadget-dup-2", name: "Zdup", category: "parts", row: 0 });
        out["gadget-dup-1"] = 1;
        out["gadget-dup-2"] = 1;
        const bigApi = apiForData({
            version: {},
            items,
            recipes: [{ id: "bulk", name: "Bulk", category: "parts", row: 0, time: 1, out }],
            icons: [],
        });

        const page1 = await bigApi.search("gadget", 1);
        expect(page1.numberOfResults).toBe(25);
        expect(page1.results).toHaveLength(24);
        // Last result on page 1 is the first duplicate, tagged with its raw id.
        expect(page1.results[23].label).toBe("Zdup (gadget-dup-1)");

        const page2 = await bigApi.search("gadget", 2);
        expect(page2.numberOfResults).toBe(25);
        expect(page2.results).toHaveLength(1);
        // Its sibling landed on page 2 and is still disambiguated.
        expect(page2.results[0].label).toBe("Zdup (gadget-dup-2)");
    });

    test("research lookups report the unlocked-recipe count without materializing the recipes", async (): Promise<void> => {
        // The full technology build materializes the unlocked recipe entities...
        const full = await api.getTechnology("mining-tech");
        expect(full.numberOfUnlockedRecipes).toBe(1);
        expect(full.unlockedRecipes).toHaveLength(1);

        // ...while the lightweight "unlocked by" lookups report the same count with an empty
        // unlockedRecipes list (their consumers never read the recipes).
        const viaRecipe = await api.getRecipeResearch("doubler-recipe");
        expect(viaRecipe[0].name).toBe("mining-tech");
        expect(viaRecipe[0].numberOfUnlockedRecipes).toBe(full.numberOfUnlockedRecipes);
        expect(viaRecipe[0].unlockedRecipes).toEqual([]);

        const viaItem = await api.getItemResearch("item", "doubler-a");
        expect(viaItem.technologies[0].numberOfUnlockedRecipes).toBe(full.numberOfUnlockedRecipes);
        expect(viaItem.technologies[0].unlockedRecipes).toEqual([]);
    });

    test("malformed pack data (items/recipes not arrays) fails with a legible error", async (): Promise<void> => {
        const badApi = apiForData({ version: {}, recipes: [] });
        await expect(badApi.getItemList(1)).rejects.toBeInstanceOf(ServiceNotAvailableError);
    });
});
