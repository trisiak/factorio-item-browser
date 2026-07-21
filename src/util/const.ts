export enum Breakpoint {
    Small = 0,
    Medium = 800,
    Large = 1200,
    Huge = 1500,
}

export enum RecipeMode {
    Hybrid = "hybrid",
    Normal = "normal",
    Expensive = "expensive",
}

export enum RouteName {
    Empty = "",
    Index = "index",
    ItemDetails = "itemDetails",
    ItemList = "itemList",
    RecipeDetails = "recipeDetails",
    RecipeList = "recipeList",
    Search = "search",
    Settings = "settings",
    TechnologyDetails = "technologyDetails",
    TechnologyList = "technologyList",
}

export enum SettingStatus {
    Available = "available",
    Errored = "errored",
    Loading = "loading",
    Pending = "pending",
    Unknown = "unknown",
}
