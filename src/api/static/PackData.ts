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
import {
    FactorioLabData,
    FactorioLabIcon,
    FactorioLabItem,
    FactorioLabRational,
    FactorioLabRecipe,
    toNumber,
} from "./factoriolab";
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
 * Technologies are kept out of the browsable item and recipe lists — FactorioLab models
 * research as pseudo-items and science-pack recipes, which would pollute an item browser's
 * grid, search and random picks. They are still indexed separately so the app can answer
 * "what unlocks this item" and (in future) browse the technology tree; see
 * getItemResearch/getTechnology and docs/static-fork.md.
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
    private readonly recipeIdsByProducer = new Map<string, string[]>();
    private readonly iconsById = new Map<string, FactorioLabIcon>();
    private readonly listableItems: FactorioLabItem[];
    // The item-list meta array is the same on every call; build it once, lazily.
    private listableItemMetasCache?: ItemMetaData[];
    // The recipe- and technology-list meta arrays, likewise built once, lazily.
    private recipeMetasCache?: RecipeMetaData[];
    private technologyMetasCache?: TechnologyMetaData[];

    // Technology data, indexed but never added to the browsable lists above. A technology is
    // an item (category "technology", carrying the technology sub-object) paired with a
    // same-id recipe holding its science-pack cost (in) and research time.
    private readonly technologiesById = new Map<string, FactorioLabItem>();
    private readonly technologyRecipesById = new Map<string, FactorioLabRecipe>();
    private readonly technologyIdsByUnlockedRecipe = new Map<string, string[]>();
    // Reverse of each technology's `prerequisites`: prerequisite tech id → the technologies
    // that list it, i.e. the technologies this one unlocks (partial — only direct dependents).
    private readonly technologyIdsByPrerequisite = new Map<string, string[]>();

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
            for (const producerId of recipe.producers || []) {
                this.push(this.recipeIdsByProducer, producerId, recipe.id);
            }
        }

        for (const item of data.items) {
            if (this.isTechnologyItem(item)) {
                this.technologiesById.set(item.id, item);
                for (const recipeId of item.technology?.recipeUnlock || []) {
                    this.push(this.technologyIdsByUnlockedRecipe, recipeId, item.id);
                }
                for (const prerequisiteId of item.technology?.prerequisites || []) {
                    this.push(this.technologyIdsByPrerequisite, prerequisiteId, item.id);
                }
            }
        }
        for (const recipe of data.recipes) {
            if (this.isTechnologyRecipe(recipe)) {
                this.technologyRecipesById.set(recipe.id, recipe);
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

    private buildRecipeItems(side: { [itemId: string]: FactorioLabRational } | undefined): RecipeItemData[] {
        return Object.entries(side || {}).map(([itemId, amount]) => ({
            ...this.resolveItemRef(itemId),
            amount: toNumber(amount, 1),
        }));
    }

    private buildRecipeData(recipe: FactorioLabRecipe): RecipeData {
        return {
            craftingTime: toNumber(recipe.time),
            ingredients: this.buildRecipeItems(recipe.in),
            products: this.buildRecipeItems(recipe.out),
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

    private listableItemMetas(): ItemMetaData[] {
        if (!this.listableItemMetasCache) {
            this.listableItemMetasCache = this.listableItems.map((item) => ({
                type: this.typeOfItem(item),
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
            // Data-array order (the technology recipes are already filtered out of
            // `this.recipes`): FactorioLab's order follows the game's category/row
            // display grouping, the same rationale as the item list — do not re-sort.
            this.recipeMetasCache = this.recipes.map((recipe) => ({
                name: recipe.id,
                label: recipe.name,
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
                label: technology.name,
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
     * cheapest, where research cost is defined pragmatically from the technology's paired
     * same-id research recipe as the tuple:
     *   1. research time (`recipe.time`; 0 for trigger/free technologies with no paired recipe),
     *   2. then the total science-pack amount (the sum of the recipe's `in` values),
     *   3. then the label (locale compare),
     *   4. then the id — a final, fully deterministic tiebreak.
     * A prerequisite that references an unknown technology is ignored for availability (so a
     * dangling reference cannot strand a technology forever); any technologies still unemitted
     * after the sort — a prerequisite cycle — are appended in that same ascending-cost order.
     * The list is therefore always complete and the routine never drops a node or throws.
     */
    private orderedTechnologies(): FactorioLabItem[] {
        const technologies = [...this.technologiesById.values()];

        // Research-cost tuple per technology, taken from its paired research recipe.
        const costs = new Map<string, [number, number, string, string]>();
        for (const technology of technologies) {
            const recipe = this.technologyRecipesById.get(technology.id);
            const time = recipe ? toNumber(recipe.time) : 0;
            const amount = recipe
                ? Object.values(recipe.in || {}).reduce<number>((sum, value) => sum + toNumber(value), 0)
                : 0;
            costs.set(technology.id, [time, amount, technology.name, technology.id]);
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
            const known = (technology.technology?.prerequisites || []).filter((id) => this.technologiesById.has(id));
            inDegree.set(technology.id, known.length);
        }

        const available = technologies.map((technology) => technology.id).filter((id) => inDegree.get(id) === 0);

        const ordered: FactorioLabItem[] = [];
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
            ordered.push(this.technologiesById.get(technologyId) as FactorioLabItem);

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

    public getItemRecipes(
        item: FactorioLabItem,
        side: "ingredient" | "product" | "producer",
        page: number,
    ): ItemRecipesData {
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
            .map((recipeId) => this.buildRecipeEntity(this.recipesById.get(recipeId) as FactorioLabRecipe));

        return {
            type: this.typeOfItem(item),
            name: item.id,
            label: item.name,
            description: "",
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

    private technologyRef(technologyId: string): TechnologyMetaData {
        const technology = this.technologiesById.get(technologyId);
        return { name: technologyId, label: technology ? technology.name : technologyId };
    }

    /**
     * Maps a technology item into its full detail: research packs and time (from the paired
     * same-id technology recipe), prerequisite technologies (for tree traversal), the recipes
     * it unlocks and the technologies it directly leads to (the reverse of prerequisites).
     * Trigger/free technologies have no paired recipe — their research cost is empty and their
     * time zero.
     */
    private buildTechnologyData(technology: FactorioLabItem): TechnologyData {
        const info = technology.technology || {};
        const recipe = this.technologyRecipesById.get(technology.id);
        const unlockedRecipes = (info.recipeUnlock || [])
            .map((recipeId) => this.recipesById.get(recipeId))
            .filter((unlocked): unlocked is FactorioLabRecipe => unlocked !== undefined)
            .map((unlocked) => this.buildRecipeEntity(unlocked));

        return {
            name: technology.id,
            label: technology.name,
            researchTime: recipe ? toNumber(recipe.time) : 0,
            ingredients: recipe ? this.buildRecipeItems(recipe.in) : [],
            prerequisites: (info.prerequisites || []).map((id) => this.technologyRef(id)),
            unlockedRecipes: unlockedRecipes,
            numberOfUnlockedRecipes: unlockedRecipes.length,
            unlockedTechnologies: (this.technologyIdsByPrerequisite.get(technology.id) || []).map((id) =>
                this.technologyRef(id),
            ),
        };
    }

    /**
     * A lighter counterpart of buildTechnologyData for the "unlocked by" lookups
     * (getItemResearch / getRecipeResearch), whose consumers render only a technology's
     * name/label plus its research cost — never the recipes it unlocks. It leaves
     * `unlockedRecipes` empty and reports `numberOfUnlockedRecipes` as the cheap count of
     * resolvable recipeUnlock entries, which equals what buildTechnologyData would report
     * (that method drops unresolvable ids the same way). The TechnologyData shape is
     * identical; only the expensive recipe-entity materialization is skipped.
     */
    private buildTechnologyResearch(technology: FactorioLabItem): TechnologyData {
        const info = technology.technology || {};
        const recipe = this.technologyRecipesById.get(technology.id);
        const numberOfUnlockedRecipes = (info.recipeUnlock || []).filter((recipeId) =>
            this.recipesById.has(recipeId),
        ).length;

        return {
            name: technology.id,
            label: technology.name,
            researchTime: recipe ? toNumber(recipe.time) : 0,
            ingredients: recipe ? this.buildRecipeItems(recipe.in) : [],
            prerequisites: (info.prerequisites || []).map((id) => this.technologyRef(id)),
            unlockedRecipes: [],
            numberOfUnlockedRecipes: numberOfUnlockedRecipes,
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
     * The technologies that unlock a given recipe (the reverse of each technology's
     * `recipeUnlock`). This is the core research connection of a recipe; empty for recipes
     * available from the start.
     */
    public getRecipeResearch(recipeName: string): TechnologyData[] {
        return (this.technologyIdsByUnlockedRecipe.get(recipeName) || [])
            .map((id) => this.technologiesById.get(id))
            .filter((technology): technology is FactorioLabItem => technology !== undefined)
            .map((technology) => this.buildTechnologyResearch(technology));
    }

    /**
     * The technologies that unlock this item: every technology whose unlocked recipes include
     * a recipe producing the item. Empty for items available from the start. An item can be
     * unlocked by more than one technology (several producing recipes, or a recipe granted by
     * multiple technologies), so the result is a de-duplicated set.
     */
    public getItemResearch(item: FactorioLabItem): ItemResearchData {
        const technologyIds = new Set<string>();
        for (const recipeId of this.recipeIdsByProduct.get(item.id) || []) {
            for (const technologyId of this.technologyIdsByUnlockedRecipe.get(recipeId) || []) {
                technologyIds.add(technologyId);
            }
        }

        const technologies = [...technologyIds]
            .map((id) => this.technologiesById.get(id))
            .filter((technology): technology is FactorioLabItem => technology !== undefined)
            .map((technology) => this.buildTechnologyResearch(technology));

        return {
            type: this.typeOfItem(item),
            name: item.id,
            label: item.name,
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
        // disambiguate those results with the raw id so they are tellable apart. The counts
        // must consider ALL matches (cheap), even though only one page of entities is built.
        const labelCounts = new Map<string, number>();
        for (const { item } of scored) {
            labelCounts.set(item.name, (labelCounts.get(item.name) || 0) + 1);
        }

        // Slice to the requested page before building entities — each entity expands several
        // recipes, so building them for every match only to drop all but one page is wasteful.
        const pageSize = Config.numberOfSearchResultsPerPage;
        const entities = scored.slice((page - 1) * pageSize, page * pageSize).map(({ item }) => {
            const entity = this.buildItemEntity(item);
            if ((labelCounts.get(item.name) || 0) > 1) {
                entity.label = `${item.name} (${item.id})`;
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
     * and machines share the item namespace; recipes may point at another icon via their
     * icon field (as items may, too). Technologies live in their own namespace and carry
     * their own icon field.
     */
    public getIconRect(type: string, name: string): ResolvedIcon | null {
        if (type === "technology") {
            const technology = this.technologiesById.get(name);
            if (technology) {
                const icon = this.iconsById.get(technology.icon ?? technology.id);
                if (icon) {
                    return { icon, text: technology.iconText };
                }
            }
            return null;
        }

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
