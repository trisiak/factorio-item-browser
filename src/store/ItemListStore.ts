import { makeObservable, observable } from "mobx";
import { createContext } from "react";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptyItemListData } from "../api/empty";
import { ItemListData, ItemMetaData } from "../api/transfer";
import { PaginatedList } from "../class/PaginatedList";
import { router, Router } from "../class/Router";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";

export class ItemListStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;

    /** The paginated list of all items. */
    public paginatedItemList: PaginatedList<ItemMetaData, ItemListData>;

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;

        makeObservable(this, {
            paginatedItemList: observable,
        });

        this.paginatedItemList = new PaginatedList(
            (page) => this.portalApi.getItemList(page),
            this.errorStore.createPaginatedListErrorHandler(emptyItemListData),
        );

        router.addRoute(RouteName.ItemList, "/items", this.handleRouteChange.bind(this));
    }

    private async handleRouteChange(): Promise<void> {
        if (this.paginatedItemList.currentPage === 0) {
            await this.paginatedItemList.requestNextPage();
        }
    }
}

export const itemListStore = new ItemListStore(errorStore, portalApi, router);
export const itemListStoreContext = createContext(itemListStore);
