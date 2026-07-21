import { Component, ContextType, ReactNode } from "react";
import { RenderError } from "../../error/page";
import { errorStoreContext } from "../../store/ErrorStore";

type Props = {
    children: ReactNode;
};

/**
 * The error boundary of everything. If any component fails, then the boundary will replace the page with a nice error
 * box.
 */
class ErrorBoundary extends Component<Props> {
    public static contextType = errorStoreContext;
    declare public context: ContextType<typeof errorStoreContext>;

    public componentDidCatch(error: Error): void {
        this.context.handleError(new RenderError(error.message));
    }

    public render(): ReactNode {
        return this.props.children;
    }
}

export default ErrorBoundary;
