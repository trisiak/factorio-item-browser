import { PackData } from "./PackData";
import { FactorioLabData } from "./factoriolab";
import { packs } from "./packs";

/**
 * Fully synthetic dataset (deliberately unlike any real game data) exercising the recipe- and
 * technology-list ordering rules:
 *  - non-technology recipes are interleaved with technology recipes in the data array, so the
 *    recipe list can be checked to keep data order while dropping the technology recipes;
 *  - the technologies form a diamond (a → {b, c} → d), a cost tie between two roots resolved
 *    by label, and a two-node prerequisite cycle (cyc-p ⇄ cyc-q).
 *
 * Research cost is time, then total science-pack amount, then label, then id. Here all techs
 * cost one "sci", so time drives the order: tech-c (15) is emitted before tech-b (20); the two
 * roots tie-early/tie-late both cost time 5, so their label breaks the tie ("Alpha" < "Beta")
 * even though the ids would order them the other way; the cycle nodes never reach in-degree 0
 * and are appended last, ordered by cost (cyc-q's time 50 before cyc-p's 100).
 */
const fixture: FactorioLabData = {
    version: {},
    items: [
        { id: "ore", name: "Ore", category: "raw", row: 0 },
        { id: "plate", name: "Plate", category: "smelting", row: 0 },
        { id: "gear", name: "Gear", category: "crafting", row: 0 },
        { id: "sci", name: "Science pack", category: "science", row: 0 },
        { id: "tech-a", name: "Tech A", category: "technology", row: 0, technology: { prerequisites: [] } },
        { id: "tech-b", name: "Tech B", category: "technology", row: 0, technology: { prerequisites: ["tech-a"] } },
        { id: "tech-c", name: "Tech C", category: "technology", row: 0, technology: { prerequisites: ["tech-a"] } },
        {
            id: "tech-d",
            name: "Tech D",
            category: "technology",
            row: 0,
            technology: { prerequisites: ["tech-b", "tech-c"] },
        },
        { id: "tie-early", name: "Alpha", category: "technology", row: 0, technology: { prerequisites: [] } },
        { id: "tie-late", name: "Beta", category: "technology", row: 0, technology: { prerequisites: [] } },
        { id: "cyc-p", name: "Cycle P", category: "technology", row: 0, technology: { prerequisites: ["cyc-q"] } },
        { id: "cyc-q", name: "Cycle Q", category: "technology", row: 0, technology: { prerequisites: ["cyc-p"] } },
    ],
    recipes: [
        {
            id: "tech-a",
            name: "Tech A",
            category: "technology",
            row: 0,
            time: 10,
            in: { sci: 1 },
            out: { "tech-a": 1 },
        },
        // Non-technology recipe, interleaved before the next technology recipe.
        {
            id: "smelt-plate",
            name: "Iron plate",
            category: "smelting",
            row: 0,
            time: 3,
            in: { ore: 1 },
            out: { plate: 1 },
        },
        {
            id: "tech-b",
            name: "Tech B",
            category: "technology",
            row: 0,
            time: 20,
            in: { sci: 1 },
            out: { "tech-b": 1 },
        },
        { id: "make-gear", name: "Gear", category: "crafting", row: 0, time: 1, in: { plate: 2 }, out: { gear: 1 } },
        {
            id: "tech-c",
            name: "Tech C",
            category: "technology",
            row: 0,
            time: 15,
            in: { sci: 1 },
            out: { "tech-c": 1 },
        },
        {
            id: "tech-d",
            name: "Tech D",
            category: "technology",
            row: 0,
            time: 30,
            in: { sci: 1 },
            out: { "tech-d": 1 },
        },
        {
            id: "tie-early",
            name: "Alpha",
            category: "technology",
            row: 0,
            time: 5,
            in: { sci: 1 },
            out: { "tie-early": 1 },
        },
        {
            id: "tie-late",
            name: "Beta",
            category: "technology",
            row: 0,
            time: 5,
            in: { sci: 1 },
            out: { "tie-late": 1 },
        },
        {
            id: "cyc-p",
            name: "Cycle P",
            category: "technology",
            row: 0,
            time: 100,
            in: { sci: 1 },
            out: { "cyc-p": 1 },
        },
        { id: "cyc-q", name: "Cycle Q", category: "technology", row: 0, time: 50, in: { sci: 1 }, out: { "cyc-q": 1 } },
    ],
    icons: [],
};

describe("PackData list ordering", (): void => {
    const packData = new PackData(packs[0], fixture);

    test("getRecipeList keeps data-array order and excludes technology recipes", (): void => {
        const list = packData.getRecipeList(1);

        expect(list.numberOfResults).toBe(2);
        expect(list.results).toEqual([
            { name: "smelt-plate", label: "Iron plate" },
            { name: "make-gear", label: "Gear" },
        ]);
    });

    test("getTechnologyList topologically orders technologies, cheapest-available first", (): void => {
        const order = packData.getTechnologyList(1).results.map((technology) => technology.name);

        expect(order).toEqual([
            // The two zero-prerequisite tie roots (time 5) come first; equal cost, so the
            // label breaks the tie ("Alpha" before "Beta") though the ids would reverse them.
            "tie-early",
            "tie-late",
            // tech-a (time 10) is the diamond root.
            "tech-a",
            // Its two dependents become available together; the cheaper (tech-c, 15) precedes
            // tech-b (20).
            "tech-c",
            "tech-b",
            // tech-d depends on both b and c, so it can only follow them.
            "tech-d",
            // The prerequisite cycle never becomes available; its nodes are appended last,
            // ordered by cost (cyc-q's time 50 before cyc-p's 100).
            "cyc-q",
            "cyc-p",
        ]);
    });

    test("a technology never precedes any of its prerequisites", (): void => {
        const order = packData.getTechnologyList(1).results.map((technology) => technology.name);
        const positionOf = (name: string): number => order.indexOf(name);

        // Diamond edges.
        expect(positionOf("tech-a")).toBeLessThan(positionOf("tech-b"));
        expect(positionOf("tech-a")).toBeLessThan(positionOf("tech-c"));
        expect(positionOf("tech-b")).toBeLessThan(positionOf("tech-d"));
        expect(positionOf("tech-c")).toBeLessThan(positionOf("tech-d"));
    });

    test("the technology list is complete, listing every technology exactly once", (): void => {
        const order = packData.getTechnologyList(1).results.map((technology) => technology.name);

        expect(order.length).toBe(8);
        expect(new Set(order).size).toBe(8);
        expect(order).toContain("cyc-p");
        expect(order).toContain("cyc-q");
    });
});
