import { observer } from "mobx-react-lite";
import React, { FC, useRef } from "react";
import { RecipeItemData } from "../../../api/transfer";
import { formatAmount } from "../../../util/format";
import { useEntityTooltip } from "../../../util/hooks";
import Icon from "../../icon/Icon";
import EntityLink from "../../link/EntityLink";

import "./RecipeItem.scss";

type Props = {
    item: RecipeItemData;
};

/**
 * The component representing exactly one item of the recipe details.
 */
const RecipeItem: FC<Props> = ({ item }) => {
    const iconRef = useRef<HTMLDivElement>(null);
    const { tooltipProps } = useEntityTooltip(item.type, item.name, iconRef);

    return (
        <EntityLink className="recipe-item" type={item.type} name={item.name} {...tooltipProps}>
            <div className="amount">{formatAmount(item.amount)}</div>
            <Icon type={item.type} name={item.name} ref={iconRef} />
            <div className="label">{item.label || item.name}</div>
        </EntityLink>
    );
};

export default observer(RecipeItem);
