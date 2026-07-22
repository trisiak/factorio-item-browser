import { faChevronDown, faChevronUp, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React, { FC, useCallback, useContext, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { tooltipStoreContext } from "../../store/TooltipStore";
import { useVisualViewportBounds } from "../../util/hooks";
import Entity from "../entity/Entity";

import "./Tooltip.scss";

const MARGIN_CHEVRON = 8;
const MARGIN_VIEWPORT = 8;

type Position = {
    top: number;
    left: number;
    isChevronAbove: boolean;
    isChevronRight: boolean;
};

function calculatePosition(target: Element, content: Element, chevron: Element): Position {
    const contentRect = content.getBoundingClientRect();
    const chevronRect = chevron.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    let isChevronAbove = false;
    let isChevronRight = false;

    let top = targetRect.top + window.scrollY + targetRect.height + chevronRect.height;
    if (top + contentRect.height + chevronRect.height > window.scrollY + window.innerHeight) {
        // Tooltip would be offscreen at the bottom, so place it above the target.
        top = targetRect.top + window.scrollY - contentRect.height - chevronRect.height;
        isChevronAbove = true;
    }

    const targetCenter = targetRect.left + window.scrollX + targetRect.width / 2;
    let left = targetCenter - chevronRect.width / 2 - MARGIN_CHEVRON;
    if (left + contentRect.width > window.scrollX + window.innerWidth - MARGIN_VIEWPORT) {
        // Tooltip would be offscreen at the right, so shift it to the left.
        left = targetCenter + chevronRect.width / 2 + MARGIN_CHEVRON - contentRect.width;
        isChevronRight = true;
    }

    // Whatever side was chosen, never leave the viewport horizontally: on narrow screens neither
    // orientation may fit, so clamp into the visible area (preferring the left edge when the
    // tooltip is wider than the viewport itself).
    const minLeft = window.scrollX + MARGIN_VIEWPORT;
    const maxLeft = window.scrollX + window.innerWidth - contentRect.width - MARGIN_VIEWPORT;
    left = Math.min(Math.max(left, minLeft), Math.max(maxLeft, minLeft));

    return {
        top,
        left,
        isChevronAbove,
        isChevronRight,
    };
}

/**
 * The component representing the tooltip, in both of its presentations: anchored next to its target
 * element (mouse hover, keyboard focus), or as a bottom drawer with a backdrop (touch long-press).
 * The drawer keeps its content interactive, so the entity links inside it can actually be followed.
 */
const Tooltip: FC = () => {
    const { t } = useTranslation();
    const tooltipStore = useContext(tooltipStoreContext);

    const chevronRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    const doRender = tooltipStore.isTooltipAvailable;
    const isDrawer = tooltipStore.mode === "drawer";

    const handleClose = useCallback((): void => {
        tooltipStore.hideTooltip();
    }, []);

    // The drawer is anchored to the bottom of the visual viewport (not the layout viewport),
    // so mobile browser chrome such as Firefox's bottom URL bar can no longer occlude it.
    useVisualViewportBounds(drawerRef, doRender && isDrawer);

    // While a tooltip is shown, tapping/clicking outside of it (and outside its target icon)
    // dismisses it, and so does the Escape key — the touch/keyboard equivalent of moving the
    // mouse away, which long-press and focus tooltips otherwise lack. The drawer is excluded
    // from the pointerdown path on purpose: dismissing it on pointerdown would unmount it before
    // the browser resolves the tap's click, which then falls through to the link beneath (an
    // unwanted navigation on Firefox/Safari). The drawer instead dismisses on its backdrop's
    // click (see below), so the click is resolved against — and consumed by — the still-present
    // backdrop. Escape still applies to both presentations.
    useEffect((): void | (() => void) => {
        if (!doRender) {
            return;
        }

        const handlePointerDown = (event: PointerEvent): void => {
            if (isDrawer) {
                return;
            }
            const node = event.target as Node | null;
            const tooltip = tooltipRef.current;
            const target = tooltipStore.fetchedTarget?.current ?? null;
            if (node && ((tooltip && tooltip.contains(node)) || (target && target.contains(node)))) {
                return;
            }
            tooltipStore.hideTooltip();
        };
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                tooltipStore.hideTooltip();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return (): void => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [doRender, isDrawer]);

    useLayoutEffect((): void => {
        if (!doRender || isDrawer || !tooltipStore.fetchedTarget) {
            return;
        }

        const target = tooltipStore.fetchedTarget.current;
        const tooltip = tooltipRef.current;
        const content = contentRef.current;
        const chevron = chevronRef.current;

        if (!target || !tooltip || !content || !chevron) {
            return;
        }

        const { top, left, isChevronAbove, isChevronRight } = calculatePosition(target, content, chevron);

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        chevron.classList.toggle("bottom", isChevronAbove);
        chevron.classList.toggle("right", isChevronRight);
    });

    if (!doRender || !tooltipStore.fetchedData) {
        return null;
    }

    if (isDrawer) {
        return (
            <div className="tooltip-drawer" ref={drawerRef}>
                {/* Dismiss on click, not pointerdown: the click is resolved against the DOM as it
                    stands when the tap completes, so it lands on (and is consumed by) this backdrop
                    instead of falling through to a link beneath it. `cursor: pointer` is what makes
                    Safari synthesize the click on this non-interactive div. */}
                <div className="backdrop" onClick={handleClose} />
                <div
                    className="sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-label={tooltipStore.fetchedData.label}
                    ref={tooltipRef}
                >
                    <button type="button" className="close" aria-label={t("tooltip.close")} onClick={handleClose}>
                        <FontAwesomeIcon icon={faTimes} aria-hidden />
                    </button>
                    <Entity entity={tooltipStore.fetchedData} ref={contentRef} />
                </div>
            </div>
        );
    }

    return (
        <div className="tooltip" ref={tooltipRef}>
            <div className="chevron" ref={chevronRef}>
                <FontAwesomeIcon icon={faChevronUp} />
                <FontAwesomeIcon icon={faChevronDown} />
            </div>
            <Entity entity={tooltipStore.fetchedData} ref={contentRef} />
        </div>
    );
};

export default observer(Tooltip);
