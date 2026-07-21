import { observer } from "mobx-react-lite";
import React, { ForwardRefRenderFunction, MouseEvent, ReactNode, useCallback, useContext, useRef } from "react";
import { RouteParams } from "../../class/Router";
import { globalStoreContext } from "../../store/GlobalStore";
import { RouteName } from "../../util/const";

type Props = {
    route: RouteName;
    params?: RouteParams;
    children?: ReactNode;
    [key: string]: unknown;
};

/**
 * The component creating a link to another route.
 */
const Link: ForwardRefRenderFunction<HTMLAnchorElement, Props> = ({ route, params, children, ...props }, ref) => {
    const globalStore = useContext(globalStoreContext);
    const path = globalStore.router.buildPath(route, params);

    ref = ref || useRef<HTMLAnchorElement>(null);

    const handleClick = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            event.stopPropagation();
            if (!globalStore.router.isActive(route, params)) {
                if (ref && "current" in ref) {
                    globalStore.showLoadingCircle(ref);
                }
                globalStore.router.navigateTo(route, params);
            }
            return false;
        },
        [route, params, ref],
    );

    return (
        <a {...props} ref={ref} href={path} onClick={handleClick}>
            {children}
        </a>
    );
};

export default observer(Link, { forwardRef: true });
