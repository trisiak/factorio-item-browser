import { observer } from "mobx-react-lite";
import React, { FC, Fragment, useContext } from "react";
import { useTranslation } from "react-i18next";
import { itemStoreContext } from "../../store/ItemStore";
import { useDocumentTitle } from "../../util/hooks";
import CopyTemplate from "../common/CopyTemplate";
import Detail from "../common/Detail";
import DetailsHead from "../common/DetailsHead";
import ItemRecipesList from "./item/ItemRecipesList";

/**
 * The component representing the item and fluid details page.
 */
const ItemDetailsPage: FC = () => {
    const itemStore = useContext(itemStoreContext);
    const { t } = useTranslation();
    const item = itemStore.item;

    useDocumentTitle(`item-details.title.${item.type || "item"}`, { label: item.label || item.name });

    return (
        <Fragment>
            <DetailsHead
                type={item.type}
                name={item.name}
                title={t(`item-details.headline.${item.type}`, { label: item.label || item.name })}
            >
                <Detail hidden={!item.description}>{item.description}</Detail>
                <Detail>
                    <CopyTemplate
                        label={t("copy-template.rich-text-icon.label")}
                        template={`[${item.type}=${item.name}]`}
                        description={t("copy-template.rich-text-icon.description")}
                    />
                </Detail>
                <Detail hidden={item.type !== "item"}>
                    <CopyTemplate
                        label={t("copy-template.cheat-command.label")}
                        template={`/c game.player.insert{ name="${item.name}", count=10 }`}
                        description={t("copy-template.cheat-command.description")}
                    />
                </Detail>
            </DetailsHead>

            <ItemRecipesList
                paginatedList={itemStore.paginatedProductRecipesList}
                headlineLocaleKey={"item-details.product-of"}
            />
            <ItemRecipesList
                paginatedList={itemStore.paginatedIngredientRecipesList}
                headlineLocaleKey={"item-details.ingredient-in"}
            />
            <ItemRecipesList
                paginatedList={itemStore.paginatedMachineRecipesList}
                headlineLocaleKey={"item-details.can-craft"}
            />
        </Fragment>
    );
};

export default observer(ItemDetailsPage);
