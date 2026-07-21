import { SidebarEntityData } from "../api/transfer";
import { CombinationId } from "./CombinationId";
import { StorageManager } from "./StorageManager";

const combinationA = CombinationId.fromFull("fab1a000-0000-4000-8000-000000000001");
const combinationB = CombinationId.fromFull("fab1a000-0000-4000-8000-000000000002");

const entity: SidebarEntityData = {
    type: "item",
    name: "widget",
    label: "Widget",
    pinnedPosition: 0,
    lastViewTime: "2020-01-01T00:00:00.000Z",
};

describe("StorageManager combination scoping", (): void => {
    let manager: StorageManager;

    beforeEach((): void => {
        window.localStorage.clear();
        manager = new StorageManager(window.localStorage);
    });

    test("scopes sidebar entities by the combination's short id", (): void => {
        manager.combinationId = combinationA;
        manager.sidebarEntities = [entity];

        expect(manager.sidebarEntities).toEqual([entity]);
        // The storage key carries the short id, so a different pack cannot see the entities.
        expect(window.localStorage.getItem(`sidebar-entities-${combinationA.toShort()}`)).not.toBeNull();

        manager.combinationId = combinationB;
        expect(manager.sidebarEntities).toEqual([]);

        // Switching back to the original scope restores the stored entities.
        manager.combinationId = combinationA;
        expect(manager.sidebarEntities).toEqual([entity]);
    });

    test("without a combination id, sidebar reads empty and writes are a no-op", (): void => {
        manager.combinationId = null;
        manager.sidebarEntities = [entity];

        expect(manager.sidebarEntities).toEqual([]);
        // Nothing scoped was written to storage.
        const sidebarKeys = Object.keys(window.localStorage).filter((key) => key.startsWith("sidebar-entities"));
        expect(sidebarKeys).toEqual([]);
    });
});
