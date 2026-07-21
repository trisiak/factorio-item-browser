import i18next from "i18next";

/**
 * Humanizes an internal entity name into a readable fallback label, e.g. "iron-plate" -> "Iron plate".
 * Used as an accessible name for icon-only entity links where no translated label is available.
 */
export function humanizeName(name: string): string {
    const text = name.replace(/[-_]+/g, " ").trim();
    if (text === "") {
        return name;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Formats the specified amount to a nice human-readable string.
 */
export function formatAmount(amount: number): string {
    if (amount > 1000000) {
        return Math.round(amount / 100000) / 10 + "M";
    }
    if (amount > 1000) {
        return Math.round(amount / 100) / 10 + "k";
    }
    if (amount < 1) {
        return Math.round(amount * 1000) / 10 + "%";
    }
    return Math.round(amount * 10) / 10 + "x";
}

/**
 * Formats the crafting speed to a nice human-readable string.
 */
export function formatCraftingSpeed(craftingSpeed: number): string {
    return Math.round(craftingSpeed * 100) / 100 + "x";
}

/**
 * Formats the crafting time to a nice human-readable string.
 */
export function formatCraftingTime(craftingTime: number): string {
    if (craftingTime <= 0) {
        return "";
    }
    if (craftingTime <= 600) {
        return Math.round(craftingTime * 100) / 100 + "s";
    }
    if (craftingTime <= 36000) {
        return Math.round((craftingTime * 100) / 60) / 100 + "min";
    }
    if (craftingTime <= 86400) {
        return Math.round((craftingTime * 100) / 3600) / 100 + "h";
    }

    return "∞";
}

/**
 * Formats the energy usage to a nice human-readable string.
 */
export function formatEnergyUsage(energyUsage: number, energyUsageUnit: string): string {
    return Math.round(energyUsage * 1000) / 1000 + energyUsageUnit;
}

/**
 * Formats the number of slots of a machine.
 */
export function formatMachineSlots(slots: number): string {
    if (slots === 0) {
        return i18next.t("recipe-details.machine.none");
    }
    if (slots === 255) {
        return i18next.t("recipe-details.machine.unlimited");
    }
    return `${slots}`;
}
