import { action, computed, makeObservable, observable } from "mobx";
import { createContext, RefObject } from "react";
import { getI18n } from "react-i18next";
import { State } from "router5";
import { PortalApi, portalApi } from "../api/PortalApi";
import { emptySettingData } from "../api/empty";
import { InitData, SettingData } from "../api/transfer";
import { CombinationId } from "../class/CombinationId";
import { router, Router } from "../class/Router";
import { storageManager, StorageManager } from "../class/StorageManager";
import { CombinationNotFoundError, PageError, PageNotFoundError } from "../error/page";
import { RouteName } from "../util/const";
import { errorStore, ErrorStore } from "./ErrorStore";

type InitHandler = (initData: InitData) => void | Promise<void>;

const regexPathCombinationIdShort = /^\/([0-9a-zA-Z]{22})(\/|$)/;
const regexPathCombinationIdFull = /^\/([0-9a-f-]{36})(\/|$)/;

export class GlobalStore {
    private readonly errorStore: ErrorStore;
    private readonly portalApi: PortalApi;
    public readonly router: Router;
    private readonly storageManager: StorageManager;

    private initHandlers: InitHandler[] = [];

    /** The route which is currently active. */
    public currentRoute: RouteName = RouteName.Empty;
    /** The target which currently have the loading circle. */
    public loadingCircleTarget: RefObject<Element> | null = null;

    /** The currently loaded setting. */
    public setting: SettingData = emptySettingData;

    public constructor(errorStore: ErrorStore, portalApi: PortalApi, router: Router, storageManager: StorageManager) {
        this.errorStore = errorStore;
        this.portalApi = portalApi;
        this.router = router;
        this.storageManager = storageManager;

        makeObservable<this, "handleGlobalRouteChange" | "handleInit">(this, {
            currentRoute: observable,
            handleGlobalRouteChange: action,
            handleInit: action,
            isInitiallyLoading: computed,
            loadingCircleTarget: observable,
            setting: observable,
            showLoadingCircle: action,
            useBigHeader: computed,
        });

        router.addGlobalChangeHandler(this.handleGlobalRouteChange.bind(this));
        this.addInitHandler(this.handleInit.bind(this));
    }

    private handleGlobalRouteChange(state: State): void {
        this.currentRoute = state.name as RouteName;
        this.loadingCircleTarget = null;
        window.scrollTo(0, 0);
    }

    private async handleInit(initData: InitData): Promise<void> {
        this.setting = initData.setting;

        await getI18n().changeLanguage(initData.setting.locale);
    }

    /**
     * Whether we are still initially loading the page.
     */
    public get isInitiallyLoading(): boolean {
        return this.currentRoute === RouteName.Empty;
    }

    /**
     * Whether the big header should be used for displaying the current page.
     */
    public get useBigHeader(): boolean {
        return this.currentRoute === RouteName.Index;
    }

    /**
     * Adds a handler for when the session has been initialized.
     */
    public addInitHandler(handler: InitHandler): void {
        this.initHandlers.push(handler);
    }

    /**
     * Initializes the session and all the things needed to get the page going.
     */
    public async initialize(): Promise<void> {
        this.detectInitialCombinationId();
        try {
            const initData = await this.portalApi.initializeSession();
            if (this.hasCurrentScriptVersion(initData.scriptVersion)) {
                // Current script version is already loaded, so proceed as usual.
                const combinationId = CombinationId.fromFull(initData.setting.combinationId);
                this.storageManager.combinationId = combinationId;
                this.storageManager.hash = initData.setting.combinationHash;

                for (const handler of this.initHandlers) {
                    handler(initData);
                }

                this.router.start(combinationId);
            } else {
                // Script version has changed, force a reload of the page to get the latest files.
                window.location.reload();
            }
        } catch (e) {
            if (e instanceof PageNotFoundError) {
                this.errorStore.handleError(new CombinationNotFoundError(e.message));
            } else {
                this.errorStore.handleError(e as PageError);
            }
        }
    }

    /**
     * Shows the loading circle on top of the target.
     */
    public showLoadingCircle(target: RefObject<Element>): void {
        this.loadingCircleTarget = target;
    }

    private detectInitialCombinationId(): void {
        const combinationId = this.matchCombinationId(window.location.pathname);
        if (combinationId !== null) {
            this.storageManager.combinationId = combinationId;
        }
    }

    private matchCombinationId(path: string): CombinationId | null {
        let match = path.match(regexPathCombinationIdShort);
        if (match && match[1]) {
            return CombinationId.fromShort(match[1]);
        }

        match = path.match(regexPathCombinationIdFull);
        if (match && match[1]) {
            return CombinationId.fromFull(match[1]);
        }

        return null;
    }

    private hasCurrentScriptVersion(requiredScriptVersion: string): boolean {
        if (!requiredScriptVersion) {
            // Didn't receive any script version? Meh, disable the reload feature.
            return true;
        }

        const currentScriptVersion = this.storageManager.scriptVersion;
        if (!currentScriptVersion) {
            // Don't have a script version stored? Then we may be coming from a redirect. Write version and done.
            this.storageManager.scriptVersion = requiredScriptVersion;
            return true;
        }

        if (currentScriptVersion === requiredScriptVersion) {
            // Script version did not change, so everything is fine.
            return true;
        }

        this.storageManager.scriptVersion = "";
        if (this.storageManager.scriptVersion) {
            // Somehow we aren't able to remove the script version. So do not reload to avoid an infinite loop.
            return true;
        }

        // Force a reload because the script version has changed.
        return false;
    }
}

export const globalStore = new GlobalStore(errorStore, portalApi, router, storageManager);
export const globalStoreContext = createContext(globalStore);
