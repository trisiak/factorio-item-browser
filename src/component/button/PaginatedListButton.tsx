import { observer } from "mobx-react-lite";
import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ResultsData } from "../../api/transfer";
import { PaginatedList } from "../../class/PaginatedList";
import { useScrollEffect } from "../../util/hooks";
import ActionButton from "./ActionButton";

type Props<TEntity, TData extends ResultsData<TEntity>> = {
    paginatedList: PaginatedList<TEntity, TData>;
    localePrefix: string;
    loadOnScroll?: boolean;
};

/**
 * The button loading more pages for a paginated list.
 */
const PaginatedListButton = <TEntity, TData extends ResultsData<TEntity>>({
    paginatedList,
    localePrefix,
    loadOnScroll,
}: Props<TEntity, TData>) => {
    const { t } = useTranslation();
    const ref = useRef<HTMLButtonElement>(null);

    if (loadOnScroll) {
        useScrollEffect(async (): Promise<void> => {
            if (
                ref.current &&
                paginatedList.hasNextPage &&
                !paginatedList.isLoading &&
                window.scrollY + window.innerHeight > ref.current.offsetTop - window.innerHeight * 0.1
            ) {
                await paginatedList.requestNextPage();
            }
        });
    }

    const handleClick = useCallback(async (): Promise<void> => {
        await paginatedList.requestNextPage();
    }, [paginatedList]);

    return (
        <ActionButton
            primary
            spacing
            ref={ref}
            label={t(`${localePrefix}.load`)}
            loadingLabel={t(`${localePrefix}.loading`)}
            isVisible={paginatedList.hasNextPage}
            isLoading={paginatedList.isLoading}
            onClick={handleClick}
        />
    );
};

export default observer(PaginatedListButton);
