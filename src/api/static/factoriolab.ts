/**
 * The FactorioLab source adapter: minimal typings for FactorioLab's published data format
 * (covering only the fields this app consumes — the authoritative schema lives in the
 * factoriolab repo under src/data/schema/*.ts), plus the mapping of that format into the
 * neutral pack model (model.ts).
 *
 * Everything FactorioLab-specific lives here: research modelled as pseudo-items plus
 * same-id science recipes, fraction strings for amounts, and the calculator artifacts the
 * item list hides (see the sxp quirk inventory in docs/static-fork.md).
 */

import { ServiceNotAvailableError } from "../../error/page";
import { fetchPackJson } from "./fetchJson";
import { PackIcon, PackItem, PackModel, PackRecipe, PackRecipeItem, PackTechnology } from "./model";
import { PackDefinition } from "./packs";

/** Numbers may be serialized as fractions ("3/2") in some fields. */
export type FactorioLabRational = number | string;

export type FactorioLabMachine = {
    speed?: FactorioLabRational;
    modules?: number;
    type?: string;
    usage?: FactorioLabRational;
    drain?: FactorioLabRational;
    size?: [number, number];
};

/**
 * Technology metadata attached to items in category "technology". `recipeUnlock` lists the
 * recipe ids the technology unlocks; `prerequisites` lists the technology ids that must be
 * researched first (both resolve within the same pack). The remaining fields describe
 * effect/infinite techs and are not consumed here.
 */
export type FactorioLabTechnology = {
    prerequisites?: string[];
    recipeUnlock?: string[];
    researchSpeed?: number;
    miningProductivity?: number;
    inserterStack?: boolean;
};

export type FactorioLabItem = {
    id: string;
    name: string;
    category: string;
    row: number;
    stack?: number;
    icon?: string;
    iconText?: string;
    machine?: FactorioLabMachine;
    technology?: FactorioLabTechnology;
};

export type FactorioLabRecipe = {
    id: string;
    name: string;
    category: string;
    row: number;
    time: FactorioLabRational;
    producers?: string[];
    in?: { [itemId: string]: FactorioLabRational };
    out?: { [itemId: string]: FactorioLabRational };
    flags?: string[];
    icon?: string;
    iconText?: string;
};

export type FactorioLabIcon = {
    id: string;
    x: number;
    y: number;
    color?: string;
};

export type FactorioLabData = {
    /** Map of mod name to mod version the pack was generated from. */
    version: { [modName: string]: string };
    items: FactorioLabItem[];
    recipes: FactorioLabRecipe[];
    icons: FactorioLabIcon[];
};

/**
 * Normalizes a FactorioLab rational to a plain number, parsing fraction strings.
 */
export function toNumber(value: FactorioLabRational | undefined, fallback = 0): number {
    if (typeof value === "number") {
        return value;
    }
    if (typeof value === "string") {
        const parts = value.split("/");
        if (parts.length === 2) {
            const numerator = parseFloat(parts[0]);
            const denominator = parseFloat(parts[1]);
            if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                return numerator / denominator;
            }
        }
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }
    return fallback;
}

function isTechnologyItem(item: FactorioLabItem): boolean {
    return item.category === "technology" || item.technology !== undefined;
}

function isTechnologyRecipe(recipe: FactorioLabRecipe): boolean {
    return recipe.category === "technology" || (recipe.flags || []).includes("technology");
}

function mapRecipeItems(side: { [itemId: string]: FactorioLabRational } | undefined): PackRecipeItem[] {
    return Object.entries(side || {}).map(([id, amount]) => ({ id, amount: toNumber(amount, 1) }));
}

/**
 * Maps a downloaded FactorioLab dataset into the neutral pack model. The `baseUrl` is only
 * needed for the spritesheet URL — FactorioLab does not publish its dimensions, so they are
 * measured from the image later (see StaticPortalApi.loadIconSheet).
 */
export function mapFactorioLabData(data: FactorioLabData, baseUrl: string): PackModel {
    const recipes: PackRecipe[] = [];
    const ingredientIds = new Set<string>();
    const productIds = new Set<string>();
    for (const recipe of data.recipes) {
        if (isTechnologyRecipe(recipe)) {
            continue;
        }
        const ingredients = mapRecipeItems(recipe.in);
        const products = mapRecipeItems(recipe.out);
        for (const { id } of ingredients) {
            ingredientIds.add(id);
        }
        for (const { id } of products) {
            productIds.add(id);
        }

        recipes.push({
            id: recipe.id,
            label: recipe.name,
            craftingTime: toNumber(recipe.time),
            ingredients: ingredients,
            products: products,
            producers: recipe.producers || [],
            iconId: recipe.icon ?? recipe.id,
            iconText: recipe.iconText,
        });
    }

    const items: PackItem[] = [];
    for (const item of data.items) {
        if (isTechnologyItem(item)) {
            continue;
        }
        const machine = item.machine;
        items.push({
            id: item.id,
            type: item.category === "fluids" ? "fluid" : "item",
            label: item.name,
            // Mod-internal dummy items (e.g. SE's cargo-rocket pseudo ingredients) and items
            // appearing in no recipe at all (calculator artifacts like steam-temperature
            // variants) stay resolvable by URL/reference, but are hidden from the item list,
            // search and random picks. See docs/static-fork.md.
            stackSize: item.stack,
            listable:
                !item.id.includes("-dummy-") &&
                (machine !== undefined || ingredientIds.has(item.id) || productIds.has(item.id)),
            machine: machine
                ? {
                      craftingSpeed: toNumber(machine.speed, 1),
                      numberOfModules: machine.modules ?? 0,
                      energyUsageKw: toNumber(machine.usage),
                  }
                : undefined,
            iconId: item.icon ?? item.id,
            iconText: item.iconText,
        });
    }

    // A technology is an item (category "technology", carrying the technology sub-object)
    // paired with a same-id recipe holding its science-pack cost (in) and research time.
    const technologyRecipes = new Map<string, FactorioLabRecipe>();
    for (const recipe of data.recipes) {
        if (isTechnologyRecipe(recipe)) {
            technologyRecipes.set(recipe.id, recipe);
        }
    }

    const technologies: PackTechnology[] = [];
    for (const item of data.items) {
        if (!isTechnologyItem(item)) {
            continue;
        }
        const recipe = technologyRecipes.get(item.id);
        technologies.push({
            id: item.id,
            label: item.name,
            researchTime: recipe ? toNumber(recipe.time) : 0,
            ingredients: recipe ? mapRecipeItems(recipe.in) : [],
            // FactorioLab carries no research-unit count; researchCount stays undefined.
            prerequisites: item.technology?.prerequisites || [],
            unlockedRecipes: item.technology?.recipeUnlock || [],
            iconId: item.icon ?? item.id,
            iconText: item.iconText,
        });
    }

    const icons = new Map<string, PackIcon>();
    for (const icon of data.icons || []) {
        icons.set(icon.id, { x: icon.x, y: icon.y });
    }

    return {
        mods: Object.entries(data.version || {}).map(([name, version]) => ({ name, version })),
        items: items,
        recipes: recipes,
        technologies: technologies,
        icons: icons,
        iconSheet: { url: `${baseUrl}/icons.webp` },
    };
}

/** Downloads and maps a FactorioLab-sourced pack. */
export async function loadFactorioLabPack(pack: PackDefinition): Promise<PackModel> {
    const data = await fetchPackJson<FactorioLabData>(`${pack.source.baseUrl}/data.json`, pack.id);

    // Fail legibly on upstream format drift rather than deep inside the mapping: the two
    // lists this app indexes must be arrays (icons may be absent — the pack then has no icons).
    if (!Array.isArray(data.items) || !Array.isArray(data.recipes)) {
        throw new ServiceNotAvailableError(
            `The data of pack "${pack.id}" is malformed: "items" and "recipes" must be arrays.`,
        );
    }

    return mapFactorioLabData(data, pack.source.baseUrl);
}
