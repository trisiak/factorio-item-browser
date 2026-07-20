import { SidebarEntityData } from "../api/transfer";
import { CombinationId } from "./CombinationId";

const KEY_SCRIPT_VERSION = "script-version";
const KEY_SIDEBAR_ENTITIES = "sidebar-entities";

class SidebarEntitiesUtils {
    public static deserialize(data: string): SidebarEntityData[] {
        try {
            const sidebarEntities = JSON.parse(data);
            if (Array.isArray(sidebarEntities)) {
                return sidebarEntities;
            }
        } catch (e) {
            // Fall through default return.
        }

        return [];
    }

    public static serialize(sidebarEntities: SidebarEntityData[]): string {
        return JSON.stringify(sidebarEntities);
    }
}

type SidebarEntitiesChangeHandler = (sidebarEntities: SidebarEntityData[]) => void;

export class StorageManager {
    private readonly storage: Storage;

    public combinationId: CombinationId | null = null;
    public sidebarEntitiesChangeHandler: SidebarEntitiesChangeHandler | null = null;

    public constructor(storage: Storage) {
        this.storage = storage;

        window.addEventListener("storage", this.handleStorageEvent.bind(this));
    }

    private buildStorageKey(prefix: string, ...suffixes: string[]): string | undefined {
        if (!this.combinationId) {
            return;
        }

        return [prefix, this.combinationId.toShort(), ...suffixes].join("-");
    }

    private handleStorageEvent(event: StorageEvent): void {
        const sidebarKey = this.buildStorageKey(KEY_SIDEBAR_ENTITIES);
        if (sidebarKey && event.key === sidebarKey && this.sidebarEntitiesChangeHandler) {
            this.sidebarEntitiesChangeHandler(SidebarEntitiesUtils.deserialize(event.newValue || ""));
        }
    }

    private storeItem(key: string, item: string): void {
        try {
            this.storage.setItem(key, item);
        } catch (e) {
            // Persistence is best-effort; ignore storage errors (e.g. quota exceeded).
        }
    }

    public set scriptVersion(scriptVersion: string) {
        this.storeItem(KEY_SCRIPT_VERSION, scriptVersion);
    }

    public get scriptVersion(): string {
        return this.storage.getItem(KEY_SCRIPT_VERSION) || "";
    }

    public set sidebarEntities(sidebarEntities: SidebarEntityData[]) {
        const key = this.buildStorageKey(KEY_SIDEBAR_ENTITIES);
        if (!key) {
            return;
        }

        this.storeItem(key, SidebarEntitiesUtils.serialize(sidebarEntities));
    }

    public get sidebarEntities(): SidebarEntityData[] {
        const key = this.buildStorageKey(KEY_SIDEBAR_ENTITIES);
        if (!key) {
            return [];
        }

        return SidebarEntitiesUtils.deserialize(this.storage.getItem(key) || "");
    }
}

export const storageManager = new StorageManager(window.localStorage);
