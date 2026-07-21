import { action, makeObservable, observable } from "mobx";
import { createContext } from "react";
import { constants, State } from "router5";
import { router, Router } from "../class/Router";
import { ErrorSeverity, PageError, PageNotFoundError } from "../error/page";

export class ErrorStore {
    /** The fatal error which is currently present and from which cannot be recovered. */
    public fatalError: PageError | null = null;

    /** The error which is currently present. */
    public error: PageError | null = null;
    /** The error which will be present after routing has finished. */
    private nextError: PageError | null = null;

    public constructor(router: Router) {
        makeObservable<this, "handleGlobalRouteChange">(this, {
            error: observable,
            fatalError: observable,
            handleError: action,
            handleGlobalRouteChange: action,
        });

        router.addGlobalChangeHandler(this.handleGlobalRouteChange.bind(this));
        router.injectErrorHandler(this.handleError.bind(this));
    }

    private handleGlobalRouteChange(state: State): void {
        if (state.name === constants.UNKNOWN_ROUTE) {
            this.error = new PageNotFoundError(`unknown path: ${state.path}`);
            console.error(this.error);
        } else {
            this.error = this.nextError;
            this.nextError = null;
        }
    }

    /**
     * Handles the specified error, triggering the error page.
     */
    public handleError(error: PageError): void {
        if (error.severity !== ErrorSeverity.Warning) {
            this.fatalError = error;
        } else {
            this.nextError = error;
        }
        console.error(error);
    }

    /**
     * Creates an error handler to be used with a paginated list.
     * @param emptyData The empty data to return in case of an error.
     */
    public createPaginatedListErrorHandler<T>(emptyData: T): (error: PageError) => T {
        return (error) => {
            this.handleError(error);
            return emptyData;
        };
    }
}

export const errorStore = new ErrorStore(router);
export const errorStoreContext = createContext(errorStore);
