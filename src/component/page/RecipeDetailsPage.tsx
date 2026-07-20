import { observer } from "mobx-react-lite";
import React, { FC, Fragment, useContext } from "react";
import { useTranslation } from "react-i18next";
import { recipeStoreContext } from "../../store/RecipeStore";
import { useDocumentTitle } from "../../util/hooks";
import CopyTemplate from "../common/CopyTemplate";
import Detail from "../common/Detail";
import DetailsHead from "../common/DetailsHead";
import RecipeDetails from "./recipe/RecipeDetails";
import RecipeMachinesList from "./recipe/RecipeMachinesList";
import TechnologyEntityList from "./technology/TechnologyEntityList";

/**
 * The component representing the details page of a recipe.
 */
const RecipeDetailsPage: FC = () => {
    const recipeStore = useContext(recipeStoreContext);
    const { t } = useTranslation();
    const details = recipeStore.recipeDetails;

    useDocumentTitle("recipe-details.title", { label: details.label || details.name });

    return (
        <Fragment>
            <DetailsHead
                type="recipe"
                name={details.name}
                title={t("recipe-details.headline", { label: details.label || details.name })}
            >
                <Detail hidden={!details.description}>{details.description}</Detail>
                <Detail>
                    <CopyTemplate
                        label={t("copy-template.rich-text-icon.label")}
                        template={`[recipe=${details.name}]`}
                        description={t("copy-template.rich-text-icon.description")}
                    />
                </Detail>
            </DetailsHead>

            <RecipeDetails recipe={details.recipe} />

            <TechnologyEntityList
                headline={t("recipe-details.unlocked-by", { count: recipeStore.unlockedByTechnologies.length })}
                technologies={recipeStore.unlockedByTechnologies}
            />

            <RecipeMachinesList paginatedList={recipeStore.paginatedMachinesList} />
        </Fragment>
    );
};

export default observer(RecipeDetailsPage);
