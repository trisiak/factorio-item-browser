import { faArrowRight, faSave } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import React, { FC, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { settingsStoreContext } from "../../store/SettingsStore";
import { useDocumentTitle } from "../../util/hooks";
import ActionButton from "../button/ActionButton";
import Section from "../common/Section";
import ModList from "./setting/ModList";
import OptionLocale from "./setting/option/OptionLocale";
import OptionSettingId from "./setting/option/OptionSettingId";
import OptionsList from "./setting/option/OptionsList";

/**
 * The component representing the settings page: a picker for the bundled data packs, plus
 * the locale option. The upstream mod-combination management (create/validate/delete) does
 * not exist in the static fork.
 */
const SettingsPage: FC = () => {
    const settingsStore = useContext(settingsStoreContext);
    const { t } = useTranslation();
    const selectedSetting = settingsStore.selectedSetting;

    useDocumentTitle("settings.title");

    const handleChangeToSettingClick = useCallback((): void => {
        settingsStore.changeToSelectedSetting();
    }, []);
    const handleSaveClick = useCallback(async (): Promise<void> => {
        await settingsStore.saveOptions();
    }, []);

    return (
        <>
            <Section headline={t("settings.headline.settings")}>
                <OptionsList>
                    <OptionSettingId
                        settings={settingsStore.settings}
                        value={settingsStore.selectedCombinationId}
                        onChange={(settingId) => settingsStore.changeCombinationId(settingId)}
                        loading={settingsStore.isLoadingMods}
                    />
                </OptionsList>

                <ActionButton
                    primary
                    spacing
                    label={t("settings.change-to-setting", { name: selectedSetting.name })}
                    loadingLabel={t("settings.changing-to-setting", { name: selectedSetting.name })}
                    icon={faArrowRight}
                    isVisible={settingsStore.isChangeButtonVisible}
                    isLoading={settingsStore.isChangingToSetting}
                    onClick={handleChangeToSettingClick}
                />
            </Section>

            <Section headline={t("settings.headline.options", { name: selectedSetting.name })}>
                <OptionsList>
                    <OptionLocale
                        value={settingsStore.selectedOptions.locale}
                        onChange={(locale) => settingsStore.changeSelectedOptions({ locale })}
                    />
                </OptionsList>

                <ActionButton
                    primary
                    spacing
                    label={t("settings.save-options", { name: selectedSetting.name })}
                    loadingLabel={t("settings.saving-options", { name: selectedSetting.name })}
                    icon={faSave}
                    isVisible={settingsStore.isSaveButtonVisible}
                    isLoading={settingsStore.isSavingChanges}
                    onClick={handleSaveClick}
                />
            </Section>

            <ModList />
        </>
    );
};

export default observer(SettingsPage);
