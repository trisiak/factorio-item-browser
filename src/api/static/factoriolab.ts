/**
 * Minimal typings for FactorioLab's published data format, covering only the fields this
 * app consumes. The authoritative schema lives in the factoriolab repo under
 * src/data/schema/*.ts; anything not needed here is intentionally left untyped.
 */

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
