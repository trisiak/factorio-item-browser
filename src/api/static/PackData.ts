import { Config } from "../../util/config";
import {
    EntityData,
    ItemListData,
    ItemMetaData,
    ItemRecipesData,
    MachineData,
    ModData,
    RecipeData,
    RecipeDetailsData,
    RecipeItemData,
    RecipeMachinesData,
    ResultsData,
    SearchResultsData,
} from "../transfer";
import { FactorioLabData, FactorioLabIcon, FactorioLabItem, FactorioLabRecipe, toNumber } from "./factoriolab";
import { PackDefinition } from "./packs";

export type ResolvedIcon = {
    icon: FactorioLabIcon;
    /** Overlay text FactorioLab renders on top of a shared icon (e.g. steam temperatures). */
    text?: string;
};

/**
 * A loaded pack: FactorioLab data indexed and mapped into the transfer.ts shapes the
 * stores expect. All answers are computed in memory — the dataset of even the largest
 * packs is a few MB of JSON.
 *
 * Technologies are excluded everywhere: FactorioLab models research as pseudo-items and
 * science-pack recipes, which would pollute an item browser's lists.
 */
export class PackData {
    public readonly definition: PackDefinition;
    private readonly data: FactorioLabData;

    private readonly items: FactorioLabItem[];
    private readonly itemsById = new Map<string, FactorioLabItem>();
    private readonly recipes: FactorioLabRecipe[];
    private readonly recipesById = new Map<string, FactorioLabRecipe>();
    private readonly recipeIdsByIngredient = new Map<string, string[]>();
    private readonly recipeIdsByProduct = new Map<string, string[]>();
    private readonly iconsById = new Map<string, FactorioLabIcon>();
    private readonly listableItems: FactorioLabItem[];

    public constructor(definition: PackDefinition, data: FactorioLabData) {
        this.definition = definition;
        this.data = data;

        this.items = data.items.filter((item) => !this.isTechnologyItem(item));
        for (const item of this.items) {
            this.itemsById.set(item.id, item);
        }

        this.recipes = data.recipes.filter((recipe) => !this.isTechnologyRecipe(recipe));
        for (const recipe of this.recipes) {
            this.recipesById.set(recipe.id, recipe);
            for (const itemId of Object.keys(recipe.in || {})) {
                this.push(this.recipeIdsByIngredient, itemId, recipe.id);
            }
            for (const itemId of Object.keys(recipe.out || {})) {
                this.push(this.recipeIdsByProduct, itemId, recipe.id);
            }
        }

        for (const icon of data.icons || []) {
            this.iconsById.set(icon.id, icon);
        }

        // The browsable subset: mod-internal dummy items (e.g. SE's cargo-rocket pseudo
        // ingredients) and items appearing in no recipe at all (calculator artifacts like
        // steam-temperature variants) stay resolvable by URL/reference, but are hidden
        // from the item list, search and random picks. See docs/static-fork.md.
        this.listableItems = this.items.filter(
            (item) =>
                !item.id.includes("-dummy-") &&
                (item.machine !== undefined ||
                    this.recipeIdsByIngredient.has(item.id) ||
                    this.recipeIdsByProduct.has(item.id)),
        );
    }

    private push(map: Map<string, string[]>, key: string, value: string): void {
        const list = map.get(key);
        if (list) {
            list.push(value);
        } else {
            map.set(key, [value]);
        }
    }

    private isTechnologyItem(item: FactorioLabItem): boolean {
        return item.category === "technology" || item.technology !== undefined;
    }

    private isTechnologyRecipe(recipe: FactorioLabRecipe): boolean {
        return recipe.category === "technology" || (recipe.flags || []).includes("technology");
    }

    private typeOfItem(item: FactorioLabItem): string {
        return item.category === "fluids" ? "fluid" : "item";
    }

    private resolveItemRef(itemId: string): { type: string; name: string; label: string } {
        const item = this.itemsById.get(itemId);
        if (item) {
            return { type: this.typeOfItem(item), name: item.id, label: item.name };
        }
        return { type: "item", name: itemId, label: itemId };
    }

    private paginate<T>(list: T[], page: number, pageSize: number): ResultsData<T> {
        return {
            results: list.slice((page - 1) * pageSize, page * pageSize),
            numberOfResults: list.length,
        };
    }

    private buildRecipeData(recipe: FactorioLabRecipe): RecipeData {
        const buildSide = (side: { [itemId: string]: unknown } | undefined): RecipeItemData[] => {
            return Object.entries(side || {}).map(([itemId, amount]) => ({
                ...this.resolveItemRef(itemId),
                amount: toNumber(amount as number | string, 1),
            }));
        };

        return {
            craftingTime: toNumber(recipe.time),
            ingredients: buildSide(recipe.in),
            products: buildSide(recipe.out),
            isExpensive: false,
        };
    }

    private buildRecipeEntity(recipe: FactorioLabRecipe): EntityData {
        return {
            type: "recipe",
            name: recipe.id,
            label: recipe.name,
            recipes: [this.buildRecipeData(recipe)],
            numberOfRecipes: 1,
        };
    }

    /**
     * Builds the entity representation of an item: the item plus a sample of the recipes
     * producing it, as used by tooltips, search results and the random cards.
     */
    private buildItemEntity(item: FactorioLabItem): EntityData {
        const recipeIds = this.recipeIdsByProduct.get(item.id) || [];
        const recipes = recipeIds
            .slice(0, Config.numberOfRecipesPerEntity)
            .map((recipeId) => this.buildRecipeData(this.recipesById.get(recipeId) as FactorioLabRecipe));

        return {
            type: this.typeOfItem(item),
            name: item.id,
            label: item.name,
            recipes: recipes,
            numberOfRecipes: recipeIds.length,
        };
    }

    public getItem(type: string, name: string): FactorioLabItem | null {
        const item = this.itemsById.get(name);
        if (!item || this.typeOfItem(item) !== type) {
            return null;
        }
        return item;
    }

    public getItemList(page: number): ItemListData {
        const metas: ItemMetaData[] = this.listableItems.map((item) => ({
            type: this.typeOfItem(item),
            name: item.id,
        }));
        return this.paginate(metas, page, Config.numberOfItemsPerPage);
    }

    public getItemRecipes(item: FactorioLabItem, side: "ingredient" | "product", page: number): ItemRecipesData {
        const map = side === "ingredient" ? this.recipeIdsByIngredient : this.recipeIdsByProduct;
        const entities = (map.get(item.id) || []).map((recipeId) => {
            return this.buildRecipeEntity(this.recipesById.get(recipeId) as FactorioLabRecipe);
        });

        return {
            type: this.typeOfItem(item),
            name: item.id,
            label: item.name,
            description: "",
            ...this.paginate(entities, page, Config.numberOfItemRecipesPerPage),
        };
    }

    public getRecipeDetails(name: string): RecipeDetailsData | null {
        const recipe = this.recipesById.get(name);
        if (!recipe) {
            return null;
        }
        return {
            name: recipe.id,
            label: recipe.name,
            description: "",
            recipe: this.buildRecipeData(recipe),
        };
    }

    public getRecipeMachines(name: string, page: number): RecipeMachinesData | null {
        const recipe = this.recipesById.get(name);
        if (!recipe) {
            return null;
        }

        const machines: MachineData[] = [];
        for (const producerId of recipe.producers || []) {
            const producer = this.itemsById.get(producerId);
            if (!producer || !producer.machine) {
                continue;
            }
            machines.push(this.buildMachineData(producer));
        }
        return this.paginate(machines, page, Config.numberOfMachinesPerPage);
    }

    private buildMachineData(producer: FactorioLabItem): MachineData {
        const machine = producer.machine || {};

        // FactorioLab reports energy usage as a plain kW number; scale to the tidiest unit.
        let energyUsage = toNumber(machine.usage);
        let energyUsageUnit = "kW";
        if (energyUsage >= 1000000) {
            energyUsage = energyUsage / 1000000;
            energyUsageUnit = "GW";
        } else if (energyUsage >= 1000) {
            energyUsage = energyUsage / 1000;
            energyUsageUnit = "MW";
        }

        return {
            name: producer.id,
            label: producer.name,
            craftingSpeed: toNumber(machine.speed, 1),
            // FactorioLab has no slot data; 255 renders as "unlimited" in formatMachineSlots.
            numberOfItems: 255,
            numberOfFluids: 255,
            numberOfModules: machine.modules ?? 0,
            energyUsage: energyUsage,
            energyUsageUnit: energyUsageUnit,
        };
    }

    public getEntity(type: string, name: string): EntityData | null {
        if (type === "recipe") {
            const recipe = this.recipesById.get(name);
            return recipe ? this.buildRecipeEntity(recipe) : null;
        }

        const item = this.getItem(type, name);
        return item ? this.buildItemEntity(item) : null;
    }

    public getRandomEntities(count: number): EntityData[] {
        const shuffled = [...this.listableItems];
        for (let i = shuffled.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count).map((item) => this.buildItemEntity(item));
    }

    public search(query: string, page: number): SearchResultsData {
        const needle = query.trim().toLowerCase();
        const scored: { item: FactorioLabItem; score: number }[] = [];
        if (needle !== "") {
            for (const item of this.listableItems) {
                const label = item.name.toLowerCase();
                if (label.startsWith(needle) || item.id.startsWith(needle)) {
                    scored.push({ item, score: 0 });
                } else if (label.includes(needle) || item.id.includes(needle)) {
                    scored.push({ item, score: 1 });
                }
            }
            scored.sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name));
        }

        // Distinct entities can share a display name (e.g. SE's grounded/spaced variants);
        // disambiguate those results with the raw id so they are tellable apart.
        const labelCounts = new Map<string, number>();
        for (const { item } of scored) {
            labelCounts.set(item.name, (labelCounts.get(item.name) || 0) + 1);
        }

        const entities = scored.map(({ item }) => {
            const entity = this.buildItemEntity(item);
            if ((labelCounts.get(item.name) || 0) > 1) {
                entity.label = `${item.name} (${item.id})`;
            }
            return entity;
        });
        return {
            query: query,
            ...this.paginate(entities, page, Config.numberOfSearchResultsPerPage),
        };
    }

    /**
     * Resolves the spritesheet position of an entity's icon (plus its overlay text, e.g.
     * steam temperatures), or null if the entity (or its icon) is unknown. Items, fluids
     * and machines share the item namespace; recipes may point at another icon via their
     * icon field (as items may, too).
     */
    public getIconRect(type: string, name: string): ResolvedIcon | null {
        if (type === "recipe") {
            const recipe = this.recipesById.get(name);
            if (recipe) {
                const icon = this.iconsById.get(recipe.icon ?? recipe.id);
                if (icon) {
                    return { icon, text: recipe.iconText };
                }
                // No own icon entry: fall back to the recipe's primary product.
                const primaryProduct = Object.keys(recipe.out || {})[0];
                if (primaryProduct) {
                    return this.getIconRect("item", primaryProduct);
                }
            }
            // Fall through: some recipe names only exist as items in the icon set.
        }

        const item = this.itemsById.get(name);
        if (!item) {
            return null;
        }
        const icon = this.iconsById.get(item.icon ?? item.id);
        return icon ? { icon, text: item.iconText } : null;
    }

    public getMods(): ModData[] {
        return Object.entries(this.data.version || {}).map(([name, version]) => ({
            name: name,
            label: name,
            author: "",
            version: version,
        }));
    }
}
