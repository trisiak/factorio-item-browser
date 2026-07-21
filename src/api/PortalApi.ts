import { CombinationId } from "../class/CombinationId";
import { storageManager } from "../class/StorageManager";
import { StaticPortalApi } from "./static/StaticPortalApi";
import {
    EntityData,
    IconsStyleData,
    IconsStyleRequestData,
    InitData,
    ItemListData,
    ItemRecipesData,
    ItemResearchData,
    ItemType,
    ModData,
    RecipeDetailsData,
    RecipeListData,
    RecipeMachinesData,
    SearchResultsData,
    SettingData,
    SettingOptionsData,
    SidebarEntityData,
    TechnologyData,
    TechnologyListData,
} from "./transfer";

/**
 * The contract of the Portal API: every data access of the stores and the icon manager
 * funnels through these methods. The shapes are defined in transfer.ts and must not be
 * changed — implementations map their data source into them.
 *
 * The upstream implementation talked to a PHP backend (see the git history of this file
 * for the axios-based HttpPortalApi); the static fork answers everything from published
 * pack data (src/api/static/) and localStorage.
 */
export interface PortalApi {
    withCombinationId(combinationId: CombinationId): PortalApi;
    initializeSession(): Promise<InitData>;
    getItemIngredientRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData>;
    getItemProductRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData>;
    getMachineRecipes(type: ItemType, name: string, page: number): Promise<ItemRecipesData>;
    getItemResearch(type: ItemType, name: string): Promise<ItemResearchData>;
    getTechnology(name: string): Promise<TechnologyData>;
    getItemList(page: number): Promise<ItemListData>;
    getTechnologyList(page: number): Promise<TechnologyListData>;
    getRecipeList(page: number): Promise<RecipeListData>;
    getRandom(): Promise<EntityData[]>;
    getRecipeDetails(name: string): Promise<RecipeDetailsData>;
    getRecipeResearch(name: string): Promise<TechnologyData[]>;
    getRecipeMachines(name: string, page: number): Promise<RecipeMachinesData>;
    search(query: string, page: number): Promise<SearchResultsData>;
    getSettings(): Promise<SettingData[]>;
    getSetting(combinationId: string): Promise<SettingData>;
    saveSetting(combinationId: string, options: SettingOptionsData): Promise<void>;
    getSettingMods(combinationId: string): Promise<ModData[]>;
    getIconsStyle(request: IconsStyleRequestData): Promise<IconsStyleData>;
    getTooltip(type: string, name: string): Promise<EntityData>;
    sendSidebarEntities(sidebarEntities: SidebarEntityData[]): Promise<void>;
}

export const portalApi: PortalApi = new StaticPortalApi(storageManager);
