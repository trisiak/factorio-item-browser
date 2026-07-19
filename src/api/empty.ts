import { RecipeMode, SettingStatus } from "../util/const";
import {
    ItemListData,
    ItemRecipesData,
    ItemResearchData,
    RecipeDetailsData,
    RecipeMachinesData,
    SearchResultsData,
    SettingData,
    TechnologyData,
} from "./transfer";

export const emptyItemListData: ItemListData = {
    results: [],
    numberOfResults: 0,
};

export const emptyItemRecipesData: ItemRecipesData = {
    type: "item",
    name: "",
    label: "",
    description: "",
    results: [],
    numberOfResults: 0,
};

export const emptyRecipeDetailsData: RecipeDetailsData = {
    name: "",
    label: "",
    description: "",
};

export const emptyRecipeMachinesData: RecipeMachinesData = {
    results: [],
    numberOfResults: 0,
};

export const emptyTechnologyData: TechnologyData = {
    name: "",
    label: "",
    researchTime: 0,
    ingredients: [],
    prerequisites: [],
    unlockedRecipes: [],
    numberOfUnlockedRecipes: 0,
};

export const emptyItemResearchData: ItemResearchData = {
    type: "item",
    name: "",
    label: "",
    technologies: [],
};

export const emptySearchResultsData: SearchResultsData = {
    query: "",
    results: [],
    numberOfResults: 0,
};

export const emptySettingData: SettingData = {
    combinationId: "",
    combinationHash: "",
    name: "Vanilla",
    locale: "en",
    recipeMode: RecipeMode.Hybrid,
    status: SettingStatus.Available,
    isTemporary: false,
};
