import { Config } from "../../util/config";
import {
    EntityData,
    ItemListData,
    ItemMetaData,
    ItemRecipesData,
    ItemResearchData,
    MachineData,
    ModData,
    RecipeData,
    RecipeDetailsData,
    RecipeItemData,
    RecipeListData,
    RecipeMachinesData,
    RecipeMetaData,
    ResultsData,
    SearchResultsData,
    TechnologyData,
    TechnologyListData,
    TechnologyMetaData,
} from "../transfer";
import { PackIcon, PackIconSheet, PackItem, PackModel, PackRecipe, PackRecipeItem, PackTechnology } from "./model";
import { PackDefinition } from "./packs";

export type ResolvedIcon = {
    icon: PackIcon;
    /** Overlay text rendered on top of a shared icon (e.g. FactorioLab's steam temperatures). */
    text?: string;
};

/**
 * A loaded pack: the neutral pack model (model.ts, produced by one of the source adapters)
 * indexed and mapped into the transfer.ts shapes the stores expect. All answers are computed
 * in memory — the dataset of even the largest packs is a few MB of JSON.
 *
 * Technologies are kept out of the browsable item and recipe lists: FactorioLab models
 * research as pseudo-items and science-pack recipes, which would pollute an item browser's
 * grid, search and random picks, and the fbe artifact keeps them in their own array anyway.
 * They are still indexed separately so the app can answer "what unlocks this item" and browse
 * the technology tree; see getItemResearch/getTechnology and docs/static-fork.md.
 */
export class PackData {
    public readonly definition: PackDefinition;
    private readonly model: PackModel;

    private readonly items: PackItem[];
    private readonly itemsById = new Map<string, PackItem>();
    private readonly recipes: PackRecipe[];
    private readonly recipesById = new Map<string, PackRecipe>();
    private readonly recipeIdsByIngredient = new Map<string, string[]>();
    private readonly recipeIdsByProduct = new Map<string, string[]>();
    private readonly recipeIdsByProducer = new Map<string, string[]>();
    private readonly iconsById: Map<string, PackIcon>;
    private readonly listableItems: PackItem[];
    // The item-list meta array is the same on every call; build it once, lazily.
    private listableItemMetasCache?: ItemMetaData[];
    // The recipe- and technology-list meta arrays, likewise built once, lazily.
    private recipeMetasCache?: RecipeMetaData[];
    private technologyMetasCache?: TechnologyMetaData[];

    // Technology data, indexed but never added to the browsable lists above.
    private readonly technologiesById = new Map<string, PackTechnology>();
    private readonly technologyIdsByUnlockedRecipe = new Map<string, string[]>();
    // Reverse of each technology's `prerequisites`: prerequisite tech id → the technologies
    // that list it, i.e. the technologies this one unlocks (partial — only direct dependents).
    private readonly technologyIdsByPrerequisite = new Map<string, string[]>();

    public constructor(definition: PackDefinition, model: PackModel) {
        this.definition = definition;
        this.model = model;

        this.items = model.items;
        for (const item of this.items) {
            this.itemsById.set(item.id, item);
        }

        this.recipes = model.recipes;
        for (const recipe of this.recipes) {
            this.recipesById.set(recipe.id, recipe);
            for (const { id } of recipe.ingredients) {
                this.push(this.recipeIdsByIngredient, id, recipe.id);
            }
            for (const { id } of recipe.products) {
                this.push(this.recipeIdsByProduct, id, recipe.id);
            }
            for (const producerId of recipe.producers) {
                this.push(this.recipeIdsByProducer, producerId, recipe.id);
            }
        }

        for (const technology of model.technologies) {
            this.technologiesById.set(technology.id, technology);
            for (const recipeId of technology.unlockedRecipes) {
                this.push(this.technologyIdsByUnlockedRecipe, recipeId, technology.id);
            }
            for (const prerequisiteId of technology.prerequisites) {
                this.push(this.technologyIdsByPrerequisite, prerequisiteId, technology.id);
            }
        }

        this.iconsById = model.icons;

        // The browsable subset. Which items are listable is the adapter's call: the fbe
        // source publishes only non-hidden prototypes, while the FactorioLab adapter hides
        // its mod-internal dummies and recipe-less calculator artifacts (they stay
        // resolvable by URL and as recipe ingredients). See docs/static-fork.md.
        this.listableItems = this.items.filter((item) => item.listable);
    }

    /** The pack's spritesheet, with its dimensions when the source publishes them. */
    public get iconSheet(): PackIconSheet {
        return this.model.iconSheet;
    }

    private push(map: Map<string, string[]>, key: string, value: string): void {
        const list = map.get(key);
        if (list) {
            list.push(value);
        } else {
            map.set(key, [value]);
        }
    }

    private resolveItemRef(itemId: string): { type: string; name: string; label: string } {
        const item = this.itemsById.get(itemId);
        if (item) {
            return { type: item.type, name: item.id, label: item.label };
        }
        return { type: "item", name: itemId, label: itemId };
    }

    private paginate<T>(list: T[], page: number, pageSize: number): ResultsData<T> {
        return {
            results: list.slice((page - 1) * pageSize, page * pageSize),
            numberOfResults: list.length,
        };
    }

    private buildRecipeItems(side: PackRecipeItem[]): RecipeItemData[] {
        return side.map((entry) => ({
            ...this.resolveItemRef(entry.id),
            amount: entry.amount,
        }));
    }

    private buildRecipeData(recipe: PackRecipe): RecipeData {
        return {
            craftingTime: recipe.craftingTime,
            ingredients: this.buildRecipeItems(recipe.ingredients),
            products: this.buildRecipeItems(recipe.products),
            isExpensive: false,
        };
    }

    private buildRecipeEntity(recipe: PackRecipe): EntityData {
        return {
            type: "recipe",
            name: recipe.id,
            label: recipe.label,
            recipes: [this.buildRecipeData(recipe)],
            numberOfRecipes: 1,
        };
    }

    /**
     * Builds the entity representation of an item: the item plus a sample of the recipes
     * producing it, as used by tooltips, search results and the random cards.
     */
    private buildItemEntity(item: PackItem): EntityData {
        const recipeIds = this.recipeIdsByProduct.get(item.id) || [];
        const recipes = recipeIds
            .slice(0, Config.numberOfRecipesPerEntity)
            .map((recipeId) => this.buildRecipeData(this.recipesById.get(recipeId) as PackRecipe));

        return {
            type: item.type,
            name: item.id,
            label: item.label,
            recipes: recipes,
            numberOfRecipes: recipeIds.length,
        };
    }

    public getItem(type: string, name: string): PackItem | null {
        const item = this.itemsById.get(name);
        if (!item || item.type !== type) {
            return null;
        }
        return item;
    }

    private listableItemMetas(): ItemMetaData[] {
        if (!this.listableItemMetasCache) {
            this.listableItemMetasCache = this.listableItems.map((item) => ({
                type: item.type,
                name: item.id,
            }));
        }
        return this.listableItemMetasCache;
    }

    public getItemList(page: number): ItemListData {
        return this.paginate(this.listableItemMetas(), page, Config.numberOfItemsPerPage);
    }

    private recipeMetas(): RecipeMetaData[] {
        if (!this.recipeMetasCache) {
            // Model order (research recipes are never part of it): both sources publish the
            // game's category/row display grouping, the same rationale as the item list — do
            // not re-sort.
            this.recipeMetasCache = this.recipes.map((recipe) => ({
                name: recipe.id,
                label: recipe.label,
            }));
        }
        return this.recipeMetasCache;
    }

    public getRecipeList(page: number): RecipeListData {
        return this.paginate(this.recipeMetas(), page, Config.numberOfItemsPerPage);
    }

    private technologyMetas(): TechnologyMetaData[] {
        if (!this.technologyMetasCache) {
            this.technologyMetasCache = this.orderedTechnologies().map((technology) => ({
                name: technology.id,
                label: technology.label,
            }));
        }
        return this.technologyMetasCache;
    }

    public getTechnologyList(page: number): TechnologyListData {
        return this.paginate(this.technologyMetas(), page, Config.numberOfItemsPerPage);
    }

    /**
     * The order technologies are listed in: a stable topological sort of the prerequisites
     * graph (an edge points prerequisite → technology), so a technology never appears before
     * any of its prerequisites. Kahn's algorithm drives it; among the technologies that are
     * currently available (all their known prerequisites already emitted) the next one is the
     * cheapest, where research cost is defined pragmatically as the tuple:
     *   1. total research time (time per unit × unit count; 0 for trigger/free technologies),
     *   2. then the total science-pack amount (likewise multiplied by the unit count),
     *   3. then the label (locale compare),
     *   4. then the id — a final, fully deterministic tiebreak.
     * Sources without a unit count (FactorioLab) fall back to a count of 1, which reduces the
     * tuple to plain per-unit time and amount.
     * A prerequisite that references an unknown technology is ignored for availability (so a
     * dangling reference cannot strand a technology forever); any technologies still unemitted
     * after the sort — a prerequisite cycle — are appended in that same ascending-cost order.
     * The list is therefore always complete and the routine never drops a node or throws.
     */
    private orderedTechnologies(): PackTechnology[] {
        const technologies = [...this.technologiesById.values()];

        // Research-cost tuple per technology.
        const costs = new Map<string, [number, number, string, string]>();
        for (const technology of technologies) {
            const count = technology.researchCount ?? 1;
            const amount = technology.ingredients.reduce<number>((sum, ingredient) => sum + ingredient.amount, 0);
            costs.set(technology.id, [
                technology.researchTime * count,
                amount * count,
                technology.label,
                technology.id,
            ]);
        }
        const compareCost = (a: string, b: string): number => {
            const [timeA, amountA, labelA, idA] = costs.get(a) as [number, number, string, string];
            const [timeB, amountB, labelB, idB] = costs.get(b) as [number, number, string, string];
            if (timeA !== timeB) {
                return timeA - timeB;
            }
            if (amountA !== amountB) {
                return amountA - amountB;
            }
            const byLabel = labelA.localeCompare(labelB);
            if (byLabel !== 0) {
                return byLabel;
            }
            return idA < idB ? -1 : idA > idB ? 1 : 0;
        };

        // In-degree = number of prerequisites that resolve to a known technology.
        const inDegree = new Map<string, number>();
        for (const technology of technologies) {
            const known = technology.prerequisites.filter((id) => this.technologiesById.has(id));
            inDegree.set(technology.id, known.length);
        }

        const available = technologies.map((technology) => technology.id).filter((id) => inDegree.get(id) === 0);

        const ordered: PackTechnology[] = [];
        const emitted = new Set<string>();
        while (available.length > 0) {
            // Pick the cheapest currently-available technology (linear scan; the node counts
            // stay small enough — hundreds at most — that this is not worth a heap).
            let minIndex = 0;
            for (let i = 1; i < available.length; ++i) {
                if (compareCost(available[i], available[minIndex]) < 0) {
                    minIndex = i;
                }
            }
            const [technologyId] = available.splice(minIndex, 1);
            emitted.add(technologyId);
            ordered.push(this.technologiesById.get(technologyId) as PackTechnology);

            for (const dependentId of this.technologyIdsByPrerequisite.get(technologyId) || []) {
                const degree = inDegree.get(dependentId);
                if (degree === undefined || emitted.has(dependentId)) {
                    continue;
                }
                const next = degree - 1;
                inDegree.set(dependentId, next);
                if (next === 0) {
                    available.push(dependentId);
                }
            }
        }

        // Cycle / unresolved remainder: append deterministically, in the same cost order.
        if (ordered.length < technologies.length) {
            const remainder = technologies
                .filter((technology) => !emitted.has(technology.id))
                .sort((a, b) => compareCost(a.id, b.id));
            ordered.push(...remainder);
        }

        return ordered;
    }

    public getItemRecipes(item: PackItem, side: "ingredient" | "product" | "producer", page: number): ItemRecipesData {
        const map =
            side === "ingredient"
                ? this.recipeIdsByIngredient
                : side === "product"
                  ? this.recipeIdsByProduct
                  : this.recipeIdsByProducer;
        // Slice the id list to the requested page first, then build entities only for that
        // page — the full match set can be large, and each entity expands several recipes.
        const recipeIds = map.get(item.id) || [];
        const pageSize = Config.numberOfItemRecipesPerPage;
        const entities = recipeIds
            .slice((page - 1) * pageSize, page * pageSize)
            .map((recipeId) => this.buildRecipeEntity(this.recipesById.get(recipeId) as PackRecipe));

        return {
            type: item.type,
            name: item.id,
            label: item.label,
            description: item.description ?? "",
            stackSize: item.stackSize,
            results: entities,
            numberOfResults: recipeIds.length,
        };
    }

    public getRecipeDetails(name: string): RecipeDetailsData | null {
        const recipe = this.recipesById.get(name);
        if (!recipe) {
            return null;
        }
        return {
            name: recipe.id,
            label: recipe.label,
            description: recipe.description ?? "",
            recipe: this.buildRecipeData(recipe),
        };
    }

    public getRecipeMachines(name: string, page: number): RecipeMachinesData | null {
        const recipe = this.recipesById.get(name);
        if (!recipe) {
            return null;
        }

        const machines: MachineData[] = [];
        for (const producerId of recipe.producers) {
            const producer = this.itemsById.get(producerId);
            if (!producer || !producer.machine) {
                continue;
            }
            machines.push(this.buildMachineData(producer));
        }
        return this.paginate(machines, page, Config.numberOfMachinesPerPage);
    }

    private buildMachineData(producer: PackItem): MachineData {
        const machine = producer.machine;

        // Both sources report energy usage as a plain kW number; scale to the tidiest unit.
        let energyUsage = machine?.energyUsageKw ?? 0;
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
            label: producer.label,
            craftingSpeed: machine?.craftingSpeed ?? 1,
            // Neither source has slot data; 255 renders as "unlimited" in formatMachineSlots.
            numberOfItems: 255,
            numberOfFluids: 255,
            numberOfModules: machine?.numberOfModules ?? 0,
            energyUsage: energyUsage,
            energyUsageUnit: energyUsageUnit,
        };
    }

    private technologyRef(technologyId: string): TechnologyMetaData {
        const technology = this.technologiesById.get(technologyId);
        return { name: technologyId, label: technology ? technology.label : technologyId };
    }

    /**
     * Maps a technology into its full detail: research packs, time and (where the source has
     * them) the real research-unit count, prerequisite technologies (for tree traversal), the
     * recipes it unlocks and the technologies it directly leads to (the reverse of
     * prerequisites). Trigger/free technologies carry no research cost — their ingredient
     * list is empty and their time zero.
     */
    private buildTechnologyData(technology: PackTechnology): TechnologyData {
        const unlockedRecipes = technology.unlockedRecipes
            .map((recipeId) => this.recipesById.get(recipeId))
            .filter((unlocked): unlocked is PackRecipe => unlocked !== undefined)
            .map((unlocked) => this.buildRecipeEntity(unlocked));

        return {
            ...this.buildTechnologyBase(technology),
            unlockedRecipes: unlockedRecipes,
            numberOfUnlockedRecipes: unlockedRecipes.length,
        };
    }

    /**
     * A lighter counterpart of buildTechnologyData for the "unlocked by" lookups
     * (getItemResearch / getRecipeResearch), whose consumers render only a technology's
     * name/label plus its research cost — never the recipes it unlocks. It leaves
     * `unlockedRecipes` empty and reports `numberOfUnlockedRecipes` as the cheap count of
     * resolvable unlock entries, which equals what buildTechnologyData would report (that
     * method drops unresolvable ids the same way). The TechnologyData shape is identical;
     * only the expensive recipe-entity materialization is skipped.
     */
    private buildTechnologyResearch(technology: PackTechnology): TechnologyData {
        return {
            ...this.buildTechnologyBase(technology),
            unlockedRecipes: [],
            numberOfUnlockedRecipes: technology.unlockedRecipes.filter((recipeId) => this.recipesById.has(recipeId))
                .length,
        };
    }

    /** The parts both technology builders share. */
    private buildTechnologyBase(
        technology: PackTechnology,
    ): Omit<TechnologyData, "unlockedRecipes" | "numberOfUnlockedRecipes"> {
        return {
            name: technology.id,
            label: technology.label,
            description: technology.description,
            researchTime: technology.researchTime,
            researchCount: technology.researchCount,
            researchCountFormula: technology.researchCountFormula,
            ingredients: this.buildRecipeItems(technology.ingredients),
            prerequisites: technology.prerequisites.map((id) => this.technologyRef(id)),
            unlockedTechnologies: (this.technologyIdsByPrerequisite.get(technology.id) || []).map((id) =>
                this.technologyRef(id),
            ),
        };
    }

    public getTechnology(name: string): TechnologyData | null {
        const technology = this.technologiesById.get(name);
        return technology ? this.buildTechnologyData(technology) : null;
    }

    /**
     * The technologies that unlock a given recipe (the reverse of each technology's unlock
     * list). This is the core research connection of a recipe; empty for recipes available
     * from the start.
     */
    public getRecipeResearch(recipeName: string): TechnologyData[] {
        return (this.technologyIdsByUnlockedRecipe.get(recipeName) || [])
            .map((id) => this.technologiesById.get(id))
            .filter((technology): technology is PackTechnology => technology !== undefined)
            .map((technology) => this.buildTechnologyResearch(technology));
    }

    /**
     * The technologies that unlock this item: every technology whose unlocked recipes include
     * a recipe producing the item. Empty for items available from the start. An item can be
     * unlocked by more than one technology (several producing recipes, or a recipe granted by
     * multiple technologies), so the result is a de-duplicated set.
     */
    public getItemResearch(item: PackItem): ItemResearchData {
        const technologyIds = new Set<string>();
        for (const recipeId of this.recipeIdsByProduct.get(item.id) || []) {
            for (const technologyId of this.technologyIdsByUnlockedRecipe.get(recipeId) || []) {
                technologyIds.add(technologyId);
            }
        }

        const technologies = [...technologyIds]
            .map((id) => this.technologiesById.get(id))
            .filter((technology): technology is PackTechnology => technology !== undefined)
            .map((technology) => this.buildTechnologyResearch(technology));

        return {
            type: item.type,
            name: item.id,
            label: item.label,
            technologies: technologies,
        };
    }

    public getEntity(type: string, name: string): EntityData | null {
        if (type === "recipe") {
            const recipe = this.recipesById.get(name);
            return recipe ? this.buildRecipeEntity(recipe) : null;
        }

        if (type === "technology") {
            const technology = this.technologiesById.get(name);
            if (!technology) {
                return null;
            }
            // Represent the technology by the recipes it unlocks, so its tooltip and cards
            // show what researching it grants.
            const data = this.buildTechnologyData(technology);
            return {
                type: "technology",
                name: data.name,
                label: data.label,
                recipes: data.unlockedRecipes
                    .slice(0, Config.numberOfRecipesPerEntity)
                    .map((entity) => entity.recipes[0]),
                numberOfRecipes: data.numberOfUnlockedRecipes,
            };
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
        const scored: { item: PackItem; score: number }[] = [];
        if (needle !== "") {
            for (const item of this.listableItems) {
                const label = item.label.toLowerCase();
                if (label.startsWith(needle) || item.id.startsWith(needle)) {
                    scored.push({ item, score: 0 });
                } else if (label.includes(needle) || item.id.includes(needle)) {
                    scored.push({ item, score: 1 });
                }
            }
            scored.sort((left, right) => left.score - right.score || left.item.label.localeCompare(right.item.label));
        }

        // Distinct entities can share a display name (e.g. SE's grounded/spaced variants);
        // disambiguate those results with the raw id so they are tellable apart. The counts
        // must consider ALL matches (cheap), even though only one page of entities is built.
        const labelCounts = new Map<string, number>();
        for (const { item } of scored) {
            labelCounts.set(item.label, (labelCounts.get(item.label) || 0) + 1);
        }

        // Slice to the requested page before building entities — each entity expands several
        // recipes, so building them for every match only to drop all but one page is wasteful.
        const pageSize = Config.numberOfSearchResultsPerPage;
        const entities = scored.slice((page - 1) * pageSize, page * pageSize).map(({ item }) => {
            const entity = this.buildItemEntity(item);
            if ((labelCounts.get(item.label) || 0) > 1) {
                entity.label = `${item.label} (${item.id})`;
            }
            return entity;
        });
        return {
            query: query,
            results: entities,
            numberOfResults: scored.length,
        };
    }

    /**
     * Resolves the spritesheet position of an entity's icon (plus its overlay text, e.g.
     * steam temperatures), or null if the entity (or its icon) is unknown. Items, fluids
     * and machines share the item namespace; a recipe without an own icon falls back to its
     * first product's icon (the fbe artifact omits the icon id in exactly that case).
     */
    public getIconRect(type: string, name: string): ResolvedIcon | null {
        if (type === "technology") {
            const technology = this.technologiesById.get(name);
            if (technology) {
                const icon = technology.iconId ? this.iconsById.get(technology.iconId) : undefined;
                if (icon) {
                    return { icon, text: technology.iconText };
                }
            }
            return null;
        }

        if (type === "recipe") {
            const recipe = this.recipesById.get(name);
            if (recipe) {
                const icon = recipe.iconId ? this.iconsById.get(recipe.iconId) : undefined;
                if (icon) {
                    return { icon, text: recipe.iconText };
                }
                // No own icon entry: fall back to the recipe's primary product.
                const primaryProduct = recipe.products[0];
                if (primaryProduct) {
                    return this.getIconRect("item", primaryProduct.id);
                }
            }
            // Fall through: some recipe names only exist as items in the icon set.
        }

        const item = this.itemsById.get(name);
        if (!item || !item.iconId) {
            return null;
        }
        const icon = this.iconsById.get(item.iconId);
        return icon ? { icon, text: item.iconText } : null;
    }

    public getMods(): ModData[] {
        return this.model.mods.map((mod) => ({
            name: mod.name,
            label: mod.name,
            author: "",
            version: mod.version,
        }));
    }
}
