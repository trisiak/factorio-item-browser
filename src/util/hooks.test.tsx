import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useLongPress } from "./hooks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type LongPressReturn = ReturnType<typeof useLongPress>;

/**
 * Renders the useLongPress hook into a detached container and exposes its latest return value.
 */
function renderLongPress(
    onLongPress: () => void,
    options?: { duration?: number; moveThreshold?: number },
): { result: { current: LongPressReturn }; unmount: () => void } {
    const result: { current: LongPressReturn } = { current: null as unknown as LongPressReturn };

    const TestComponent: React.FC = () => {
        result.current = useLongPress(onLongPress, options);
        return null;
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
        root.render(<TestComponent />);
    });

    return {
        result,
        unmount: () => {
            act(() => {
                root.unmount();
            });
        },
    };
}

function pointerEvent(overrides: Partial<{ pointerType: string; clientX: number; clientY: number }> = {}) {
    return {
        pointerType: "touch",
        clientX: 0,
        clientY: 0,
        ...overrides,
    } as unknown as React.PointerEvent;
}

function clickEvent() {
    return {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
    } as unknown as React.MouseEvent & { preventDefault: jest.Mock; stopPropagation: jest.Mock };
}

describe("useLongPress", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("fires the callback after the duration for a touch pointer", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent({ pointerType: "touch" }));
        });
        expect(onLongPress).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    test("fires the callback for a pen pointer", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent({ pointerType: "pen" }));
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    test("does not fire for a mouse pointer (hover keeps its own semantics)", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent({ pointerType: "mouse" }));
            jest.advanceTimersByTime(1000);
        });
        expect(onLongPress).not.toHaveBeenCalled();
    });

    test("is cancelled by pointer up before the duration elapses", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent());
            jest.advanceTimersByTime(300);
            result.current.onPointerUp(pointerEvent());
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).not.toHaveBeenCalled();
    });

    test("is cancelled when the pointer moves beyond the threshold", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500, moveThreshold: 10 });

        act(() => {
            result.current.onPointerDown(pointerEvent({ clientX: 0, clientY: 0 }));
            result.current.onPointerMove(pointerEvent({ clientX: 20, clientY: 0 }));
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).not.toHaveBeenCalled();
    });

    test("small movement within the threshold does not cancel", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500, moveThreshold: 10 });

        act(() => {
            result.current.onPointerDown(pointerEvent({ clientX: 0, clientY: 0 }));
            result.current.onPointerMove(pointerEvent({ clientX: 5, clientY: 5 }));
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    test("suppresses exactly the one click that follows a fired long-press", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent());
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).toHaveBeenCalledTimes(1);

        const suppressed = clickEvent();
        act(() => {
            result.current.onClickCapture(suppressed);
        });
        expect(suppressed.preventDefault).toHaveBeenCalledTimes(1);
        expect(suppressed.stopPropagation).toHaveBeenCalledTimes(1);

        // A subsequent click is no longer suppressed.
        const allowed = clickEvent();
        act(() => {
            result.current.onClickCapture(allowed);
        });
        expect(allowed.preventDefault).not.toHaveBeenCalled();
        expect(allowed.stopPropagation).not.toHaveBeenCalled();
    });

    test("does not suppress a click when the press was a short tap", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent());
            jest.advanceTimersByTime(200);
            result.current.onPointerUp(pointerEvent());
        });

        const click = clickEvent();
        act(() => {
            result.current.onClickCapture(click);
        });
        expect(click.preventDefault).not.toHaveBeenCalled();
        expect(click.stopPropagation).not.toHaveBeenCalled();
    });

    test("always suppresses the context menu", () => {
        const onLongPress = jest.fn();
        const { result } = renderLongPress(onLongPress);

        const event = clickEvent();
        act(() => {
            result.current.onContextMenu(event);
        });
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    test("clears a pending timer on unmount", () => {
        const onLongPress = jest.fn();
        const { result, unmount } = renderLongPress(onLongPress, { duration: 500 });

        act(() => {
            result.current.onPointerDown(pointerEvent());
        });
        unmount();
        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(onLongPress).not.toHaveBeenCalled();
    });
});
