import { RouteName } from "./const";

const entityTypeToRouteNameMap: { [key: string]: RouteName } = {
    item: RouteName.ItemDetails,
    fluid: RouteName.ItemDetails,
    recipe: RouteName.RecipeDetails,
    technology: RouteName.TechnologyDetails,
};

type RouteAndParams = {
    route: RouteName;
    params: { [key: string]: unknown };
};

/**
 * Returns the route and params used to link to the entity.
 */
export function getRouteAndParamsForEntity(type: string, name: string): RouteAndParams {
    const route = entityTypeToRouteNameMap[type];
    if (route) {
        return {
            route: route,
            params: { type, name },
        };
    }

    return {
        route: RouteName.Index,
        params: {},
    };
}
