import { faGithub, IconDefinition } from "@fortawesome/free-brands-svg-icons";

type FooterIcon = {
    name: string;
    url: string;
    icon: IconDefinition;
};

export const Config = {
    // env variables
    cacheLifetime: parseInt(process.env.CACHE_LIFETIME || "", 10),
    discordLink: process.env.DISCORD_LINK || "",
    intervalCheckSettingStatus: parseInt(process.env.INTERVAL_CHECK_SETTING_STATUS || "", 10),
    portalApiUrl: process.env.PORTAL_API_URI || "",

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
