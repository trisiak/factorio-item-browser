import { faCogs, faFlask, faIndustry, faTh } from "@fortawesome/free-solid-svg-icons";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { FC, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "react-responsive";
import { globalStoreContext } from "../../store/GlobalStore";
import { sidebarStoreContext } from "../../store/SidebarStore";
import { Breakpoint, RouteName } from "../../util/const";
import { getTranslatedSettingName } from "../../util/setting";
import SidebarButton from "../button/SidebarButton";
import PinnedEntityList from "./sidebar/PinnedEntityList";
import SidebarCloseIcon from "./sidebar/SidebarCloseIcon";
import SidebarCloseOverlay from "./sidebar/SidebarCloseOverlay";
import UnpinnedEntityList from "./sidebar/UnpinnedEntityList";

import "./Sidebar.scss";

/**
 * The component representing the sidebar of the page.
 */
const Sidebar: FC = () => {
    const { t } = useTranslation();
    const globalStore = useContext(globalStoreContext);
    const sidebarStore = useContext(sidebarStoreContext);
    const isLarge = useMediaQuery({ minWidth: Breakpoint.Large });

    const classes = classNames({
        "sidebar": true,
        "is-open": sidebarStore.isSidebarOpened,
    });

    if (globalStore.useBigHeader) {
        return null;
    }

    return (
        <>
            <div className={classes}>
                {isLarge ? null : <SidebarCloseIcon />}
                <SidebarButton
                    primary
                    route={RouteName.Settings}
                    icon={faCogs}
                    label={t("sidebar.setting", { name: getTranslatedSettingName(globalStore.setting) })}
                />
                <SidebarButton
                    route={RouteName.ItemList}
                    icon={faTh}
                    label={t("sidebar.all-items")}
                    highlighted={globalStore.currentRoute === RouteName.ItemList}
                />
                <SidebarButton
                    route={RouteName.RecipeList}
                    icon={faIndustry}
                    label={t("sidebar.all-recipes")}
                    highlighted={globalStore.currentRoute === RouteName.RecipeList}
                />
                <SidebarButton
                    route={RouteName.TechnologyList}
                    icon={faFlask}
                    label={t("sidebar.all-technologies")}
                    highlighted={globalStore.currentRoute === RouteName.TechnologyList}
                />

                <PinnedEntityList />
                <UnpinnedEntityList />
            </div>
            {isLarge ? null : <SidebarCloseOverlay />}
        </>
    );
};

export default observer(Sidebar);
