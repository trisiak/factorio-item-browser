import { observer } from "mobx-react-lite";
import React, { ForwardRefRenderFunction } from "react";

import "./Icon.scss";

type Props = {
    combinationId: string;
    name: string;
};

/**
 * The component representing a mod icon. Mod icons cannot be resolved from the static
 * pack data, so this renders a plain placeholder box to keep the settings layout intact.
 */
const ModIcon: ForwardRefRenderFunction<HTMLDivElement, Props> = (_props, ref) => {
    return <div className="icon" ref={ref} />;
};

export default observer(ModIcon, { forwardRef: true });
