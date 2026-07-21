import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { ResultsData } from "../api/transfer";
import { PageError } from "../error/page";

type DataFetcher<T> = (page: number) => Promise<T>;
type ErrorHandler<T> = (error: PageError) => T;

export class PaginatedList<TEntity, TData extends ResultsData<TEntity>> {
    private readonly dataFetcher: DataFetcher<TData>;
    private readonly errorHandler: ErrorHandler<TData>;

    public results: TEntity[] = [];
    public numberOfResults = 0;
    public currentPage = 0;
    public isLoading = false;

    /** The in-flight request, if any, so concurrent calls share it instead of duplicating a page. */
    private pendingRequest: Promise<TData> | null = null;

    public constructor(dataFetcher: DataFetcher<TData>, errorHandler: ErrorHandler<TData>) {
        this.dataFetcher = dataFetcher;
        this.errorHandler = errorHandler;

        makeObservable(this, {
            results: observable,
            numberOfResults: observable,
            currentPage: observable,
            isLoading: observable,
            hasNextPage: computed,
            requestNextPage: action,
        });
    }

    public get hasNextPage(): boolean {
        return this.results.length < this.numberOfResults;
    }

    public requestNextPage(): Promise<TData> {
        // Re-entrancy guard: while a page is loading, hand back the in-flight request so two
        // concurrent calls don't both fetch (and push) the same next page.
        if (this.pendingRequest) {
            return this.pendingRequest;
        }

        this.isLoading = true;
        const newPage = this.currentPage + 1;
        const request = this.fetchPage(newPage);
        this.pendingRequest = request;
        return request;
    }

    private async fetchPage(newPage: number): Promise<TData> {
        try {
            const data = await this.dataFetcher(newPage);
            return runInAction((): TData => {
                this.isLoading = false;
                this.pendingRequest = null;
                this.currentPage = newPage;
                this.results.push(...data.results);
                this.numberOfResults = data.numberOfResults;
                return data;
            });
        } catch (e) {
            // Reset the loading state before delegating, otherwise a failed page leaves
            // infinite scroll and the load-more button stuck forever.
            return runInAction((): TData => {
                this.isLoading = false;
                this.pendingRequest = null;
                return this.errorHandler(e as PageError);
            });
        }
    }
}
