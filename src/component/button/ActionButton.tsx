import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import React, { ForwardRefRenderFunction } from "react";
import Button from "./Button";

type Props = {
    label: string;
    loadingLabel: string;
    icon?: IconProp;
    primary?: boolean;
    secondary?: boolean;
    spacing?: boolean;
    onClick: () => void | Promise<void>;
    isLoading: boolean;
    isVisible: boolean;
};

/**
 * The component representing a button with an action, which also have a loading animation.
 */
const ActionButton: ForwardRefRenderFunction<HTMLButtonElement, Props> = (props, ref) => {
    if (!props.isVisible) {
        return null;
    }

    if (props.isLoading) {
        return (
            <Button
                label={props.loadingLabel}
                icon={faSpinner}
                primary={props.primary}
                secondary={props.secondary}
                spacing={props.spacing}
                ref={ref}
            />
        );
    }

    return (
        <Button
            label={props.label}
            icon={props.icon}
            primary={props.primary}
            secondary={props.secondary}
            spacing={props.spacing}
            onClick={props.onClick}
            ref={ref}
        />
    );
};

export default observer(ActionButton, { forwardRef: true });
