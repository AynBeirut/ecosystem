import React from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; scope?: string }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(this.props.scope || "ErrorBoundary", error.message, { stack: error.stack, info });
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground break-words">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => { this.reset(); window.location.reload(); }}>
              Reload
            </Button>
            <Button onClick={() => { this.reset(); window.location.href = "/"; }}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
