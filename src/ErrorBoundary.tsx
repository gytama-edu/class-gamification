import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="min-h-screen bg-mission-bg flex items-center justify-center p-4">
          <div className="bg-mission-panel border border-mission-danger/50 p-8 rounded-2xl max-w-lg w-full text-center">
            <h1 className="text-2xl font-bold text-mission-danger mb-4">
              The application could not be displayed.
            </h1>
            <p className="text-mission-secondary-text mb-6">
              A critical error occurred while rendering the interface.
            </p>
            {isDev && (
              <div className="bg-black/50 p-4 rounded-lg mb-6 text-left overflow-auto text-sm text-red-400 font-mono">
                {this.state.error?.message}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-mission-danger hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
