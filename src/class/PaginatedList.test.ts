import { ResultsData } from "../api/transfer";
import { PageError } from "../error/page";
import { PaginatedList } from "./PaginatedList";

type Entity = { id: number };
type Data = ResultsData<Entity>;

const page = (results: Entity[], numberOfResults: number): Data => ({ results, numberOfResults });

describe("PaginatedList", (): void => {
    test("appends fetched pages and advances the page counter", async (): Promise<void> => {
        const list = new PaginatedList<Entity, Data>(
            async (requestedPage) => page([{ id: requestedPage }], 5),
            () => page([], 0),
        );

        await list.requestNextPage();
        await list.requestNextPage();

        expect(list.currentPage).toBe(2);
        expect(list.results).toEqual([{ id: 1 }, { id: 2 }]);
        expect(list.numberOfResults).toBe(5);
        expect(list.hasNextPage).toBe(true);
        expect(list.isLoading).toBe(false);
    });

    test("resets isLoading and delegates to the error handler on a failed page", async (): Promise<void> => {
        const emptyData = page([], 0);
        const errorHandler = jest.fn(() => emptyData);
        const list = new PaginatedList<Entity, Data>(async () => {
            throw new PageError("boom");
        }, errorHandler);

        const result = await list.requestNextPage();

        // Loading is cleared before delegating, so the load-more button is not stuck forever.
        expect(list.isLoading).toBe(false);
        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(result).toBe(emptyData);
        // A failed page does not advance the counter, so a retry re-requests the same page.
        expect(list.currentPage).toBe(0);
    });

    test("a later request retries after a failure", async (): Promise<void> => {
        let shouldFail = true;
        const list = new PaginatedList<Entity, Data>(
            async (requestedPage) => {
                if (shouldFail) {
                    throw new PageError("boom");
                }
                return page([{ id: requestedPage }], 1);
            },
            () => page([], 0),
        );

        await list.requestNextPage();
        shouldFail = false;
        await list.requestNextPage();

        expect(list.currentPage).toBe(1);
        expect(list.results).toEqual([{ id: 1 }]);
    });

    test("re-entrant calls share the in-flight request instead of fetching twice", async (): Promise<void> => {
        const fetcher = jest.fn(async (requestedPage: number) => page([{ id: requestedPage }], 5));
        const list = new PaginatedList<Entity, Data>(fetcher, () => page([], 0));

        const [first, second] = await Promise.all([list.requestNextPage(), list.requestNextPage()]);

        // Only one fetch happened and only one page was appended (no duplicate results).
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(first).toBe(second);
        expect(list.currentPage).toBe(1);
        expect(list.results).toEqual([{ id: 1 }]);
        expect(list.isLoading).toBe(false);
    });
});
