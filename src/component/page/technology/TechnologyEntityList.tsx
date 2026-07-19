import { observer } from "mobx-react-lite";
import React, { FC } from "react";
import { TechnologyMetaData } from "../../../api/transfer";
import Section from "../../common/Section";
import EntityHead from "../../entity/EntityHead";
import EntityList from "../../entity/EntityList";

import "../../entity/Entity.scss";

type Props = {
    headline: string;
    technologies: TechnologyMetaData[];
};

/**
 * The component representing a list of technologies as icon-and-label boxes, used for both a
 * technology's prerequisites and the "unlocked by" section of an item. Renders nothing when
 * the list is empty.
 */
const TechnologyEntityList: FC<Props> = ({ headline, technologies }) => {
    if (technologies.length === 0) {
        return null;
    }

    return (
        <Section headline={headline}>
            <EntityList>
                {technologies.map((technology) => (
                    <div className="entity" key={technology.name}>
                        <EntityHead type="technology" name={technology.name} label={technology.label} />
                    </div>
                ))}
            </EntityList>
        </Section>
    );
};

export default observer(TechnologyEntityList);
