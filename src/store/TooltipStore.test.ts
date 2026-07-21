import { RefObject } from "react";
import { PortalApi } from "../api/PortalApi";
import { EntityData } from "../api/transfer";
import { Router } from "../class/Router";
import { TooltipStore } from "./TooltipStore";

function createEntityData(): EntityData {
    return {
        type: "item",
        name: "iron-plate",
        label: "Iron plate",
        recipes: [],
        numberOfRecipes: 0,
    };
}

function createTarget(): RefObject<Element> {
    return { current: document.createElement("div") };
}

function createStore(getTooltip: jest.Mock): TooltipStore {
    const portalApi = { getTooltip } as unknown as PortalApi;
    const router = { addGlobalChangeHandler: jest.fn() } as unknown as Router;
    return new TooltipStore(portalApi, router);
}

describe("TooltipStore", () => {
    test("showTooltip fetches the data and makes the tooltip available in the anchored mode by default", async () => {
        const data = createEntityData();
        const store = createStore(jest.fn().mockResolvedValue(data));
        const target = createTarget();

        await store.showTooltip(target, "item", "iron-plate");

        expect(store.isTooltipAvailable).toBe(true);
        expect(store.fetchedData).toEqual(data);
        expect(store.mode).toBe("anchored");
    });

    test("showTooltip remembers the requested drawer mode", async () => {
        const store = createStore(jest.fn().mockResolvedValue(createEntityData()));

        await store.showTooltip(createTarget(), "item", "iron-plate", "drawer");

        expect(store.isTooltipAvailable).toBe(true);
        expect(store.mode).toBe("drawer");
    });

    test("hideTooltip makes the tooltip unavailable again", async () => {
        const store = createStore(jest.fn().mockResolvedValue(createEntityData()));

        await store.showTooltip(createTarget(), "item", "iron-plate", "drawer");
        store.hideTooltip();

        expect(store.isTooltipAvailable).toBe(false);
    });

    test("a failed fetch leaves the tooltip unavailable", async () => {
        const store = createStore(jest.fn().mockRejectedValue(new Error("no data")));

        await store.showTooltip(createTarget(), "item", "iron-plate", "drawer");

        expect(store.isTooltipAvailable).toBe(false);
    });
});
