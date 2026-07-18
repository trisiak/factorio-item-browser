import { CombinationId } from "../../class/CombinationId";
import { StorageManager } from "../../class/StorageManager";
import { PageNotFoundError } from "../../error/page";
import { SettingStatus } from "../../util/const";
import { clearPackDataCache, StaticPortalApi } from "./StaticPortalApi";
import { FactorioLabData } from "./factoriolab";
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
        { id: "goo", name: "Goo", category: "fluids", row: 1 },
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
    ],
    recipes: [
        {
            id: "gizmo-recipe",
            name: "Gizmo",
            category: "parts",
            row: 0,
            time: "3/2",
            producers: ["assembler"],
            in: { widget: 2, goo: "5/2" },
            out: { gizmo: 1 },
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
    ],
    icons: [
        { id: "widget", x: 0, y: 0 },
        { id: "gizmo", x: 66, y: 0 },
        { id: "goo", x: 0, y: 66 },
        { id: "assembler", x: 132, y: 0 },
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

    test("getItemList excludes technologies and types fluids", async (): Promise<void> => {
        const itemList = await api.getItemList(1);

        expect(itemList.numberOfResults).toBe(4);
        expect(itemList.results).toContainEqual({ type: "item", name: "widget" });
        expect(itemList.results).toContainEqual({ type: "fluid", name: "goo" });
        expect(itemList.results.map((item) => item.name)).not.toContain("widget-tech");
    });

    test("getItemIngredientRecipes maps recipes, fractions and labels", async (): Promise<void> => {
        const data = await api.getItemIngredientRecipes("item", "widget", 1);

        expect(data.label).toBe("Widget");
        // The technology recipe consuming the widget is filtered out.
        expect(data.numberOfResults).toBe(1);

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

        await api.deleteSetting(packs[0].combinationId);
        const reset = await api.getSetting(packs[0].combinationId);
        expect(reset.name).toBe(packs[0].label);
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
        // The fluid sits one row down: y = 66/(130-64)*100 = 100%.
        expect(result.style).toContain(".icon-fluid-goo{");
        expect(result.style).toContain("background-position:0% 100%;}");
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
});
