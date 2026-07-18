/**
 * The bundled pack manifest — the static replacement for the server-side combination system.
 *
 * Each pack maps a fixed, pre-generated dataset (currently FactorioLab's published data,
 * see https://github.com/factoriolab/factoriolab) to a synthetic combination id, so the
 * existing URL scheme, storage scoping and icon CSS selectors keep working unchanged.
 * The pack ids are aligned with the fbe fork's packs.json so the two projects can share
 * a manifest once a common data plane exists (see docs/static-fork.md, "Bigger picture").
 *
 * The combination ids are arbitrary but MUST stay stable forever: they scope localStorage
 * (sidebar, options) and appear in shareable URLs.
 */
export type PackSource = {
    kind: "factoriolab";
    /** Base URL of the pack's data, containing data.json, icons.webp and i18n/<lang>.json. */
    baseUrl: string;
};

export type PackDefinition = {
    /** Stable pack id, aligned with the fbe fork's pack ids where the mod sets correspond. */
    id: string;
    /** Human-readable name, shown as the setting name. */
    label: string;
    /** Synthetic combination id (full UUID form). Never change these. */
    combinationId: string;
    source: PackSource;
};

const FACTORIOLAB_DATA_ROOT = "https://factoriolab.github.io/data";

export const packs: PackDefinition[] = [
    {
        id: "vanilla-2.0",
        label: "Vanilla 2.0",
        combinationId: "fab1a000-0000-4000-8000-000000000001",
        source: { kind: "factoriolab", baseUrl: `${FACTORIOLAB_DATA_ROOT}/2.0` },
    },
    {
        id: "space-age",
        label: "Space Age (2.0)",
        combinationId: "fab1a000-0000-4000-8000-000000000002",
        source: { kind: "factoriolab", baseUrl: `${FACTORIOLAB_DATA_ROOT}/spa` },
    },
    {
        id: "space-exploration",
        label: "Space Exploration",
        combinationId: "fab1a000-0000-4000-8000-000000000003",
        source: { kind: "factoriolab", baseUrl: `${FACTORIOLAB_DATA_ROOT}/sxp` },
    },
];

export const defaultPack = packs[0];

export function findPackByCombinationId(combinationId: string): PackDefinition | null {
    return packs.find((pack) => pack.combinationId === combinationId) ?? null;
}
