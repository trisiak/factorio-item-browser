import {
    PointerEvent as ReactPointerEvent,
    MouseEvent as ReactMouseEvent,
    RefObject,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { debounce } from "throttle-debounce";
import { iconManager } from "../class/IconManager";
import { TooltipMode, tooltipStoreContext } from "../store/TooltipStore";

/**
 * Uses the specified title as the document title. If no title is specified, then the default title will be used.
 */
export function useDocumentTitle(title?: string, options?: { [key: string]: unknown }): void {
    const { t } = useTranslation();
    useEffect(() => {
        document.title = title ? t(title, options) : t("index.title");
    }, [title, ...Object.values(options || {})]);
}

/**
 * Uses the icon with the specified type and name, requesting it if it is not loaded yet.
 * The returned value is the CSS class to use for the icon.
 */
export function useIcon(type: string, name: string): string {
    useEffect((): void => {
        iconManager.requestIcon(type, name);
    }, [type, name]);

    return iconManager.buildCssClass(type, name);
}

/**
 * Uses a scroll effect.
 */
export function useScrollEffect(callback: () => void | Promise<void>): void {
    const debouncedCallback = useCallback(debounce(100, callback), [callback]);

    useEffect(() => {
        window.addEventListener("scroll", debouncedCallback);
        return (): void => window.removeEventListener("scroll", debouncedCallback);
    }, [callback]);
}

type UseTooltipResult = {
    showTooltip: (mode?: TooltipMode) => Promise<void>;
    hideTooltip: () => void;
};

/**
 * Uses a tooltip displaying information of the specified type and name on the referenced element.
 * The result are the callbacks to actually open and close the tooltip.
 */
export function useTooltip(type: string, name: string, ref: RefObject<Element>): UseTooltipResult {
    const tooltipStore = useContext(tooltipStoreContext);

    return {
        showTooltip: useCallback(
            async (mode: TooltipMode = "anchored"): Promise<void> => {
                await tooltipStore.showTooltip(ref, type, name, mode);
            },
            [type, name, ref],
        ),
        hideTooltip: useCallback((): void => {
            tooltipStore.hideTooltip();
        }, []),
    };
}

/** The duration in milliseconds a pointer must be held before a long-press fires. */
const LONG_PRESS_DURATION = 500;
/** The movement in pixels beyond which a pending long-press is cancelled. */
const LONG_PRESS_MOVE_THRESHOLD = 10;

type LongPressHandlers = {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerMove: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
    onPointerLeave: (event: ReactPointerEvent) => void;
    onPointerCancel: (event: ReactPointerEvent) => void;
    onClickCapture: (event: ReactMouseEvent) => void;
    onContextMenu: (event: ReactMouseEvent) => void;
};

/**
 * Uses a long-press interaction for touch and pen pointers: holding the element for {@link LONG_PRESS_DURATION}
 * milliseconds without moving more than {@link LONG_PRESS_MOVE_THRESHOLD} pixels invokes the callback. Mouse
 * pointers are ignored (they keep their hover semantics). Once a long-press has fired, the immediately following
 * click is suppressed so the element does not also navigate, and the context menu is suppressed on every pointer
 * type so the long-press feels native instead of opening the browser's link menu.
 */
export function useLongPress(
    onLongPress: () => void,
    options: { duration?: number; moveThreshold?: number } = {},
): LongPressHandlers {
    const { duration = LONG_PRESS_DURATION, moveThreshold = LONG_PRESS_MOVE_THRESHOLD } = options;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const suppressClickRef = useRef(false);

    const cancel = useCallback((): void => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startRef.current = null;
    }, []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent): void => {
            // A fresh press invalidates any stale suppression left over from a long-press whose
            // click never landed on this element (e.g. the finger lifted over the drawer backdrop).
            suppressClickRef.current = false;

            // Mouse keeps hover semantics; only touch/pen get a long-press.
            if (event.pointerType !== "touch" && event.pointerType !== "pen") {
                return;
            }

            cancel();
            startRef.current = { x: event.clientX, y: event.clientY };
            timerRef.current = setTimeout((): void => {
                timerRef.current = null;
                startRef.current = null;
                suppressClickRef.current = true;
                onLongPress();
            }, duration);
        },
        [cancel, duration, onLongPress],
    );

    const onPointerMove = useCallback(
        (event: ReactPointerEvent): void => {
            const start = startRef.current;
            if (!start) {
                return;
            }

            if (
                Math.abs(event.clientX - start.x) > moveThreshold ||
                Math.abs(event.clientY - start.y) > moveThreshold
            ) {
                cancel();
            }
        },
        [cancel, moveThreshold],
    );

    const onClickCapture = useCallback((event: ReactMouseEvent): void => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
        }
    }, []);

    const onContextMenu = useCallback((event: ReactMouseEvent): void => {
        event.preventDefault();
    }, []);

    // Clean up a pending timer when the component using the hook unmounts.
    useEffect((): (() => void) => cancel, [cancel]);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onClickCapture,
        onContextMenu,
    };
}

type EntityTooltipResult = {
    /** The event handlers to spread onto the entity's link/element to wire up its tooltip. */
    tooltipProps: {
        onPointerEnter: (event: ReactPointerEvent) => void;
        onPointerLeave: (event: ReactPointerEvent) => void;
        onFocus: () => void;
        onBlur: () => void;
    } & LongPressHandlers;
};

/**
 * Uses an entity tooltip on the referenced element, wiring up all the ways it can be shown: hovering with a mouse,
 * focusing it with the keyboard, and long-pressing it on a touch/pen device. Touch-emulated mouse events do not
 * trigger the hover path (it is guarded by the pointer type). Hover and focus show the classic anchored tooltip;
 * the long-press opens the bottom-drawer presentation instead, which fits small screens and stays interactive.
 */
export function useEntityTooltip(type: string, name: string, ref: RefObject<Element>): EntityTooltipResult {
    const { showTooltip, hideTooltip } = useTooltip(type, name, ref);

    const showAnchoredTooltip = useCallback((): void => {
        showTooltip("anchored");
    }, [showTooltip]);
    const showDrawerTooltip = useCallback((): void => {
        showTooltip("drawer");
    }, [showTooltip]);

    const longPressHandlers = useLongPress(showDrawerTooltip);

    const onPointerEnter = useCallback(
        (event: ReactPointerEvent): void => {
            if (event.pointerType === "mouse") {
                showAnchoredTooltip();
            }
        },
        [showAnchoredTooltip],
    );

    const onPointerLeave = useCallback(
        (event: ReactPointerEvent): void => {
            if (event.pointerType === "mouse") {
                hideTooltip();
            }
            longPressHandlers.onPointerLeave(event);
        },
        [hideTooltip, longPressHandlers],
    );

    return {
        tooltipProps: {
            ...longPressHandlers,
            onPointerEnter,
            onPointerLeave,
            onFocus: showAnchoredTooltip,
            onBlur: hideTooltip,
        },
    };
}

/**
 * Uses a callback to select the text of the specified element.
 */
export function useSelectClick(ref: RefObject<Node>): () => void {
    return useCallback(() => {
        const selection = window.getSelection();
        if (ref.current && selection) {
            const range = document.createRange();
            range.selectNodeContents(ref.current);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }, [ref]);
}
