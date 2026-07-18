import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { CombinationId } from "../class/CombinationId";
import { StorageManager, storageManager } from "../class/StorageManager";
import { ClientFailureError, PageNotFoundError, ServerFailureError, ServiceNotAvailableError } from "../error/page";
import { Config } from "../util/config";
import { StaticPortalApi } from "./static/StaticPortalApi";
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
    SettingValidationData,
    SidebarEntityData,
} from "./transfer";

type ServerError = {
    error: {
        message: string;
    };
};

/**
 * The contract of the Portal API: every data access of the stores and the icon manager
 * funnels through these methods. The shapes are defined in transfer.ts and must not be
 * changed — implementations map their data source into them.
 */
export interface PortalApi {
    withCombinationId(combinationId: CombinationId): PortalApi;
    initializeSession(): Promise<InitData>;
    getItemIngredientRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData>;
    getItemProductRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData>;
    getItemList(page: number): Promise<ItemListData>;
    getRandom(): Promise<EntityData[]>;
    getRecipeDetails(name: string): Promise<RecipeDetailsData>;
    getRecipeMachines(name: string, page: number): Promise<RecipeMachinesData>;
    search(query: string, page: number): Promise<SearchResultsData>;
    getSettings(): Promise<SettingData[]>;
    validateSetting(modNames: string[]): Promise<SettingValidationData>;
    getSetting(combinationId: string): Promise<SettingData>;
    saveSetting(combinationId: string, options: SettingOptionsData): Promise<void>;
    deleteSetting(combinationId: string): Promise<void>;
    getSettingMods(combinationId: string): Promise<ModData[]>;
    getIconsStyle(request: IconsStyleRequestData): Promise<IconsStyleData>;
    getTooltip(type: string, name: string): Promise<EntityData>;
    sendSidebarEntities(sidebarEntities: SidebarEntityData[]): Promise<void>;
}

/**
 * The implementation talking to the upstream Portal API server. Unused in the static
 * fork (see docs/static-fork.md) but kept as the reference implementation of the
 * contract until the conversion is complete.
 */
export class HttpPortalApi implements PortalApi {
    private readonly client: AxiosInstance;
    private readonly combinationId?: CombinationId;
    private readonly storageManager: StorageManager;

    public constructor(storageManager: StorageManager, combinationId?: CombinationId) {
        this.storageManager = storageManager;
        this.combinationId = combinationId;

        this.client = axios.create({
            baseURL: Config.portalApiUrl,
            withCredentials: true,
        });
        this.client.interceptors.request.use(this.prepareRequest.bind(this));
        this.client.interceptors.response.use(undefined, this.prepareResponseError.bind(this));
    }

    public withCombinationId(combinationId: CombinationId): PortalApi {
        return new HttpPortalApi(this.storageManager, combinationId);
    }

    private prepareRequest(request: AxiosRequestConfig): AxiosRequestConfig {
        if (this.combinationId) {
            request.headers["Combination-Id"] = this.combinationId.toFull();
        } else if (this.storageManager.combinationId !== null) {
            request.headers["Combination-Id"] = this.storageManager.combinationId.toFull();
        }
        if (request.data) {
            request.headers["Content-Type"] = "application/json";
        }
        return request;
    }

    private prepareResponseError(error: AxiosError<ServerError | null>): Promise<never> {
        let message = error.response?.data?.error?.message;
        if (typeof message !== "string") {
            message = "Unknown error";
        }

        switch (error.response?.status) {
            case 400:
            case 401:
            case 409:
                throw new ClientFailureError(message);
            case 404:
                throw new PageNotFoundError(message);
            case 503:
                throw new ServiceNotAvailableError(message);
            case 500:
            default:
                throw new ServerFailureError(message);
        }
    }

    /**
     * Initializes the current session.
     */
    public async initializeSession(): Promise<InitData> {
        const response = await this.client.post<InitData>("/init");
        return response.data;
    }

    /**
     * Fetches the recipes having the specified item as an ingredient.
     */
    public async getItemIngredientRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData> {
        return this.withCache(`ingredient-${type}-${name}-${page}`, () => {
            return this.client.get<ItemRecipesData>(`/${encodeURI(type)}/${encodeURI(name)}/ingredients`, {
                params: {
                    indexOfFirstResult: (page - 1) * Config.numberOfItemRecipesPerPage,
                    numberOfResults: Config.numberOfItemRecipesPerPage,
                },
            });
        });
    }

    /**
     * Fetches the recipes having the specified item as a product.
     */
    public async getItemProductRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData> {
        return this.withCache(`product-${type}-${name}-${page}`, () => {
            return this.client.get<ItemRecipesData>(`/${encodeURI(type)}/${encodeURI(name)}/products`, {
                params: {
                    indexOfFirstResult: (page - 1) * Config.numberOfItemRecipesPerPage,
                    numberOfResults: Config.numberOfItemRecipesPerPage,
                },
            });
        });
    }

    /**
     * Fetches the list of all items.
     */
    public async getItemList(page: number): Promise<ItemListData> {
        const response = await this.client.get<ItemListData>("/items", {
            params: {
                indexOfFirstResult: (page - 1) * Config.numberOfItemsPerPage,
                numberOfResults: Config.numberOfItemsPerPage,
            },
        });
        return response.data;
    }

    /**
     * Fetches random items from the server.
     */
    public async getRandom(): Promise<EntityData[]> {
        const response = await this.client.get<EntityData[]>("/random", {
            params: {
                numberOfResults: Config.numberOfRandomItems,
            },
        });
        return response.data;
    }

    /**
     * Fetches the recipe details with the specified name.
     */
    public async getRecipeDetails(name: string): Promise<RecipeDetailsData> {
        return this.withCache(`recipe-${name}`, () => {
            return this.client.get<RecipeDetailsData>(`/recipe/${encodeURI(name)}`);
        });
    }

    /**
     * Fetches the machines able to craft the recipe.
     */
    public async getRecipeMachines(name: string, page: number): Promise<RecipeMachinesData> {
        return this.withCache(`machine-${name}-${page}`, () => {
            return this.client.get<RecipeMachinesData>(`/recipe/${encodeURI(name)}/machines`, {
                params: {
                    indexOfFirstResult: (page - 1) * Config.numberOfMachinesPerPage,
                    numberOfResults: Config.numberOfMachinesPerPage,
                },
            });
        });
    }

    /**
     * Executes a search with the specified query.
     */
    public async search(query: string, page: number): Promise<SearchResultsData> {
        return this.withCache(`search-${query}-${page}`, () => {
            return this.client.get<SearchResultsData>("/search", {
                params: {
                    query: query,
                    indexOfFirstResult: (page - 1) * Config.numberOfSearchResultsPerPage,
                    numberOfResults: Config.numberOfSearchResultsPerPage,
                },
            });
        });
    }

    /**
     * Fetches the settings available for the current user.
     */
    public async getSettings(): Promise<SettingData[]> {
        const response = await this.client.get<SettingData[]>("/settings");
        return response.data;
    }

    /**
     * Validates the setting using the specified mod names.
     */
    public async validateSetting(modNames: string[]): Promise<SettingValidationData> {
        const response = await this.client.post("/setting/validate", modNames);
        return response.data;
    }

    /**
     * Fetches the details to a specific setting.
     */
    public async getSetting(combinationId: string): Promise<SettingData> {
        const response = await this.client.get<SettingData>(`/setting/${encodeURI(combinationId)}`);
        return response.data;
    }

    /**
     * Save the setting with the options.
     */
    public async saveSetting(combinationId: string, options: SettingOptionsData): Promise<void> {
        await this.client.put<void>(`/setting/${encodeURI(combinationId)}`, options);
    }

    /**
     * Deletes the setting with the specified combination.
     */
    public async deleteSetting(combinationId: string): Promise<void> {
        await this.client.delete<void>(`/setting/${encodeURI(combinationId)}`);
    }

    /**
     * Fetches the mods of the setting.
     */
    public async getSettingMods(combinationId: string): Promise<ModData[]> {
        return this.withCache(`setting-${combinationId}-mods`, () => {
            return this.client.get<ModData[]>(`/setting/${combinationId}/mods`);
        });
    }

    /**
     * Fetches the style of the icons with the specified types and names.
     */
    public async getIconsStyle(request: IconsStyleRequestData): Promise<IconsStyleData> {
        const response = await this.client.post<IconsStyleData>("/style/icons", request);
        return response.data;
    }

    /**
     * Fetches the tooltip data for the specified type and name.
     */
    public async getTooltip(type: string, name: string): Promise<EntityData> {
        return this.withCache(`tooltip-${type}-${name}`, () => {
            return this.client.get<EntityData>(`/tooltip/${encodeURI(type)}/${encodeURI(name)}`);
        });
    }

    /**
     * Sends the sidebar entities to the Portal API for persisting.
     */
    public async sendSidebarEntities(sidebarEntities: SidebarEntityData[]): Promise<void> {
        await this.client.put<void>("/sidebar/entities", sidebarEntities);
    }

    private async withCache<T>(cacheKey: string, handler: () => Promise<AxiosResponse<T>>): Promise<T> {
        const data = this.storageManager.readFromCache<T>(cacheKey);
        if (data !== null) {
            return data;
        }

        const response = await handler();
        this.storageManager.writeToCache(cacheKey, response.data);
        return response.data;
    }
}

export const portalApi: PortalApi = new StaticPortalApi(storageManager);
