import { faGithub, IconDefinition } from "@fortawesome/free-brands-svg-icons";

type FooterIcon = {
    name: string;
    url: string;
    icon: IconDefinition;
};

export const Config = {
    // env variables
    cacheLifetime: parseInt(process.env.CACHE_LIFETIME || "", 10),
    /**
     * The path prefix the app is served under (e.g. "/factorio-item-browser" on GitHub
     * Pages project sites), without a trailing slash. Empty when served from the root.
     * Injected at build time via the BASE_PATH env variable.
     */
    basePath: (process.env.BASE_PATH || "").replace(/\/$/, ""),

    // Static configuration values
    craftingTimeInfinite: 100000,
    numberOfIconsPerRequest: 128,
    numberOfItemsPerPage: 1024,
    numberOfItemRecipesPerPage: 12,
    numberOfMachinesPerPage: 12,
    numberOfRandomItems: 12,
    numberOfRecipesPerEntity: 3,
    numberOfSearchResultsPerPage: 24,

    footerIcons: [
        {
            name: "github",
            url: "https://github.com/trisiak/factorio-item-browser",
            icon: faGithub,
        },
    ] as FooterIcon[],
};
