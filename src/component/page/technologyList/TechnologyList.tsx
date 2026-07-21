import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React, { FC } from "react";
import { TechnologyMetaData } from "../../../api/transfer";
import ItemListIcon from "../../icon/ItemListIcon";

import "../itemList/ItemList.scss";

type Props = {
    technologies: TechnologyMetaData[];
    loading?: boolean;
};

/**
 * The component representing the list of technologies as icons. Reuses the item-list grid
 * layout and the shared ItemListIcon (technology is a first-class entity type, so tooltips
 * and click-through to the detail page come for free).
 */
const TechnologyList: FC<Props> = ({ technologies, loading }) => {
    return (
        <div className="item-list">
            {technologies.map((technology) => {
                return <ItemListIcon key={technology.name} type="technology" name={technology.name} />;
            })}

            {loading && (
                <div className="loading">
                    <FontAwesomeIcon icon={faSpinner} spin />
                </div>
            )}
        </div>
    );
};

export default observer(TechnologyList);
