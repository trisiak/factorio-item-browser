import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { ForwardRefRenderFunction, RefObject, useContext, useRef } from "react";
import { iconStoreContext } from "../../store/IconStore";
import { formatAmount, humanizeName } from "../../util/format";
import { useEntityTooltip, useIcon } from "../../util/hooks";
import EntityLink from "../link/EntityLink";

import "./CompactRecipeIcon.scss";

type Props = {
    type: string;
    name: string;
    amount: number;
};

/**
 * The component representing an icon in a compact recipe, including an amount and a background.
 */
const CompactRecipeIcon: ForwardRefRenderFunction<HTMLAnchorElement, Props> = ({ type, name, amount }, ref) => {
    const iconStore = useContext(iconStoreContext);

    let iconRef: RefObject<HTMLAnchorElement>;
    if (ref && "current" in ref) {
        iconRef = ref;
    } else {
        iconRef = useRef<HTMLAnchorElement>(null);
    }

    const { tooltipProps } = useEntityTooltip(type, name, iconRef);
    const iconClass = useIcon(type, name);

    const classes = classNames({
        "compact-recipe-icon": true,
        [iconClass]: true,
        "highlighted": iconStore.highlightedEntity.type === type && iconStore.highlightedEntity.name === name,
    });

    return (
        <EntityLink
            className={classes}
            type={type}
            name={name}
            aria-label={humanizeName(name)}
            ref={iconRef}
            {...tooltipProps}
        >
            <span className="amount">{formatAmount(amount)}</span>
        </EntityLink>
    );
};

export default observer(CompactRecipeIcon, { forwardRef: true });
