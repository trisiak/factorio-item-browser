/**
 * The fbe source adapter: typings for the browser artifact the fbe fork's Rust exporter
 * publishes per pack (`<baseUrl>/catalog.json` + `icons.json` + the sheet it names), and the
 * mapping of that artifact into the neutral pack model (model.ts).
 *
 * The artifact is a curated projection of Factorio's own dump flags — see
 * docs/data-plane.md and the exporter's README. What it gives us over FactorioLab:
 * descriptions, real research-unit counts, exact mod sets, and prototypes filtered by the
 * game's real hidden flags (so none of the FactorioLab dummy/orphan mitigations apply here —
 * everything published is browsable). Items and fluids arrive as separate arrays, already
 * sorted in the game's display order; recipes carry their producers baked in.
 */

import { ServiceNotAvailableError } from "../../error/page";
import { fetchPackJson } from "./fetchJson";
import { PackIcon, PackItem, PackModel, PackRecipeItem, PackTechnology } from "./model";
import { PackDefinition } from "./packs";

export type FbeMachine = {
    speed?: number;
    moduleSlots?: number;
    energyUsageKw?: number;
    craftingCategories?: string[];
};

export type FbeItem = {
    id: string;
    label: string;
    /** Omitted when the game has no description for the prototype. */
    description?: string;
    stackSize?: number;
    group?: string;
    subgroup?: string;
    iconId?: string;
    /** Present only when the item places a crafting machine. */
    machine?: FbeMachine;
};

/** Fluids carry the same fields as items minus the stack size and machine sub-object. */
export type FbeFluid = FbeItem;

export type FbeRecipeItem = {
    type?: string;
    id: string;
    amount?: number;
    /** Omitted when 1. */
    probability?: number;
};

export type FbeRecipe = {
    id: string;
    label: string;
    description?: string;
    /** energy_required, in seconds. */
    time?: number;
    category?: string;
    ingredients?: FbeRecipeItem[];
    results?: FbeRecipeItem[];
    /** Item ids of the machines whose crafting categories cover this recipe. */
    producers?: string[];
    /** Present only when the recipe has its OWN icon; otherwise the first result's icon wins. */
    iconId?: string;
};

/** The research cost. Omitted entirely for 2.0 trigger technologies. */
export type FbeTechnologyUnit = {
    /** The real research-unit count; absent for formula-driven (infinite) technologies. */
    count?: number;
    /** Seconds per unit. */
    time?: number;
    ingredients?: { id: string; amount?: number }[];
};

export type FbeTechnology = {
    id: string;
    label: string;
    description?: string;
    prerequisites?: string[];
    /** Recipe ids. */
    unlocks?: string[];
    iconId?: string;
    unit?: FbeTechnologyUnit;
    /** Only for trigger technologies (the prototype's trigger type); `unit` is absent then. */
    researchTrigger?: string;
    /** Infinite/multi-level technologies: the level formula, e.g. "2^L*1000". */
    countFormula?: string;
    /** "infinite" or a number as a string; not consumed yet. */
    maxLevel?: string;
};

export type FbeCatalog = {
    schemaVersion: number;
    generated: string;
    pack: {
        id: string;
        label: string;
        factorioVersion?: string;
        /** The actually-loaded mod set. */
        mods?: { name: string; version: string }[];
    };
    items: FbeItem[];
    fluids: FbeFluid[];
    recipes: FbeRecipe[];
    technologies: FbeTechnology[];
};

export type FbeIcons = {
    schemaVersion: number;
    /** 64 px cells with a 2 px gutter — the same geometry FactorioLab's sheets use. */
    sheet: {
        file: string;
        width: number;
        height: number;
        cell?: number;
        padding?: number;
    };
    /** Namespaced icon id ("item/…", "fluid/…", "recipe/…", "technology/…") → cell position. */
    icons: { [iconId: string]: PackIcon };
};

function toAmount(amount: number | undefined): number {
    return typeof amount === "number" ? amount : 1;
}

function mapRecipeItems(side: FbeRecipeItem[] | undefined): PackRecipeItem[] {
    // Probabilistic results fold their probability into the amount as an
    // expected value — the same convention FactorioLab's packs use, and what
    // `formatAmount` renders as a percentage when it lands below 1 (e.g. SE's
    // holmium chloride: amount 1 × probability 0.25 → "25%"). Ingredients never
    // carry a probability, so this is a no-op for them.
    return (side || []).map((entry) => ({
        id: entry.id,
        amount: toAmount(entry.amount) * (entry.probability ?? 1),
    }));
}

function isObject(value: unknown): boolean {
    return typeof value === "object" && value !== null;
}

/**
 * Maps a downloaded browser artifact into the neutral pack model.
 *
 * Items and fluids are merged into the single list this app browses, items first — the
 * catalog sorts each array in display order but carries no order across the two, and the
 * game shows fluids in their own crafting-menu group anyway. Ids are unique per array but
 * not necessarily across them (2.0's `parameter-N` blueprint placeholders exist as both an
 * item and a fluid); the item wins, the way the rest of this app keys entities by bare id.
 */
export function mapFbeCatalog(catalog: FbeCatalog, icons: FbeIcons, baseUrl: string): PackModel {
    const items: PackItem[] = [];
    const seenIds = new Set<string>();
    for (const [source, type] of [
        [catalog.items, "item"],
        [catalog.fluids, "fluid"],
    ] as [FbeItem[], PackItem["type"]][]) {
        for (const item of source) {
            if (seenIds.has(item.id)) {
                continue;
            }
            seenIds.add(item.id);

            const machine = item.machine;
            items.push({
                id: item.id,
                type: type,
                label: item.label,
                description: item.description,
                stackSize: item.stackSize,
                // The exporter already drops the game's hidden prototypes, so everything the
                // catalog publishes belongs in the list, search and random picks.
                listable: true,
                machine: machine
                    ? {
                          craftingSpeed: machine.speed ?? 1,
                          numberOfModules: machine.moduleSlots ?? 0,
                          energyUsageKw: machine.energyUsageKw ?? 0,
                      }
                    : undefined,
                iconId: item.iconId,
            });
        }
    }

    const technologies: PackTechnology[] = catalog.technologies.map((technology) => ({
        id: technology.id,
        label: technology.label,
        description: technology.description,
        researchTime: technology.unit?.time ?? 0,
        ingredients: (technology.unit?.ingredients || []).map((ingredient) => ({
            id: ingredient.id,
            amount: toAmount(ingredient.amount),
        })),
        researchCount: technology.unit?.count,
        researchCountFormula: technology.countFormula,
        prerequisites: technology.prerequisites || [],
        unlockedRecipes: technology.unlocks || [],
        iconId: technology.iconId,
    }));

    const iconMap = new Map<string, PackIcon>();
    for (const [iconId, rect] of Object.entries(icons.icons || {})) {
        iconMap.set(iconId, { x: rect.x, y: rect.y });
    }

    const sheet = icons.sheet;
    return {
        mods: catalog.pack?.mods || [],
        items: items,
        recipes: catalog.recipes.map((recipe) => ({
            id: recipe.id,
            label: recipe.label,
            description: recipe.description,
            craftingTime: recipe.time ?? 0,
            ingredients: mapRecipeItems(recipe.ingredients),
            products: mapRecipeItems(recipe.results),
            producers: recipe.producers || [],
            // Recipes without an own icon fall back to their first result's icon, which
            // PackData.getIconRect resolves through the merged item list.
            iconId: recipe.iconId,
        })),
        technologies: technologies,
        icons: iconMap,
        iconSheet: {
            // The sheet names its own file (webp today, so consumers do not hardcode it) and
            // publishes its dimensions, so the icon CSS needs no image measuring step.
            url: `${baseUrl}/${sheet?.file || "icons.webp"}`,
            width: sheet?.width,
            height: sheet?.height,
        },
    };
}

/** Downloads and maps an fbe-sourced pack: the catalog and the icon rects in parallel. */
export async function loadFbePack(pack: PackDefinition): Promise<PackModel> {
    const [catalog, icons] = await Promise.all([
        fetchPackJson<FbeCatalog>(`${pack.source.baseUrl}/catalog.json`, pack.id),
        fetchPackJson<FbeIcons>(`${pack.source.baseUrl}/icons.json`, pack.id),
    ]);

    // Fail legibly on artifact-format drift rather than deep inside the mapping.
    if (
        !Array.isArray(catalog.items) ||
        !Array.isArray(catalog.fluids) ||
        !Array.isArray(catalog.recipes) ||
        !Array.isArray(catalog.technologies)
    ) {
        throw new ServiceNotAvailableError(
            `The catalog of pack "${pack.id}" is malformed: "items", "fluids", "recipes" and ` +
                `"technologies" must be arrays.`,
        );
    }
    if (!isObject(icons.sheet) || !isObject(icons.icons)) {
        throw new ServiceNotAvailableError(
            `The icons of pack "${pack.id}" are malformed: "sheet" and "icons" must be objects.`,
        );
    }
    // The artifact contract guarantees the sheet file name and dimensions (that's what
    // spares the Image-measuring pass) — validate them here so drift fails as a clear
    // pack-named error instead of silently degrading into broken percentage math.
    const { file, width, height } = icons.sheet;
    if (
        typeof file !== "string" ||
        file === "" ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        (width as number) <= 0 ||
        (height as number) <= 0
    ) {
        throw new ServiceNotAvailableError(
            `The icons of pack "${pack.id}" are malformed: "sheet" must carry a file name ` +
                `and positive width/height.`,
        );
    }

    return mapFbeCatalog(catalog, icons, pack.source.baseUrl);
}
