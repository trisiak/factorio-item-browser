import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { CombinationId } from "../class/CombinationId";
import { storageManager } from "../class/StorageManager";
import { HttpPortalApi } from "./PortalApi";
import { SettingOptionsData, SidebarEntityData } from "./transfer";

async function catchRequest<T>(responseData: T): Promise<AxiosRequestConfig> {
    return new Promise((resolve) => {
        axios.defaults.adapter = async (request: AxiosRequestConfig): Promise<AxiosResponse> => {
            resolve(request);
            return Promise.resolve({
                data: responseData,
                status: 200,
                statusText: "OK",
                headers: [],
                config: request,
            });
        };
    });
}

describe("HttpPortalApi", (): void => {
    describe("endpoints", (): void => {
        const responseData = { foo: "bar" };
        const combinationId = "5e782820-364f-4f63-b227-ffcb3ce1d6fc";

        beforeEach((): void => {
            storageManager.combinationId = CombinationId.fromFull(combinationId);
        });

        test("initialize", async (): Promise<void> => {
            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/init",
                method: "post",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.initializeSession();

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getItemIngredientRecipes", async (): Promise<void> => {
            const type = "item";
            const name = "abc";
            const page = 4;

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/item/abc/ingredients",
                params: {
                    indexOfFirstResult: 36,
                    numberOfResults: 12,
                },
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getItemIngredientRecipes(type, name, page);

            expect(storageManager.readFromCache).toHaveBeenCalledWith("ingredient-item-abc-4");
            expect(storageManager.writeToCache).toHaveBeenCalledWith("ingredient-item-abc-4", responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getItemProductRecipes", async (): Promise<void> => {
            const type = "item";
            const name = "abc";
            const page = 4;

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/item/abc/products",
                params: {
                    indexOfFirstResult: 36,
                    numberOfResults: 12,
                },
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getItemProductRecipes(type, name, page);

            expect(storageManager.readFromCache).toHaveBeenCalledWith("product-item-abc-4");
            expect(storageManager.writeToCache).toHaveBeenCalledWith("product-item-abc-4", responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getItemList", async (): Promise<void> => {
            const page = 4;

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/items",
                params: {
                    indexOfFirstResult: 3072,
                    numberOfResults: 1024,
                },
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getItemList(page);

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getRandom", async (): Promise<void> => {
            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/random",
                params: {
                    numberOfResults: 12,
                },
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getRandom();

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getRecipeDetails", async (): Promise<void> => {
            const name = "abc";

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/recipe/abc",
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getRecipeDetails(name);

            expect(storageManager.readFromCache).toHaveBeenCalledWith("recipe-abc");
            expect(storageManager.writeToCache).toHaveBeenCalledWith("recipe-abc", responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getRecipeMachines", async (): Promise<void> => {
            const name = "abc";
            const page = 4;

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/recipe/abc/machines",
                params: {
                    indexOfFirstResult: 36,
                    numberOfResults: 12,
                },
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getRecipeMachines(name, page);

            expect(storageManager.readFromCache).toHaveBeenCalledWith("machine-abc-4");
            expect(storageManager.writeToCache).toHaveBeenCalledWith("machine-abc-4", responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("search", async (): Promise<void> => {
            const query = "abc";
            const page = 4;

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/search",
                params: {
                    query: "abc",
                    indexOfFirstResult: 72,
                    numberOfResults: 24,
                },
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.search(query, page);

            expect(storageManager.readFromCache).toHaveBeenCalledWith("search-abc-4");
            expect(storageManager.writeToCache).toHaveBeenCalledWith("search-abc-4", responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getSettings", async (): Promise<void> => {
            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/settings",
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getSettings();

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("validateSetting", async (): Promise<void> => {
            const modNames = ["abc", "def"];
            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/setting/validate",
                data: JSON.stringify(modNames),
                method: "post",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.validateSetting(modNames);

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getSetting", async (): Promise<void> => {
            const settingCombinationId = "281d1fce-dd74-41c6-8dca-3717629e869a";

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/setting/281d1fce-dd74-41c6-8dca-3717629e869a",
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getSetting(settingCombinationId);

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("saveSetting", async (): Promise<void> => {
            const settingCombinationId = "281d1fce-dd74-41c6-8dca-3717629e869a";
            const options: SettingOptionsData = {
                name: "abc",
                locale: "def",
                recipeMode: "ghi",
            };

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/setting/281d1fce-dd74-41c6-8dca-3717629e869a",
                data: JSON.stringify(options),
                method: "put",
                headers: {
                    "Combination-Id": combinationId,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            await portalApi.saveSetting(settingCombinationId, options);

            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("deleteSetting", async (): Promise<void> => {
            const settingCombinationId = "281d1fce-dd74-41c6-8dca-3717629e869a";

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/setting/281d1fce-dd74-41c6-8dca-3717629e869a",
                method: "delete",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            await portalApi.deleteSetting(settingCombinationId);

            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getSettingMods", async () => {
            const settingCombinationId = "281d1fce-dd74-41c6-8dca-3717629e869a";
            const cacheKey = "setting-281d1fce-dd74-41c6-8dca-3717629e869a-mods";

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/setting/281d1fce-dd74-41c6-8dca-3717629e869a/mods",
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getSettingMods(settingCombinationId);

            expect(storageManager.readFromCache).toHaveBeenCalledWith(cacheKey);
            expect(storageManager.writeToCache).toHaveBeenCalledWith(cacheKey, responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("sendSidebarEntities", async (): Promise<void> => {
            const sidebarEntities: SidebarEntityData[] = [
                {
                    type: "item",
                    name: "abc",
                    label: "def",
                    pinnedPosition: 42,
                    lastViewTime: "2001-02-03T04:04:06.000+07:00",
                },
                {
                    type: "recipe",
                    name: "ghi",
                    label: "jkl",
                    pinnedPosition: 0,
                    lastViewTime: "2001-02-03T04:04:06.000+07:00",
                },
            ];

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/sidebar/entities",
                data: JSON.stringify(sidebarEntities),
                method: "put",
                headers: {
                    "Combination-Id": combinationId,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            await portalApi.sendSidebarEntities(sidebarEntities);

            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getIconsStyle", async (): Promise<void> => {
            const request = {
                cssSelector: ".foo",
                entities: {
                    abc: ["def", "ghi"],
                },
            };

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/style/icons",
                data: JSON.stringify(request),
                method: "post",
                headers: {
                    "Combination-Id": combinationId,
                    "Content-Type": "application/json",
                },
                withCredentials: true,
            };

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getIconsStyle(request);

            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });

        test("getTooltip", async (): Promise<void> => {
            const type = "item";
            const name = "abc";

            const expectedRequest: AxiosRequestConfig = {
                baseURL: "portal-api-server",
                url: "/tooltip/item/abc",
                method: "get",
                headers: {
                    "Combination-Id": combinationId,
                },
                withCredentials: true,
            };

            jest.spyOn(storageManager, "readFromCache").mockReturnValue(null);
            jest.spyOn(storageManager, "writeToCache");

            const requestPromise = catchRequest(responseData);
            const portalApi = new HttpPortalApi(storageManager);
            const result = await portalApi.getTooltip(type, name);

            expect(storageManager.readFromCache).toHaveBeenCalledWith("tooltip-item-abc");
            expect(storageManager.writeToCache).toHaveBeenCalledWith("tooltip-item-abc", responseData);
            expect(result).toEqual(responseData);
            return expect(requestPromise).resolves.toMatchObject(expectedRequest);
        });
    });
});
