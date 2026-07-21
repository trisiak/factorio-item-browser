import { makeObservable, observable } from "mobx";
import { createContext } from "react";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptyTechnologyListData } from "../api/empty";
import { TechnologyListData, TechnologyMetaData } from "../api/transfer";
import { PaginatedList } from "../class/PaginatedList";
import { router, Router } from "../class/Router";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";

export class TechnologyListStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;

    /** The paginated list of all technologies. */
    public paginatedTechnologyList: PaginatedList<TechnologyMetaData, TechnologyListData>;

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;

        makeObservable(this, {
            paginatedTechnologyList: observable,
        });

        this.paginatedTechnologyList = new PaginatedList(
            (page) => this.portalApi.getTechnologyList(page),
            this.errorStore.createPaginatedListErrorHandler(emptyTechnologyListData),
        );

        router.addRoute(RouteName.TechnologyList, "/technologies", this.handleRouteChange.bind(this));
    }

    private async handleRouteChange(): Promise<void> {
        if (this.paginatedTechnologyList.currentPage === 0) {
            await this.paginatedTechnologyList.requestNextPage();
        }
    }
}

export const technologyListStore = new TechnologyListStore(errorStore, portalApi, router);
export const technologyListStoreContext = createContext(technologyListStore);
