import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  resetKey?: string | number;
  title?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? "This screen failed to load.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[screen-error-boundary]", error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40dvh] flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card px-5 py-6 text-center shadow-sm">
            <p className="text-base font-medium text-foreground">
              {this.props.title ?? "This page hit an error"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.errorMessage ?? "Try loading the screen again."}
            </p>
            <div className="mt-4">
              <Button onClick={this.handleRetry} className="h-10 rounded-full px-5">
                Try again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
