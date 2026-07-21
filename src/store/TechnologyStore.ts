import { action, makeObservable, observable, runInAction } from "mobx";
import { createContext } from "react";
import { State } from "router5";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptyTechnologyData } from "../api/empty";
import { TechnologyData } from "../api/transfer";
import { router, Router } from "../class/Router";
import { PageError } from "../error/page";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";
import { sidebarStore, SidebarStore } from "./SidebarStore";

export class TechnologyStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;
    private readonly sidebarStore: SidebarStore;

    /** Monotonic token identifying the latest navigation, so a slow request cannot overwrite a newer one. */
    private currentRequestId = 0;

    /** The technology details to be shown. */
    public technology: TechnologyData = emptyTechnologyData;

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router, sidebarStore: SidebarStore) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;
        this.sidebarStore = sidebarStore;

        makeObservable<this, "handleRouteChange">(this, {
            technology: observable,
            handleRouteChange: action,
        });

        router.addRoute(RouteName.TechnologyDetails, "/technology/:name", this.handleRouteChange.bind(this));
    }

    private async handleRouteChange(state: State): Promise<void> {
        const { name } = state.params;
        const requestId = ++this.currentRequestId;

        try {
            const technology = await this.portalApi.getTechnology(name);

            // A newer navigation started while this one was in flight; discard the stale
            // result so it cannot overwrite the newer page or pollute the sidebar.
            if (requestId !== this.currentRequestId) {
                return;
            }

            runInAction((): void => {
                this.technology = technology;
                this.sidebarStore.addViewedEntity("technology", technology.name, technology.label);
            });
        } catch (e) {
            this.errorStore.handleError(e as PageError);
        }
    }
}

export const technologyStore = new TechnologyStore(errorStore, portalApi, router, sidebarStore);
export const technologyStoreContext = createContext<TechnologyStore>(technologyStore);
