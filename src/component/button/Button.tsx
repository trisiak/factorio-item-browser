import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { ForwardRefRenderFunction } from "react";

import "./Button.scss";

type Props = {
    label: string;
    icon?: IconProp;
    primary?: boolean;
    secondary?: boolean;
    spacing?: boolean;
    onClick?: () => void | Promise<void>;
};

/**
 * The component representing a simple button to click on like there is no tomorrow.
 */
const Button: ForwardRefRenderFunction<HTMLButtonElement, Props> = (
    { label, icon, primary, secondary, spacing, onClick },
    ref,
) => {
    const classes = classNames({
        button: true,
        primary: primary,
        secondary: secondary,
        spacing: spacing,
    });

    return (
        <button type="button" className={classes} ref={ref} onClick={onClick}>
            {icon ? <FontAwesomeIcon icon={icon} spin={icon === faSpinner} aria-hidden /> : null}
            {label}
        </button>
    );
};

export default observer(Button, { forwardRef: true });
