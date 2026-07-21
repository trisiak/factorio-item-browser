import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React, { FC, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { sidebarStoreContext } from "../../../store/SidebarStore";

import "./SidebarCloseIcon.scss";

/**
 * The component representing the close icon of the sidebar for mobile users.
 */
const SidebarCloseIcon: FC = () => {
    const { t } = useTranslation();
    const sidebarStore = useContext(sidebarStoreContext);
    const handleClick = useCallback((): void => {
        sidebarStore.closeSidebar();
    }, []);

    return (
        <button type="button" className="sidebar-close-icon" aria-label={t("sidebar.close")} onClick={handleClick}>
            <FontAwesomeIcon icon={faTimes} aria-hidden />
        </button>
    );
};

export default observer(SidebarCloseIcon);
