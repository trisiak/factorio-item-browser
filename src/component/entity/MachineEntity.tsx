import { observer } from "mobx-react-lite";
import React, { FC, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MachineData } from "../../api/transfer";
import { formatCraftingSpeed, formatEnergyUsage, formatMachineSlots } from "../../util/format";
import { useEntityTooltip } from "../../util/hooks";
import Icon from "../icon/Icon";
import EntityLink from "../link/EntityLink";

import "./MachineEntity.scss";

type Props = {
    machine: MachineData;
};

/**
 * The component rendering a machine as an entity box.
 */
const MachineEntity: FC<Props> = ({ machine }) => {
    const { t } = useTranslation();
    const iconRef = useRef<HTMLDivElement>(null);

    const { tooltipProps } = useEntityTooltip("item", machine.name, iconRef);

    return (
        <div className="entity machine-entity">
            <EntityLink type="item" name={machine.name} className="entity-head" {...tooltipProps}>
                <Icon type="machine" name={machine.name} ref={iconRef} />
                <h3>{machine.label || machine.name}</h3>
            </EntityLink>

            <div className="machine-details">
                <div className="machine-detail">
                    <span className="label">{t("recipe-details.machine.crafting-speed")}</span>
                    <span className="value">{formatCraftingSpeed(machine.craftingSpeed)}</span>
                </div>
                <div className="machine-detail">
                    <span className="label">{t("recipe-details.machine.items")}</span>
                    <span className="value">{formatMachineSlots(machine.numberOfItems)}</span>
                </div>
                <div className="machine-detail">
                    <span className="label">{t("recipe-details.machine.fluids")}</span>
                    <span className="value">{formatMachineSlots(machine.numberOfFluids)}</span>
                </div>
                <div className="machine-detail">
                    <span className="label">{t("recipe-details.machine.modules")}</span>
                    <span className="value">{formatMachineSlots(machine.numberOfModules)}</span>
                </div>
                <div className="machine-detail">
                    <span className="label">{t("recipe-details.machine.energy-usage")}</span>
                    <span className="value">{formatEnergyUsage(machine.energyUsage, machine.energyUsageUnit)}</span>
                </div>
            </div>
        </div>
    );
};

export default observer(MachineEntity);
