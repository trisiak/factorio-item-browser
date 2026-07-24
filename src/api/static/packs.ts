/**
 * The bundled pack manifest — the static replacement for the server-side combination system.
 *
 * Each pack maps a fixed, pre-generated dataset to a synthetic combination id, so the
 * existing URL scheme, storage scoping and icon CSS selectors keep working unchanged. Two
 * source kinds are supported, each with its own adapter behind the same seam:
 *  - `factoriolab` — FactorioLab's published data (https://github.com/factoriolab/factoriolab),
 *    which keeps ready-made modpacks one manifest entry away;
 *  - `fbe` — the browser artifact our own exporter publishes (the fbe fork's
 *    `data/<pack>/browser/`), which carries descriptions, real research-unit counts and the
 *    exact mod sets. See docs/data-plane.md.
 *
 * The combination ids are arbitrary but MUST stay stable forever: they scope localStorage
 * (sidebar, options) and appear in shareable URLs. A pack's data basis therefore never
 * changes under an existing id — the fbe-sourced packs got their own ids even where they
 * mirror a FactorioLab entry's mod set.
 */
export type PackSource =
    | {
          kind: "factoriolab";
          /** Base URL of the pack's data, containing data.json, icons.webp and i18n/<lang>.json. */
          baseUrl: string;
      }
    | {
          kind: "fbe";
          /** Base URL of the pack's browser artifact, containing catalog.json and icons.json. */
          baseUrl: string;
      };

export type PackDefinition = {
    /** Stable pack id; unique within this manifest and used to key caches and localStorage. */
    id: string;
    /** Human-readable name, shown as the setting name. */
    label: string;
    /** Synthetic combination id (full UUID form). Never change these. */
    combinationId: string;
    source: PackSource;
};

const FACTORIOLAB_DATA_ROOT = "https://factoriolab.github.io/data";
const FBE_DATA_ROOT = "https://trisiak.github.io/factorio-blueprint-editor/data";

export const packs: PackDefinition[] = [
    {
        id: "vanilla-2.0",
        label: "Vanilla 2.0 (FactorioLab)",
        combinationId: "fab1a000-0000-4000-8000-000000000001",
        source: { kind: "factoriolab", baseUrl: `${FACTORIOLAB_DATA_ROOT}/2.0` },
    },
    {
        id: "space-age",
        label: "Space Age (2.0) (FactorioLab)",
        combinationId: "fab1a000-0000-4000-8000-000000000002",
        source: { kind: "factoriolab", baseUrl: `${FACTORIOLAB_DATA_ROOT}/spa` },
    },
    {
        id: "space-exploration",
        label: "Space Exploration (1.1, FactorioLab)",
        combinationId: "fab1a000-0000-4000-8000-000000000003",
        source: { kind: "factoriolab", baseUrl: `${FACTORIOLAB_DATA_ROOT}/sxp` },
    },
    // The fbe-sourced packs. Their pack ids carry an "-fbe" suffix because the plain ids are
    // taken by the FactorioLab entries above (pack ids key the in-memory and localStorage
    // caches, so they must stay unique here); the ids in the data host's URLs are the plain
    // ones. Serving goes live when the fbe branch publishing the browser artifacts merges.
    {
        id: "vanilla-2.0-fbe",
        label: "Vanilla 2.0",
        combinationId: "fab1a000-0000-4000-8000-000000000011",
        source: { kind: "fbe", baseUrl: `${FBE_DATA_ROOT}/vanilla-2.0/browser` },
    },
    {
        id: "space-age-fbe",
        label: "Space Age (2.0)",
        combinationId: "fab1a000-0000-4000-8000-000000000012",
        source: { kind: "fbe", baseUrl: `${FBE_DATA_ROOT}/space-age/browser` },
    },
    {
        id: "space-exploration-fbe",
        label: "Space Exploration (2.0)",
        combinationId: "fab1a000-0000-4000-8000-000000000013",
        source: { kind: "fbe", baseUrl: `${FBE_DATA_ROOT}/space-exploration/browser` },
    },
];

/**
 * The pack a visit without a (known) combination id falls back to. Still the FactorioLab
 * vanilla set: the fbe-sourced URLs only start serving once the fbe branch merges and its
 * Pages deploy runs, and the default must never point at a 404. Flipping it to
 * `vanilla-2.0-fbe` is the deferred follow-up tracked in docs/data-plane.md (slice 1d).
 */
export const defaultPack = packs[0];

export function findPackByCombinationId(combinationId: string): PackDefinition | null {
    return packs.find((pack) => pack.combinationId === combinationId) ?? null;
}
