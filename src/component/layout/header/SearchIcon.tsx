import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React, { FC, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { searchStoreContext } from "../../../store/SearchStore";

import "./HeaderIcon.scss";

/**
 * The component representing the icon for opening the search bar on mobile devices.
 */
const SearchIcon: FC = () => {
    const { t } = useTranslation();
    const searchStore = useContext(searchStoreContext);
    const handleClick = useCallback((): void => {
        searchStore.openSearch();
    }, []);

    return (
        <button type="button" className="header-icon" aria-label={t("header.open-search")} onClick={handleClick}>
            <FontAwesomeIcon icon={faSearch} aria-hidden />
        </button>
    );
};

export default observer(SearchIcon);
