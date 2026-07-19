import { observer } from "mobx-react-lite";
import React, { FC } from "react";
import { useTranslation } from "react-i18next";
import { RecipeItemData } from "../../../api/transfer";
import Section from "../../common/Section";
import RecipeItem from "../recipe/RecipeItem";
import RecipeItemTime from "../recipe/RecipeItemTime";

import "../recipe/RecipeItemList.scss";

type Props = {
    researchTime: number;
    ingredients: RecipeItemData[];
};

/**
 * The component representing a technology's research cost: the science packs it consumes and
 * the research time per unit, laid out like a recipe's ingredient list. Trigger technologies
 * carry no science packs and no time; the section is hidden in that case.
 */
const TechnologyResearch: FC<Props> = ({ researchTime, ingredients }) => {
    const { t } = useTranslation();

    if (ingredients.length === 0 && researchTime <= 0) {
        return null;
    }

    return (
        <Section headline={t("technology-details.research")}>
            <div className="recipe-item-list">
                {researchTime > 0 ? <RecipeItemTime craftingTime={researchTime} /> : null}
                {ingredients.map((ingredient, index) => (
                    <RecipeItem key={`${ingredient.type}-${ingredient.name}-${index}`} item={ingredient} />
                ))}
            </div>
        </Section>
    );
};

export default observer(TechnologyResearch);
