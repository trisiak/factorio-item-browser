import { makeObservable, observable } from "mobx";
import { createContext } from "react";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptyRecipeListData } from "../api/empty";
import { RecipeListData, RecipeMetaData } from "../api/transfer";
import { PaginatedList } from "../class/PaginatedList";
import { router, Router } from "../class/Router";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";

export class RecipeListStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;

    /** The paginated list of all recipes. */
    public paginatedRecipeList: PaginatedList<RecipeMetaData, RecipeListData>;

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;

        makeObservable(this, {
            paginatedRecipeList: observable,
        });

        this.paginatedRecipeList = new PaginatedList(
            (page) => this.portalApi.getRecipeList(page),
            this.errorStore.createPaginatedListErrorHandler(emptyRecipeListData),
        );

        router.addRoute(RouteName.RecipeList, "/recipes", this.handleRouteChange.bind(this));
    }

    private async handleRouteChange(): Promise<void> {
        if (this.paginatedRecipeList.currentPage === 0) {
            await this.paginatedRecipeList.requestNextPage();
        }
    }
}

export const recipeListStore = new RecipeListStore(errorStore, portalApi, router);
export const recipeListStoreContext = createContext(recipeListStore);
