import { observer } from "mobx-react-lite";
import React, { FC, Fragment, useContext } from "react";
import { useTranslation } from "react-i18next";
import { technologyStoreContext } from "../../store/TechnologyStore";
import { useDocumentTitle } from "../../util/hooks";
import DetailsHead from "../common/DetailsHead";
import Section from "../common/Section";
import Entity from "../entity/Entity";
import EntityList from "../entity/EntityList";
import TechnologyEntityList from "./technology/TechnologyEntityList";
import TechnologyResearch from "./technology/TechnologyResearch";

/**
 * The component representing the details page of a technology: its research cost, the
 * technologies it depends on (traversable) and the recipes it unlocks.
 */
const TechnologyDetailsPage: FC = () => {
    const technologyStore = useContext(technologyStoreContext);
    const { t } = useTranslation();
    const technology = technologyStore.technology;

    useDocumentTitle("technology-details.title", { label: technology.label || technology.name });

    return (
        <Fragment>
            <DetailsHead
                type="technology"
                name={technology.name}
                title={t("technology-details.headline", { label: technology.label || technology.name })}
            />

            <TechnologyResearch researchTime={technology.researchTime} ingredients={technology.ingredients} />

            <TechnologyEntityList
                headline={t("technology-details.prerequisites")}
                technologies={technology.prerequisites}
            />

            <TechnologyEntityList
                headline={t("technology-details.leads-to", { count: technology.unlockedTechnologies.length })}
                technologies={technology.unlockedTechnologies}
            />

            {technology.numberOfUnlockedRecipes > 0 ? (
                <Section headline={t("technology-details.unlocks", { count: technology.numberOfUnlockedRecipes })}>
                    <EntityList>
                        {technology.unlockedRecipes.map((recipe) => (
                            <Entity key={recipe.name} entity={recipe} />
                        ))}
                    </EntityList>
                </Section>
            ) : null}
        </Fragment>
    );
};

export default observer(TechnologyDetailsPage);
