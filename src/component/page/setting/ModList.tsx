import { observer } from "mobx-react-lite";
import React, { FC, useContext } from "react";
import { useTranslation } from "react-i18next";
import { settingsStoreContext } from "../../../store/SettingsStore";
import { SettingStatus } from "../../../util/const";
import { getTranslatedSettingName } from "../../../util/setting";
import Section from "../../common/Section";
import EntityList from "../../entity/EntityList";
import Mod from "../../entity/Mod";

const ModList: FC = () => {
    const settingStore = useContext(settingsStoreContext);
    const { t } = useTranslation();
    const setting = settingStore.selectedSetting;
    const mods = settingStore.selectedSettingMods;

    if (settingStore.isLoadingMods || setting.status !== SettingStatus.Available) {
        return null;
    }

    return (
        <Section
            headline={t("settings.headline.mod-list", {
                count: mods.length,
                name: getTranslatedSettingName(setting),
            })}
        >
            <EntityList>
                {mods.map((mod) => {
                    return <Mod key={mod.name} mod={mod} setting={setting} />;
                })}
            </EntityList>
        </Section>
    );
};

export default observer(ModList);
