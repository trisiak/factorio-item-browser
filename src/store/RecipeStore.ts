import { action, makeObservable, observable, runInAction } from "mobx";
import { createContext } from "react";
import { State } from "router5";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptyRecipeDetailsData, emptyRecipeMachinesData } from "../api/empty";
import { MachineData, RecipeDetailsData, RecipeMachinesData, TechnologyData } from "../api/transfer";
import { PaginatedList } from "../class/PaginatedList";
import { router, Router } from "../class/Router";
import { PageError } from "../error/page";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";
import { sidebarStore, SidebarStore } from "./SidebarStore";

export class RecipeStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;
    private readonly sidebarStore: SidebarStore;

    /** Monotonic token identifying the latest navigation, so a slow request cannot overwrite a newer one. */
    private currentRequestId = 0;

    /** The recipe details to be shown. */
    public recipeDetails: RecipeDetailsData = emptyRecipeDetailsData;
    /** The paginated list of machines to show. */
    public paginatedMachinesList: PaginatedList<MachineData, RecipeMachinesData> | null = null;
    /** The technologies that unlock this recipe; empty if start-available. */
    public unlockedByTechnologies: TechnologyData[] = [];

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router, sidebarStore: SidebarStore) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;
        this.sidebarStore = sidebarStore;

        makeObservable<this, "handleRouteChange">(this, {
            recipeDetails: observable,
            paginatedMachinesList: observable,
            unlockedByTechnologies: observable,
            handleRouteChange: action,
        });

        router.addRoute(RouteName.RecipeDetails, "/recipe/:name", this.handleRouteChange.bind(this));
    }

    private async handleRouteChange(state: State): Promise<void> {
        const { name } = state.params;
        const requestId = ++this.currentRequestId;

        const newMachinesList = new PaginatedList<MachineData, RecipeMachinesData>(
            (page) => this.portalApi.getRecipeMachines(name, page),
            this.errorStore.createPaginatedListErrorHandler(emptyRecipeMachinesData),
        );

        // Best-effort like the item page: a failure (or a data source without technology
        // data) must not break the recipe page, so it falls back to an empty list.
        const researchPromise = this.portalApi.getRecipeResearch(name).catch(() => [] as TechnologyData[]);

        try {
            const [recipeDetails, , technologies] = await Promise.all([
                this.portalApi.getRecipeDetails(name),
                newMachinesList.requestNextPage(),
                researchPromise,
            ]);

            // A newer navigation started while this one was in flight; discard the stale
            // result so it cannot overwrite the newer page or pollute the sidebar.
            if (requestId !== this.currentRequestId) {
                return;
            }

            runInAction((): void => {
                this.recipeDetails = recipeDetails;
                this.paginatedMachinesList = newMachinesList;
                this.unlockedByTechnologies = technologies;

                this.sidebarStore.addViewedEntity("recipe", recipeDetails.name, recipeDetails.label);
            });
        } catch (e) {
            this.errorStore.handleError(e as PageError);
        }
    }
}

export const recipeStore = new RecipeStore(errorStore, portalApi, router, sidebarStore);
export const recipeStoreContext = createContext<RecipeStore>(recipeStore);
