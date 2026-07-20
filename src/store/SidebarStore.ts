import { action, computed, makeObservable, observable } from "mobx";
import { createContext } from "react";
import { PortalApi, portalApi } from "../api/PortalApi";
import { InitData, SidebarEntityData, SidebarEntityType } from "../api/transfer";
import { router, Router } from "../class/Router";
import { StorageManager, storageManager } from "../class/StorageManager";
import { globalStore, GlobalStore } from "./GlobalStore";
import { TooltipStore, tooltipStore } from "./TooltipStore";

export class SidebarStore {
    private readonly portalApi: PortalApi;
    private readonly storageManager: StorageManager;
    private readonly tooltipStore: TooltipStore;

    /** The entities of the sidebar. */
    public entities = new Map<string, SidebarEntityData>();
    /** Whether the sidebar is currently opened (mobile only) */
    public isSidebarOpened = false;

    public constructor(
        globalStore: GlobalStore,
        portalApi: PortalApi,
        router: Router,
        storageManager: StorageManager,
        tooltipStore: TooltipStore,
    ) {
        this.portalApi = portalApi;
        this.storageManager = storageManager;
        this.tooltipStore = tooltipStore;

        makeObservable<this, "assignEntities" | "validateEntities">(this, {
            addViewedEntity: action,
            assignEntities: action,
            closeSidebar: action,
            entities: observable,
            isSidebarOpened: observable,
            openSidebar: action,
            pinEntity: action,
            pinnedEntities: computed,
            unpinEntity: action,
            unpinnedEntities: computed,
            updatePinnedOrder: action,
            validateEntities: action,
        });

        globalStore.addInitHandler(this.handleInit.bind(this));
        router.addGlobalChangeHandler(this.handleGlobalRouteChange.bind(this));
        this.storageManager.sidebarEntitiesChangeHandler = this.handleSidebarEntitiesChange.bind(this);
    }

    private handleInit(data: InitData): void {
        this.assignEntities(data.sidebarEntities);

        this.storageManager.sidebarEntities = [...this.pinnedEntities, ...this.unpinnedEntities];
    }

    private handleGlobalRouteChange() {
        this.closeSidebar();
    }

    private handleSidebarEntitiesChange(entities: SidebarEntityData[]): void {
        try {
            this.assignEntities(entities);
        } catch (e) {
            // Ignore any errors.
        }
    }

    /**
     * The entities which are currently pinned to the sidebar.
     */
    public get pinnedEntities(): SidebarEntityData[] {
        const entities = this.filterEntities((entity) => entity.pinnedPosition > 0);
        entities.sort((left, right) => left.pinnedPosition - right.pinnedPosition);
        return entities;
    }

    /**
     * The entities which are not pinned to the sidebar.
     */
    public get unpinnedEntities(): SidebarEntityData[] {
        const entities = this.filterEntities((entity) => entity.pinnedPosition === 0);
        entities.sort((left, right) => right.lastViewTime.localeCompare(left.lastViewTime));
        return entities;
    }

    /**
     * Pins the entity to the bottom of the sidebar.
     */
    public pinEntity(entity: SidebarEntityData): void {
        entity.pinnedPosition = this.pinnedEntities.length + 1;

        this.tooltipStore.hideTooltip();
        this.validateEntities();
        this.sendEntities();
    }

    /**
     * Unpins the entity from the sidebar.
     */
    public unpinEntity(entity: SidebarEntityData): void {
        entity.pinnedPosition = 0;

        this.tooltipStore.hideTooltip();
        this.validateEntities();
        this.sendEntities();
    }

    /**
     * Opens the sidebar on mobile.
     */
    public openSidebar(): void {
        this.isSidebarOpened = true;
    }

    /**
     * Closes the sidebar on mobile.
     */
    public closeSidebar(): void {
        this.isSidebarOpened = false;
    }

    /**
     * Adds an entity, which have been viewed, to the sidebar.
     */
    public addViewedEntity(type: SidebarEntityType, name: string, label: string): void {
        const id = `${type}-${name}`;
        const entity = this.entities.get(id);
        if (entity) {
            entity.label = label;
            entity.lastViewTime = new Date().toISOString();
        } else {
            this.entities.set(id, {
                type: type,
                name: name,
                label: label,
                pinnedPosition: 0,
                lastViewTime: new Date().toISOString(),
            });
        }

        this.validateEntities();
        this.sendEntities();
    }

    /**
     * Updates the order of the entities pinned to the sidebar.
     */
    public updatePinnedOrder(order: string[]): void {
        for (const [index, id] of order.entries()) {
            const entity = this.entities.get(id);
            if (entity) {
                entity.pinnedPosition = index + 1;
            }
        }

        this.sendEntities();
    }

    private assignEntities(entities: SidebarEntityData[]): void {
        this.entities.clear();
        for (const entity of entities) {
            this.entities.set(this.buildIdForEntity(entity), entity);
        }
        this.validateEntities();
    }

    private filterEntities(predicate: (sidebarEntities: SidebarEntityData) => boolean): SidebarEntityData[] {
        const result = [];
        for (const entity of this.entities.values()) {
            if (predicate(entity)) {
                result.push(entity);
            }
        }
        return result;
    }

    private validateEntities(): void {
        // Renumber pinned entities.
        for (const [index, entity] of this.pinnedEntities.entries()) {
            entity.pinnedPosition = index + 1;
        }

        // Cut off excessive unpinned entities.
        for (const entity of this.unpinnedEntities.slice(10)) {
            this.entities.delete(this.buildIdForEntity(entity));
        }
    }

    private sendEntities(): void {
        const entities = [...this.pinnedEntities, ...this.unpinnedEntities];
        try {
            this.storageManager.sidebarEntities = entities;
        } catch (e) {
            // Ignore errors related to persisting sidebar entities.
        }

        (async (): Promise<void> => {
            try {
                await this.portalApi.sendSidebarEntities(entities);
            } catch (e) {
                // Ignore errors related to saving sidebar entities.
            }
        })();
    }

    /**
     * Returns the id to use for the sidebar entity.
     */
    public buildIdForEntity(entity: SidebarEntityData): string {
        return `${entity.type}-${entity.name}`;
    }
}

export const sidebarStore = new SidebarStore(globalStore, portalApi, router, storageManager, tooltipStore);
export const sidebarStoreContext = createContext(sidebarStore);
