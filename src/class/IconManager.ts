import { debounce } from "throttle-debounce";
import { PortalApi, portalApi } from "../api/PortalApi";
import { NamesByTypes } from "../api/transfer";
import { Config } from "../util/config";
import { NamesByTypesSet } from "./NamesByTypesSet";

const CSS_SELECTOR_COMMON = ".icon-{type}-{name}";

class IconsStyle {
    private readonly styleElement: HTMLElement;

    public constructor() {
        this.styleElement = document.createElement("style");
        document.head.appendChild(this.styleElement);
    }

    public append(style: string): void {
        this.styleElement.appendChild(document.createTextNode(style));
    }
}

abstract class AbstractIconManager {
    protected readonly portalApi: PortalApi;
    protected readonly style: IconsStyle;

    private readonly debounceRequestStyle: () => void;
    private readonly requestedEntities = new NamesByTypesSet();
    private readonly processedEntities = new NamesByTypesSet();

    public constructor(portalApi: PortalApi, style: IconsStyle) {
        this.portalApi = portalApi;
        this.style = style;

        this.debounceRequestStyle = debounce(10, this.requestStyle.bind(this));
    }

    protected requestEntity(type: string, name: string): void {
        if (this.processedEntities.has(type, name)) {
            return;
        }
        this.processedEntities.add(type, name);
        this.requestedEntities.add(type, name);

        if (this.requestedEntities.size > Config.numberOfIconsPerRequest) {
            this.requestStyle();
        } else {
            this.debounceRequestStyle();
        }
    }

    private requestStyle(): void {
        if (this.requestedEntities.size === 0) {
            return;
        }

        const entities = this.requestedEntities.getData();
        this.requestedEntities.clear();

        (async () => {
            try {
                const processedEntities = await this.requestStyleForEntities(entities);
                this.processedEntities.merge(processedEntities);
            } catch (e) {
                // Ignore any failures while loading icons.
            }
        })();
    }

    protected abstract requestStyleForEntities(entities: NamesByTypes): Promise<NamesByTypes>;
}

class IconManager extends AbstractIconManager {
    public requestIcon(type: string, name: string): void {
        this.requestEntity(type, name);
    }

    public buildCssClass(type: string, name: string): string {
        let result = CSS_SELECTOR_COMMON.slice(1);
        result = result.replaceAll("{type}", type.replaceAll(" ", "_"));
        result = result.replaceAll("{name}", name.replaceAll(" ", "_"));
        return result;
    }

    protected async requestStyleForEntities(entities: NamesByTypes): Promise<NamesByTypes> {
        const response = await this.portalApi.getIconsStyle({
            cssSelector: CSS_SELECTOR_COMMON,
            entities: entities,
        });

        this.style.append(response.style);
        return response.processedEntities;
    }
}

const style = new IconsStyle();
export const iconManager = new IconManager(portalApi, style);
