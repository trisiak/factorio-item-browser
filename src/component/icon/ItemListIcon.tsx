import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { FC, useRef } from "react";
import { humanizeName } from "../../util/format";
import { useEntityTooltip, useIcon } from "../../util/hooks";
import EntityLink from "../link/EntityLink";

import "./Icon.scss";

type Props = {
    type: string;
    name: string;
};

/**
 * The component representing an item as icon in the list.
 */
const ItemListIcon: FC<Props> = ({ type, name }) => {
    const iconRef = useRef<HTMLAnchorElement>(null);
    const { tooltipProps } = useEntityTooltip(type, name, iconRef);
    const iconClass = useIcon(type, name);

    const classes = classNames({
        icon: true,
        large: true,
        [iconClass]: true,
    });

    return (
        <EntityLink
            className={classes}
            type={type}
            name={name}
            aria-label={humanizeName(name)}
            ref={iconRef}
            {...tooltipProps}
        />
    );
};

export default observer(ItemListIcon);
