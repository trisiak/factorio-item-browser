import { Config } from "../util/config";
import { CombinationId } from "./CombinationId";
import { Router } from "./Router";

// A well-formed synthetic combination id (its 22-char short form is used in the URL).
const combinationId = CombinationId.fromFull("fab1a000-0000-4000-8000-000000000001");

describe("Router.buildPath", (): void => {
    const originalBasePath = Config.basePath;

    afterEach((): void => {
        Config.basePath = originalBasePath;
    });

    test("prefixes built paths with a BASE_PATH-like base", (): void => {
        Config.basePath = "/factorio-item-browser";
        const router = new Router();
        router.addRoute("item", "/:type<item|fluid>/:name");

        const path = router.buildPath("item", {
            combinationId: combinationId.toShort(),
            type: "item",
            name: "widget",
        });

        expect(path).toBe(`/factorio-item-browser/${combinationId.toShort()}/item/widget`);
    });

    test("builds paths without a prefix when served from the root", (): void => {
        Config.basePath = "";
        const router = new Router();
        router.addRoute("item", "/:type<item|fluid>/:name");

        const path = router.buildPath("item", {
            combinationId: combinationId.toShort(),
            type: "item",
            name: "widget",
        });

        expect(path).toBe(`/${combinationId.toShort()}/item/widget`);
    });
});
