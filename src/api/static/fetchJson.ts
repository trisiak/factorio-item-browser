import { ServiceNotAvailableError } from "../../error/page";

/** Abort a pack download that stalls, surfacing it as a legible ServiceNotAvailableError. */
const FETCH_TIMEOUT_MS = 30000;

/**
 * Downloads one JSON file of a pack, collapsing every failure mode into a
 * `ServiceNotAvailableError` naming the pack: a non-OK response keeps its status, while
 * network failures, the timeout abort and JSON parse errors share one clear message.
 * Shared by every source adapter so all packs fail identically.
 */
export async function fetchPackJson<T>(url: string, packId: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new ServiceNotAvailableError(
                `Failed to download the data of pack "${packId}": HTTP ${response.status}`,
            );
        }
        return (await response.json()) as T;
    } catch (e) {
        // Re-throw the legible HTTP error as-is; collapse everything else.
        if (e instanceof ServiceNotAvailableError) {
            throw e;
        }
        throw new ServiceNotAvailableError(`Failed to download the data of pack "${packId}".`);
    } finally {
        clearTimeout(timeout);
    }
}
