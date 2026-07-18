import { CombinationId } from "../../class/CombinationId";
import { StorageManager } from "../../class/StorageManager";
import { PageNotFoundError, ServiceNotAvailableError } from "../../error/page";
import { Config } from "../../util/config";
import { RecipeMode, SettingStatus } from "../../util/const";
import { PortalApi } from "../PortalApi";
import {
    EntityData,
    IconsStyleData,
    IconsStyleRequestData,
    InitData,
    ItemListData,
    ItemRecipesData,
    ItemType,
    ModData,
    RecipeDetailsData,
    RecipeMachinesData,
    SearchResultsData,
    SettingData,
    SettingOptionsData,
    SidebarEntityData,
} from "../transfer";
import { PackData } from "./PackData";
import { FactorioLabData } from "./factoriolab";
import { defaultPack, findPackByCombinationId, PackDefinition, packs } from "./packs";

/**
 * The script version is compared against localStorage on boot to force-reload stale
 * deploys. A constant works because the build hash changes the bundle URL anyway; bump it
 * to force one reload of all clients after a breaking storage change.
 */
const SCRIPT_VERSION = "static-1";

const KEY_SETTING_OPTIONS = "staticSettingOptions";

type PersistedOptions = Partial<SettingOptionsData>;

/** The icon cell size of FactorioLab spritesheets (66 px stride with a 2 px gutter). */
const ICON_CELL_SIZE = 64;

type IconSheet = {
    url: string;
    width: number;
    height: number;
};

/** Pack data is cached per pack id across all api instances (including combination-bound ones). */
const packDataCache = new Map<string, Promise<PackData>>();
const iconSheetCache = new Map<string, Promise<IconSheet>>();

/** Drops all cached pack data. Only needed by tests. */
export function clearPackDataCache(): void {
    packDataCache.clear();
    iconSheetCache.clear();
}

/**
 * The static replacement of the Portal API: answers every request from the bundled pack
 * manifest and the pack's published data files, fetched once and kept in memory. No
 * backend involved; user state (options, sidebar) lives in localStorage.
 */
export class StaticPortalApi implements PortalApi {
    private readonly storageManager: StorageManager;
    private readonly combinationId?: CombinationId;

    public constructor(storageManager: StorageManager, combinationId?: CombinationId) {
        this.storageManager = storageManager;
        this.combinationId = combinationId;
    }

    public withCombinationId(combinationId: CombinationId): PortalApi {
        return new StaticPortalApi(this.storageManager, combinationId);
    }

    private currentPack(): PackDefinition {
        const combinationId = this.combinationId ?? this.storageManager.combinationId;
        if (combinationId !== null && combinationId !== undefined) {
            const pack = findPackByCombinationId(combinationId.toFull());
            if (pack) {
                return pack;
            }
        }
        return defaultPack;
    }

    private async loadPackData(pack: PackDefinition): Promise<PackData> {
        let promise = packDataCache.get(pack.id);
        if (!promise) {
            promise = this.fetchPackData(pack);
            packDataCache.set(pack.id, promise);
        }

        try {
            return await promise;
        } catch (e) {
            // Do not cache failures — a later navigation should retry the download.
            packDataCache.delete(pack.id);
            throw e;
        }
    }

    private async fetchPackData(pack: PackDefinition): Promise<PackData> {
        let response: Response;
        try {
            response = await fetch(`${pack.source.baseUrl}/data.json`);
        } catch (e) {
            throw new ServiceNotAvailableError(`Failed to download the data of pack "${pack.id}".`);
        }
        if (!response.ok) {
            throw new ServiceNotAvailableError(
                `Failed to download the data of pack "${pack.id}": HTTP ${response.status}`,
            );
        }

        const data = (await response.json()) as FactorioLabData;
        return new PackData(pack, data);
    }

    private async currentPackData(): Promise<PackData> {
        return this.loadPackData(this.currentPack());
    }

    private readPersistedOptions(packId: string): PersistedOptions {
        try {
            const serialized = window.localStorage.getItem(`${KEY_SETTING_OPTIONS}-${packId}`);
            return serialized ? (JSON.parse(serialized) as PersistedOptions) : {};
        } catch (e) {
            return {};
        }
    }

    private writePersistedOptions(packId: string, options: PersistedOptions): void {
        try {
            window.localStorage.setItem(`${KEY_SETTING_OPTIONS}-${packId}`, JSON.stringify(options));
        } catch (e) {
            // Ignore quota errors — the options are a convenience, not critical state.
        }
    }

    private buildSettingData(pack: PackDefinition): SettingData {
        const options = this.readPersistedOptions(pack.id);
        return {
            combinationId: pack.combinationId,
            combinationHash: `static-${pack.id}`,
            name: options.name || pack.label,
            locale: options.locale || "en",
            recipeMode: (options.recipeMode as RecipeMode) || RecipeMode.Hybrid,
            status: SettingStatus.Available,
            isTemporary: false,
        };
    }

    public async initializeSession(): Promise<InitData> {
        const pack = this.currentPack();

        // Make sure the storage is scoped before reading from it: on a fresh visit without
        // a combination id in the URL the sidebar getter would otherwise no-op.
        if (this.storageManager.combinationId === null) {
            this.storageManager.combinationId = CombinationId.fromFull(pack.combinationId);
        }

        return {
            setting: this.buildSettingData(pack),
            sidebarEntities: this.storageManager.sidebarEntities,
            scriptVersion: SCRIPT_VERSION,
        };
    }

    public async getItemIngredientRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData> {
        return this.getItemRecipes(type, name, "ingredient", page);
    }

    public async getItemProductRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData> {
        return this.getItemRecipes(type, name, "product", page);
    }

    private async getItemRecipes(
        type: ItemType,
        name: string,
        side: "ingredient" | "product",
        page: number,
    ): Promise<ItemRecipesData> {
        const packData = await this.currentPackData();
        const item = packData.getItem(type, name);
        if (!item) {
            throw new PageNotFoundError(`The item "${type}/${name}" is not known in this pack.`);
        }
        return packData.getItemRecipes(item, side, page);
    }

    public async getItemList(page: number): Promise<ItemListData> {
        const packData = await this.currentPackData();
        return packData.getItemList(page);
    }

    public async getRandom(): Promise<EntityData[]> {
        const packData = await this.currentPackData();
        return packData.getRandomEntities(Config.numberOfRandomItems);
    }

    public async getRecipeDetails(name: string): Promise<RecipeDetailsData> {
        const packData = await this.currentPackData();
        const details = packData.getRecipeDetails(name);
        if (!details) {
            throw new PageNotFoundError(`The recipe "${name}" is not known in this pack.`);
        }
        return details;
    }

    public async getRecipeMachines(name: string, page: number): Promise<RecipeMachinesData> {
        const packData = await this.currentPackData();
        const machines = packData.getRecipeMachines(name, page);
        if (!machines) {
            throw new PageNotFoundError(`The recipe "${name}" is not known in this pack.`);
        }
        return machines;
    }

    public async search(query: string, page: number): Promise<SearchResultsData> {
        const packData = await this.currentPackData();
        return packData.search(query, page);
    }

    public async getSettings(): Promise<SettingData[]> {
        return packs.map((pack) => this.buildSettingData(pack));
    }

    public async getSetting(combinationId: string): Promise<SettingData> {
        const pack = findPackByCombinationId(combinationId);
        if (!pack) {
            throw new PageNotFoundError(`No pack is known for the combination "${combinationId}".`);
        }
        return this.buildSettingData(pack);
    }

    public async saveSetting(combinationId: string, options: SettingOptionsData): Promise<void> {
        const pack = findPackByCombinationId(combinationId);
        if (!pack) {
            throw new PageNotFoundError(`No pack is known for the combination "${combinationId}".`);
        }
        this.writePersistedOptions(pack.id, options);
    }

    public async getSettingMods(combinationId: string): Promise<ModData[]> {
        const pack = findPackByCombinationId(combinationId);
        if (!pack) {
            throw new PageNotFoundError(`No pack is known for the combination "${combinationId}".`);
        }
        const packData = await this.loadPackData(pack);
        return packData.getMods();
    }

    private async loadIconSheet(pack: PackDefinition): Promise<IconSheet> {
        let promise = iconSheetCache.get(pack.id);
        if (!promise) {
            const url = `${pack.source.baseUrl}/icons.webp`;
            // The spritesheet dimensions are not part of data.json, so measure the image
            // itself; the browser caches it, and the CSS below references the same URL.
            promise = new Promise<IconSheet>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve({ url, width: image.naturalWidth, height: image.naturalHeight });
                image.onerror = () =>
                    reject(new ServiceNotAvailableError(`Failed to load the icons of pack "${pack.id}".`));
                image.src = url;
            });
            iconSheetCache.set(pack.id, promise);
            promise.catch(() => iconSheetCache.delete(pack.id));
        }
        return promise;
    }

    /**
     * Builds one CSS rule placing the icon within the element via percentages, so the same
     * rule works for any rendered icon size (the app uses 32 px and 64 px variants).
     */
    private buildIconRule(
        cssSelector: string,
        type: string,
        name: string,
        sheet: IconSheet,
        x: number,
        y: number,
    ): string {
        const selector = cssSelector
            .replaceAll("{type}", type.replaceAll(" ", "_"))
            .replaceAll("{name}", name.replaceAll(" ", "_"));

        const sizeX = (sheet.width / ICON_CELL_SIZE) * 100;
        const sizeY = (sheet.height / ICON_CELL_SIZE) * 100;
        const positionX = sheet.width > ICON_CELL_SIZE ? (x / (sheet.width - ICON_CELL_SIZE)) * 100 : 0;
        const positionY = sheet.height > ICON_CELL_SIZE ? (y / (sheet.height - ICON_CELL_SIZE)) * 100 : 0;

        return (
            `${selector}{` +
            `background-image:url("${sheet.url}");` +
            `background-size:${sizeX}% ${sizeY}%;` +
            `background-position:${positionX}% ${positionY}%;` +
            `}`
        );
    }

    public async getIconsStyle(request: IconsStyleRequestData): Promise<IconsStyleData> {
        const pack = this.currentPack();
        const [packData, sheet] = await Promise.all([this.loadPackData(pack), this.loadIconSheet(pack)]);

        const processedEntities: { [type: string]: string[] } = {};
        const rules: string[] = [];
        for (const [type, names] of Object.entries(request.entities)) {
            for (const name of names) {
                const icon = packData.getIconRect(type, name);
                if (!icon) {
                    continue;
                }
                rules.push(this.buildIconRule(request.cssSelector, type, name, sheet, icon.x, icon.y));
                (processedEntities[type] = processedEntities[type] || []).push(name);
            }
        }

        return {
            processedEntities: processedEntities,
            style: rules.join("\n"),
        };
    }

    public async getTooltip(type: string, name: string): Promise<EntityData> {
        const packData = await this.currentPackData();
        const entity = packData.getEntity(type, name);
        if (!entity) {
            throw new PageNotFoundError(`The entity "${type}/${name}" is not known in this pack.`);
        }
        return entity;
    }

    public async sendSidebarEntities(sidebarEntities: SidebarEntityData[]): Promise<void> {
        // The sidebar store already persists to localStorage; there is no server to notify.
    }
}
