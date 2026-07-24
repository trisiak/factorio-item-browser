/**
 * The neutral pack model: the small internal shape `PackData` answers every request from,
 * independent of where a pack's data came from.
 *
 * One adapter per source kind maps a published format into it — `factoriolab.ts` for
 * FactorioLab's `data.json`, `fbe.ts` for the fbe exporter's `browser/` artifact (see
 * docs/data-plane.md). Everything source-specific lives in those adapters: FactorioLab's
 * technology pseudo-items and science-pack recipes, its fraction strings, and the
 * calculator artifacts hidden from the browsable lists (the sxp quirk inventory in
 * docs/static-fork.md) never reach this model, and the fbe source — which has real
 * hidden flags, real research-unit counts and descriptions — needs none of those
 * mitigations.
 *
 * The model is deliberately a plain data shape, not a class: adapters build it eagerly at
 * load time, `PackData` indexes it once and keeps the arrays' order, which both sources
 * publish in the game's display order.
 */

export type PackItemType = "item" | "fluid";

/** A crafting machine's stats. Neither source publishes item/fluid slot counts. */
export type PackMachine = {
    craftingSpeed: number;
    numberOfModules: number;
    /** Energy usage in kW; `PackData` scales it to the tidiest unit for display. */
    energyUsageKw: number;
};

export type PackItem = {
    id: string;
    type: PackItemType;
    label: string;
    /** The in-game flavor text, when the source carries one (FactorioLab has none). */
    description?: string;
    /** Stack size; absent for fluids (and for sources that don't publish one). */
    stackSize?: number;
    /**
     * Whether the item appears in the item list, search and random picks. Adapters decide:
     * the fbe source excludes hidden prototypes at export time, so everything it publishes
     * is listable, while the FactorioLab adapter hides its dummy/orphan artifacts here.
     * Non-listable items stay fully resolvable by URL and as recipe ingredients.
     */
    listable: boolean;
    machine?: PackMachine;
    /** Key into `PackModel.icons`; absent when the source has no icon for the entity. */
    iconId?: string;
    /** Overlay text rendered on top of a shared icon (FactorioLab's steam temperatures). */
    iconText?: string;
};

/** An amount of an item on either side of a recipe (or of a research cost). */
export type PackRecipeItem = {
    id: string;
    amount: number;
};

export type PackRecipe = {
    id: string;
    label: string;
    description?: string;
    craftingTime: number;
    ingredients: PackRecipeItem[];
    products: PackRecipeItem[];
    /** Item ids of the machines able to craft the recipe. */
    producers: string[];
    iconId?: string;
    iconText?: string;
};

export type PackTechnology = {
    id: string;
    label: string;
    description?: string;
    /** Research time per unit in seconds; 0 for trigger/free technologies. */
    researchTime: number;
    /** The science packs one research unit consumes; empty for trigger technologies. */
    ingredients: PackRecipeItem[];
    /**
     * The number of research units. Undefined when the source carries none — FactorioLab
     * models research as a recipe and drops the count entirely.
     */
    researchCount?: number;
    /** The level formula of infinite/multi-level technologies, e.g. "2^L*1000". */
    researchCountFormula?: string;
    /** Technology ids that must be researched first. */
    prerequisites: string[];
    /** Recipe ids the technology unlocks. */
    unlockedRecipes: string[];
    iconId?: string;
    iconText?: string;
};

/** The top-left pixel of an icon's cell on the pack's spritesheet. */
export type PackIcon = {
    x: number;
    y: number;
};

export type PackIconSheet = {
    url: string;
    /**
     * The sheet's pixel dimensions, when the source publishes them (the fbe artifact's
     * icons.json does). Absent for FactorioLab, whose sheet has to be measured by loading
     * the image before the percentage-based icon CSS can be generated.
     */
    width?: number;
    height?: number;
};

export type PackMod = {
    name: string;
    version: string;
};

export type PackModel = {
    mods: PackMod[];
    /** Items and fluids in display order; technologies are never part of this list. */
    items: PackItem[];
    /** Recipes in display order; research "recipes" are never part of this list. */
    recipes: PackRecipe[];
    technologies: PackTechnology[];
    icons: Map<string, PackIcon>;
    iconSheet: PackIconSheet;
};
