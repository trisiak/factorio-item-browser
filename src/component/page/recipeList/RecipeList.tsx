import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React, { FC } from "react";
import { RecipeMetaData } from "../../../api/transfer";
import ItemListIcon from "../../icon/ItemListIcon";

import "../itemList/ItemList.scss";

type Props = {
    recipes: RecipeMetaData[];
    loading?: boolean;
};

/**
 * The component representing the list of recipes as icons. Reuses the item-list grid layout
 * and the shared ItemListIcon (recipe is a first-class entity type, so tooltips and
 * click-through to the detail page come for free).
 */
const RecipeList: FC<Props> = ({ recipes, loading }) => {
    return (
        <div className="item-list">
            {recipes.map((recipe) => {
                return <ItemListIcon key={recipe.name} type="recipe" name={recipe.name} />;
            })}

            {loading && (
                <div className="loading">
                    <FontAwesomeIcon icon={faSpinner} spin />
                </div>
            )}
        </div>
    );
};

export default observer(RecipeList);
