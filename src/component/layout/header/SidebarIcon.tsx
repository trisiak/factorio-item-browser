import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React, { FC, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { sidebarStoreContext } from "../../../store/SidebarStore";

import "./HeaderIcon.scss";

/**
 * The component representing the icon for opening the sidebar on mobile devices.
 */
const SidebarIcon: FC = () => {
    const { t } = useTranslation();
    const sidebarStore = useContext(sidebarStoreContext);
    const handleClick = useCallback((): void => {
        sidebarStore.openSidebar();
    }, []);

    return (
        <button type="button" className="header-icon" aria-label={t("header.open-sidebar")} onClick={handleClick}>
            <FontAwesomeIcon icon={faBars} aria-hidden />
        </button>
    );
};

export default observer(SidebarIcon);
