import { action, makeObservable, observable, runInAction } from "mobx";
import { createContext } from "react";
import { State } from "router5";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptyItemRecipesData } from "../api/empty";
import { EntityData, ItemRecipesData, ItemType, TechnologyData } from "../api/transfer";
import { PaginatedList } from "../class/PaginatedList";
import { router, Router } from "../class/Router";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";
import { sidebarStore, SidebarStore } from "./SidebarStore";

type Item = {
    type: ItemType;
    name: string;
    label: string;
    description: string;
};

const emptyItem: Item = {
    type: "item",
    name: "",
    label: "",
    description: "",
};

export class ItemStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;
    private readonly sidebarStore: SidebarStore;

    /** Monotonic token identifying the latest navigation, so a slow request cannot overwrite a newer one. */
    private currentRequestId = 0;

    /** The item details to be shown. */
    public item: Item = emptyItem;
    /** The paginated list of recipes having the item as ingredient. */
    public paginatedIngredientRecipesList: PaginatedList<EntityData, ItemRecipesData> | null = null;
    /** The paginated list of recipes having the item as product. */
    public paginatedProductRecipesList: PaginatedList<EntityData, ItemRecipesData> | null = null;
    /** The paginated list of recipes the item can craft (only populated for machines). */
    public paginatedMachineRecipesList: PaginatedList<EntityData, ItemRecipesData> | null = null;
    /** The technologies that unlock a recipe producing the item; empty if start-available. */
    public unlockedByTechnologies: TechnologyData[] = [];

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router, sidebarStore: SidebarStore) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;
        this.sidebarStore = sidebarStore;

        makeObservable<this, "handleRouteChange">(this, {
            item: observable,
            paginatedIngredientRecipesList: observable,
            paginatedProductRecipesList: observable,
            paginatedMachineRecipesList: observable,
            unlockedByTechnologies: observable,
            handleRouteChange: action,
        });

        router.addRoute(RouteName.ItemDetails, "/:type<item|fluid>/:name", this.handleRouteChange.bind(this));
    }

    private async handleRouteChange(state: State): Promise<void> {
        const { type, name } = state.params;
        const requestId = ++this.currentRequestId;

        const newProductsList = new PaginatedList<EntityData, ItemRecipesData>(
            (page) => this.portalApi.getItemProductRecipes(type, name, page),
            this.errorStore.createPaginatedListErrorHandler(emptyItemRecipesData),
        );
        const newIngredientsList = new PaginatedList<EntityData, ItemRecipesData>(
            (page) => this.portalApi.getItemIngredientRecipes(type, name, page),
            this.errorStore.createPaginatedListErrorHandler(emptyItemRecipesData),
        );
        // Populated for every item; only machines produce a non-empty list, so the section
        // hides itself for everything else (see ItemRecipesList).
        const newMachineRecipesList = new PaginatedList<EntityData, ItemRecipesData>(
            (page) => this.portalApi.getMachineRecipes(type, name, page),
            this.errorStore.createPaginatedListErrorHandler(emptyItemRecipesData),
        );

        // The research lookup is best-effort: a failure (or a data source without technology
        // data) must not break the item page, so it falls back to an empty list.
        const researchPromise = this.portalApi
            .getItemResearch(type, name)
            .then((research) => research.technologies)
            .catch(() => []);

        const [productsData, , , technologies] = await Promise.all([
            newProductsList.requestNextPage(),
            newIngredientsList.requestNextPage(),
            newMachineRecipesList.requestNextPage(),
            researchPromise,
        ]);

        // A newer navigation started while this one was in flight; discard the stale result
        // so it cannot overwrite the newer page or pollute the sidebar's last-viewed list.
        if (requestId !== this.currentRequestId) {
            return;
        }

        if (productsData.name !== "") {
            runInAction(() => {
                this.paginatedProductRecipesList = newProductsList;
                this.paginatedIngredientRecipesList = newIngredientsList;
                this.paginatedMachineRecipesList = newMachineRecipesList;
                this.unlockedByTechnologies = technologies;

                this.item = {
                    type: productsData.type,
                    name: productsData.name,
                    label: productsData.label,
                    description: productsData.description,
                };

                this.sidebarStore.addViewedEntity(productsData.type, productsData.name, productsData.label);
            });
        }
    }
}

export const itemStore = new ItemStore(errorStore, portalApi, router, sidebarStore);
export const itemStoreContext = createContext(itemStore);
