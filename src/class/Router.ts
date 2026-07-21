import { createRouter, Middleware, Router as Router5, State, SubscribeState } from "router5";
import browserPluginFactory from "router5-plugin-browser";
import { PageError } from "../error/page";
import { Config } from "../util/config";
import { RouteName } from "../util/const";
import { CombinationId } from "./CombinationId";

type ChangeHandler = (state: State) => void | Promise<void>;
type ErrorHandler = (error: PageError) => void;
export type RouteParams = { [key: string]: string };

const PARAM_COMBINATION_ID = "combinationId";
enum RouteSuffix {
    MissingId = "_missing",
    LongId = "_long",
}

export class Router {
    private readonly router: Router5;
    private readonly changeHandlers = new Map<string, ChangeHandler>();
    private readonly globalChangeHandlers = new Set<ChangeHandler>();
    private combinationId: CombinationId | null = null;
    private errorHandler: ErrorHandler | null = null;

    public constructor() {
        this.router = this.createRouter();
    }

    private createRouter(): Router5 {
        const router = createRouter();
        router.setOption("allowNotFound", true);
        router.usePlugin(browserPluginFactory({ base: Config.basePath }));
        router.useMiddleware(this.getDataFetcherMiddleware.bind(this));
        router.subscribe(this.handleChangeEvent.bind(this));
        return router;
    }

    /**
     * Injects the callback to handle errors by forwarding it.
     */
    public injectErrorHandler(errorHandler: ErrorHandler): void {
        this.errorHandler = errorHandler;
    }

    private getDataFetcherMiddleware(): Middleware {
        return (toState: State) => {
            const handler = this.changeHandlers.get(toState.name);
            if (handler) {
                return handler(toState);
            }
            return true;
        };
    }

    private handleChangeEvent(state: SubscribeState): void {
        if (this.getRouteSuffix(state.route.name) === null) {
            for (const handler of this.globalChangeHandlers) {
                handler(state.route);
            }
        }
    }

    private getRouteSuffix(stateName: string): RouteSuffix | null {
        for (const suffix of Object.values(RouteSuffix)) {
            if (stateName.endsWith(suffix)) {
                return suffix;
            }
        }
        return null;
    }

    public start(combinationId: CombinationId): void {
        this.combinationId = combinationId;
        this.router.start((err?: unknown, state?: State): void => {
            if (state) {
                const suffix = this.getRouteSuffix(state.name);
                if (suffix !== null) {
                    this.router.navigate(
                        state.name.substr(0, state.name.length - suffix.length),
                        {
                            ...state.params,
                            [PARAM_COMBINATION_ID]: combinationId.toShort(),
                        },
                        { replace: true },
                    );
                } else if (
                    state.params[PARAM_COMBINATION_ID] &&
                    state.params[PARAM_COMBINATION_ID] !== combinationId.toShort()
                ) {
                    // The URL carried a well-formed short id that does not match the resolved
                    // pack (an unknown or stale combination id). Rewrite it so the address bar
                    // agrees with the pack actually loaded, replacing the entry to keep history clean.
                    this.router.navigate(
                        state.name,
                        {
                            ...state.params,
                            [PARAM_COMBINATION_ID]: combinationId.toShort(),
                        },
                        { replace: true },
                    );
                }
            }
        });
    }

    public addGlobalChangeHandler(handler: ChangeHandler): void {
        this.globalChangeHandlers.add(handler);
    }

    public addRoute(name: string, path: string, changeHandler?: ChangeHandler): void {
        this.router.add([
            {
                name: name,
                path: `/:${PARAM_COMBINATION_ID}<[0-9a-zA-Z]{22}>${path}`,
            },
            {
                name: name + RouteSuffix.MissingId,
                path: path,
            },
            {
                name: name + RouteSuffix.LongId,
                path: `/:${PARAM_COMBINATION_ID}<[0-9a-f-]{36}>${path}`,
            },
        ]);

        if (changeHandler) {
            this.changeHandlers.set(name, changeHandler);
        }
    }

    public isActive(route: string, params?: RouteParams): boolean {
        return this.router.isActive(route, this.prepareParams(params));
    }

    public navigateTo(route: string, params?: RouteParams): void {
        this.router.navigate(route, this.prepareParams(params));
    }

    public buildPath(route: string, params?: RouteParams): string {
        // Include the base path so built hrefs work when served under a path prefix.
        return Config.basePath + this.router.buildPath(route, this.prepareParams(params));
    }

    public redirectToIndex(combinationId: CombinationId): void {
        location.assign(this.buildPath(RouteName.Index, { [PARAM_COMBINATION_ID]: combinationId.toShort() }));
    }

    private prepareParams(params?: RouteParams): RouteParams {
        params = params || {};
        if (this.combinationId && !params[PARAM_COMBINATION_ID]) {
            params[PARAM_COMBINATION_ID] = this.combinationId.toShort();
        }
        return params;
    }

    /**
     * Handles the error, forwarding it to the error store to trigger an error page.
     */
    public handleError(error: PageError): void {
        if (this.errorHandler) {
            this.errorHandler(error);
        }
    }
}

export const router: Router = new Router();
