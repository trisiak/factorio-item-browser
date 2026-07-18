import { observer } from "mobx-react-lite";
import React, { FC, ReactNode, useContext, useEffect } from "react";
import { errorStoreContext } from "../store/ErrorStore";
import { globalStoreContext } from "../store/GlobalStore";
import { RouteName } from "../util/const";
import LoadingCircle from "./common/LoadingCircle";
import Tooltip from "./common/Tooltip";
import ErrorBoundary from "./error/ErrorBoundary";
import FatalError from "./error/FatalError";
import LoadingBox from "./error/LoadingBox";
import Footer from "./layout/Footer";
import Header from "./layout/Header";
import Sidebar from "./layout/Sidebar";
import ErrorPage from "./page/ErrorPage";
import IndexPage from "./page/IndexPage";
import ItemDetailsPage from "./page/ItemDetailsPage";
import ItemListPage from "./page/ItemListPage";
import RecipeDetailsPage from "./page/RecipeDetailsPage";
import SearchResultsPage from "./page/SearchResultsPage";
import SettingsNewPage from "./page/SettingsNewPage";
import SettingsPage from "./page/SettingsPage";
import GlobalSettingStatus from "./status/GlobalSettingStatus";
import TemporarySettingStatus from "./status/TemporarySettingStatus";

import "./App.scss";

const PAGE_BY_ROUTES: { [key: string]: ReactNode } = {
    [RouteName.Index]: <IndexPage />,
    [RouteName.ItemDetails]: <ItemDetailsPage />,
    [RouteName.ItemList]: <ItemListPage />,
    [RouteName.RecipeDetails]: <RecipeDetailsPage />,
    [RouteName.Search]: <SearchResultsPage />,
    [RouteName.Settings]: <SettingsPage />,
    [RouteName.SettingsNew]: <SettingsNewPage />,
};

/**
 * The component representing the whole application.
 */
const App: FC = () => {
    const errorStore = useContext(errorStoreContext);
    const globalStore = useContext(globalStoreContext);

    useEffect(() => {
        (async () => {
            await globalStore.initialize();
        })();
    }, []);

    if (errorStore.fatalError !== null) {
        return <FatalError error={errorStore.fatalError} />;
    }

    if (globalStore.isInitiallyLoading) {
        return <LoadingBox />;
    }

    let page;
    if (errorStore.error !== null) {
        page = <ErrorPage error={errorStore.error} />;
    } else {
        page = PAGE_BY_ROUTES[globalStore.currentRoute];
    }

    return (
        <ErrorBoundary>
            <Header />
            <div className="content-wrapper">
                <Sidebar />
                <div className="content">
                    {globalStore.isGlobalSettingStatusShown ? (
                        <>
                            <TemporarySettingStatus
                                setting={globalStore.setting}
                                lastUsedSetting={globalStore.lastUsedSetting}
                            />
                            <GlobalSettingStatus />
                        </>
                    ) : null}
                    {page}
                </div>
            </div>
            <Footer />

            <LoadingCircle target={globalStore.loadingCircleTarget} />
            <Tooltip />
        </ErrorBoundary>
    );
};

export default observer(App);
