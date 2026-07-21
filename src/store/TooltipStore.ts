import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { createContext, RefObject } from "react";
import { PortalApi, portalApi } from "../api/PortalApi";
import { EntityData } from "../api/transfer";
import { router, Router } from "../class/Router";

export class TooltipStore {
    private readonly portalApi: PortalApi;
    private disableFlags: Map<string, boolean> = new Map();

    /** The target for which a tooltip was requested. This target may still be waiting for its data. */
    public requestedTarget: RefObject<Element> | null = null;
    /** The target for which the data has been fetched. This target has its data available. */
    public fetchedTarget: RefObject<Element> | null = null;
    /** The fetched data for the tooltip. */
    public fetchedData: EntityData | null = null;

    public constructor(portalApi: PortalApi, router: Router) {
        this.portalApi = portalApi;

        makeObservable<this, "disableFlags">(this, {
            disableFlags: observable,
            isEnabled: computed,
            fetchedData: observable,
            fetchedTarget: observable,
            hideTooltip: action,
            isTooltipAvailable: computed,
            requestedTarget: observable,
            setDisableFlag: action,
            showTooltip: action,
        });

        router.addGlobalChangeHandler(this.handleGlobalRouteChange.bind(this));
    }

    private handleGlobalRouteChange(): void {
        this.hideTooltip();
    }

    /**
     * Whether showing a tooltip is currently enabled.
     */
    public get isEnabled(): boolean {
        for (const flag of this.disableFlags.values()) {
            if (flag) {
                return false;
            }
        }

        return true;
    }

    /**
     * Whether a tooltip is currently available to be shown.
     */
    public get isTooltipAvailable(): boolean {
        return (
            !!this.requestedTarget &&
            !!this.fetchedTarget &&
            this.requestedTarget.current === this.fetchedTarget.current
        );
    }

    /**
     * Sets a named flag to disable or re-enable the tooltips.
     */
    public setDisableFlag(name: string, isDisabled: boolean): void {
        this.disableFlags.set(name, isDisabled);
        if (isDisabled) {
            this.hideTooltip();
        }
    }

    /**
     * Shows a tooltip on the target.
     */
    public async showTooltip(target: RefObject<Element>, type: string, name: string): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        this.requestedTarget = target;
        this.fetchedTarget = null;

        try {
            const data = await this.portalApi.getTooltip(type, name);
            runInAction((): void => {
                if (this.requestedTarget && this.requestedTarget.current === target.current) {
                    this.fetchedTarget = target;
                    this.fetchedData = data;
                }
            });
        } catch (e) {
            // Fetching the tooltip failed. So we can't do anything.
            runInAction((): void => {
                if (this.requestedTarget && this.requestedTarget.current === target.current) {
                    this.requestedTarget = null;
                }
            });
        }
    }

    /**
     * Hides the tooltip, if it is currently shown.
     */
    public hideTooltip(): void {
        this.requestedTarget = null;
    }
}

export const tooltipStore = new TooltipStore(portalApi, router);
export const tooltipStoreContext = createContext<TooltipStore>(tooltipStore);
