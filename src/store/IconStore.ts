import { action, makeObservable, observable } from "mobx";
import { createContext } from "react";
import { State } from "router5";
import { router, Router } from "../class/Router";
import { RouteName } from "../util/const";

type Entity = {
    type: string;
    name: string;
};

const emptyEntity: Entity = {
    type: "",
    name: "",
};

export class IconStore {
    /** The entity which should currently be highlighted. */
    public highlightedEntity: Entity = emptyEntity;

    public constructor(router: Router) {
        makeObservable<this, "handleGlobalRouteChange">(this, {
            handleGlobalRouteChange: action,
            highlightedEntity: observable,
        });

        router.addGlobalChangeHandler(this.handleGlobalRouteChange.bind(this));
    }

    private handleGlobalRouteChange(state: State): void {
        switch (state.name) {
            case RouteName.ItemDetails:
                this.highlightedEntity = {
                    type: state.params.type,
                    name: state.params.name,
                };
                break;

            case RouteName.RecipeDetails:
                this.highlightedEntity = {
                    type: "recipe",
                    name: state.params.name,
                };
                break;

            case RouteName.TechnologyDetails:
                this.highlightedEntity = {
                    type: "technology",
                    name: state.params.name,
                };
                break;

            default:
                this.highlightedEntity = emptyEntity;
                break;
        }
    }
}

export const iconStore = new IconStore(router);
export const iconStoreContext = createContext(iconStore);
