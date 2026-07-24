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
    researchCount?: number;
    researchCountFormula?: string;
    ingredients: RecipeItemData[];
};

/**
 * The component representing a technology's research cost: the science packs it consumes and
 * the research time per unit, laid out like a recipe's ingredient list. Trigger technologies
 * carry no science packs and no time; the section is hidden in that case.
 *
 * Data sources that publish the real research-unit count (the fbe browser artifact; see
 * docs/data-plane.md) add a "× N" row above the time, matching how the game states a
 * technology's cost — N units of those packs at that time each. Infinite/multi-level
 * technologies have no fixed count and show their level formula instead.
 */
const TechnologyResearch: FC<Props> = ({ researchTime, researchCount, researchCountFormula, ingredients }) => {
    const { t } = useTranslation();

    if (ingredients.length === 0 && researchTime <= 0) {
        return null;
    }

    // Unit counts are stated verbatim, not humanized like recipe amounts: "× 100000" is the
    // cost, "× 100k" would be a lie about a number players compare against science output.
    const count =
        researchCount !== undefined && researchCount > 0 ? String(researchCount) : (researchCountFormula ?? null);

    return (
        <Section headline={t("technology-details.research")}>
            <div className="recipe-item-list">
                {count !== null ? (
                    <div className="recipe-item">
                        <div className="amount">{`× ${count}`}</div>
                        <div className="label">{t("technology-details.research-count")}</div>
                    </div>
                ) : null}
                {researchTime > 0 ? <RecipeItemTime craftingTime={researchTime} /> : null}
                {ingredients.map((ingredient, index) => (
                    <RecipeItem key={`${ingredient.type}-${ingredient.name}-${index}`} item={ingredient} />
                ))}
            </div>
        </Section>
    );
};

export default observer(TechnologyResearch);
