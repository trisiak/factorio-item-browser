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
    Search = "search",
    Settings = "settings",
}

export enum SettingStatus {
    Available = "available",
    Errored = "errored",
    Loading = "loading",
    Pending = "pending",
    Unknown = "unknown",
}

export enum ValidationProblemType {
    Conflict = "conflict",
    MissingDependency = "missingDependency",
    NoRelease = "noRelease",
    UnknownMod = "unknownMod",
}
