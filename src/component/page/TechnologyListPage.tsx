import { observer } from "mobx-react-lite";
import React, { FC, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { technologyListStoreContext } from "../../store/TechnologyListStore";
import { useDocumentTitle } from "../../util/hooks";
import Section from "../common/Section";
import TechnologyList from "./technologyList/TechnologyList";

/**
 * The component representing the page with the full technology list.
 */
const TechnologyListPage: FC = () => {
    const technologyListStore = useContext(technologyListStoreContext);
    const { t } = useTranslation();
    useDocumentTitle(t("technology-list.title"));

    const technologyList = technologyListStore.paginatedTechnologyList;
    useEffect((): void => {
        if (!technologyList.isLoading && technologyList.hasNextPage) {
            (async (): Promise<void> => {
                await technologyList.requestNextPage();
            })();
        }
    }, [technologyList.isLoading, technologyList.hasNextPage]);

    return (
        <Section headline={t("technology-list.headline", { count: technologyList.numberOfResults })}>
            <TechnologyList technologies={technologyList.results} loading={technologyList.hasNextPage} />
        </Section>
    );
};

export default observer(TechnologyListPage);
