import { SettingData } from "../api/transfer";

export function getTranslatedSettingName(setting: SettingData): string {
    return setting.name;
}
