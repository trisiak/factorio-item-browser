import { faThumbtack, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { FC, ReactNode, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SidebarEntityData } from "../../../api/transfer";
import { iconStoreContext } from "../../../store/IconStore";
import { sidebarStoreContext } from "../../../store/SidebarStore";
import { useEntityTooltip } from "../../../util/hooks";
import Icon from "../../icon/Icon";
import EntityLink from "../../link/EntityLink";

import "./SidebarEntity.scss";

function renderPinAction(entity: SidebarEntityData): ReactNode {
    const { t } = useTranslation();
    const sidebarStore = useContext(sidebarStoreContext);

    // Kept as a div (not a <button>): it is nested inside the entity's <a>, where interactive
    // elements would be invalid HTML. The anchor itself carries the semantics.
    return (
        <div
            className="action"
            role="button"
            title={t("sidebar.action-pin")}
            aria-label={t("sidebar.action-pin")}
            onClick={(event) => {
                sidebarStore.pinEntity(entity);
                event.preventDefault();
                event.stopPropagation();
                return false;
            }}
        >
            <FontAwesomeIcon icon={faThumbtack} aria-hidden />
        </div>
    );
}

function renderUnpinAction(entity: SidebarEntityData): ReactNode {
    const { t } = useTranslation();
    const sidebarStore = useContext(sidebarStoreContext);

    // Kept as a div (not a <button>): it is nested inside the entity's <a>, where interactive
    // elements would be invalid HTML. The anchor itself carries the semantics.
    return (
        <div
            className="action"
            role="button"
            title={t("sidebar.action-unpin")}
            aria-label={t("sidebar.action-unpin")}
            onClick={(event) => {
                sidebarStore.unpinEntity(entity);
                event.preventDefault();
                event.stopPropagation();
                return false;
            }}
        >
            <FontAwesomeIcon icon={faTrash} aria-hidden />
        </div>
    );
}

type Props = {
    entity: SidebarEntityData;
};

/**
 * The component representing a single entity in the sidebar.
 */
const SidebarEntity: FC<Props> = ({ entity }) => {
    const { t } = useTranslation();
    const iconStore = useContext(iconStoreContext);
    const sidebarStore = useContext(sidebarStoreContext);

    const iconRef = useRef<HTMLDivElement>(null);
    const { tooltipProps } = useEntityTooltip(entity.type, entity.name, iconRef);
    const entityId = sidebarStore.buildIdForEntity(entity);
    const highlightedEntity = iconStore.highlightedEntity;
    const classes = classNames({
        "sidebar-entity": true,
        "highlighted": entity.type === highlightedEntity.type && entity.name === highlightedEntity.name,
    });

    return (
        <EntityLink
            type={entity.type}
            name={entity.name}
            className={classes}
            draggable={true}
            data-id={entityId}
            {...tooltipProps}
        >
            <Icon type={entity.type} name={entity.name} ref={iconRef} />
            <span className="label">{entity.label || entity.name}</span>

            {entity.pinnedPosition > 0 ? renderUnpinAction(entity) : renderPinAction(entity)}
            <div className="type">{t(`box-label.${entity.type}`)}</div>
        </EntityLink>
    );
};

export default observer(SidebarEntity);
