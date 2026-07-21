import { observer } from "mobx-react-lite";
import React, { FC, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { recipeListStoreContext } from "../../store/RecipeListStore";
import { useDocumentTitle } from "../../util/hooks";
import Section from "../common/Section";
import RecipeList from "./recipeList/RecipeList";

/**
 * The component representing the page with the full recipe list.
 */
const RecipeListPage: FC = () => {
    const recipeListStore = useContext(recipeListStoreContext);
    const { t } = useTranslation();
    useDocumentTitle(t("recipe-list.title"));

    const recipeList = recipeListStore.paginatedRecipeList;
    useEffect((): void => {
        if (!recipeList.isLoading && recipeList.hasNextPage) {
            (async (): Promise<void> => {
                await recipeList.requestNextPage();
            })();
        }
    }, [recipeList.isLoading, recipeList.hasNextPage]);

    return (
        <Section headline={t("recipe-list.headline", { count: recipeList.numberOfResults })}>
            <RecipeList recipes={recipeList.results} loading={recipeList.hasNextPage} />
        </Section>
    );
};

export default observer(RecipeListPage);
