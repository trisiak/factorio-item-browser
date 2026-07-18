import { RefObject, useCallback, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { debounce } from "throttle-debounce";
import { iconManager } from "../class/IconManager";
import { tooltipStoreContext } from "../store/TooltipStore";

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
    showTooltip: () => Promise<void>;
    hideTooltip: () => void;
};

/**
 * Uses a tooltip displaying information of the specified type and name on the referenced element.
 * The result are the callbacks to actually open and close the tooltip.
 */
export function useTooltip(type: string, name: string, ref: RefObject<Element>): UseTooltipResult {
    const tooltipStore = useContext(tooltipStoreContext);

    return {
        showTooltip: useCallback(async (): Promise<void> => {
            await tooltipStore.showTooltip(ref, type, name);
        }, [type, name, ref]),
        hideTooltip: useCallback((): void => {
            tooltipStore.hideTooltip();
        }, []),
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
