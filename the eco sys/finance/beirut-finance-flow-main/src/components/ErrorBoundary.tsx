import React from "react";
import { logError } from "@/lib/logger";
import { isFinanceInAppShell } from "@/lib/playStoreNavScope";

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
            <button
              className="px-4 py-2 text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              onClick={() => { this.reset(); window.location.reload(); }}
            >
              Reload
            </button>
            <button
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => { this.reset(); const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, ''); window.location.href = isFinanceInAppShell() ? `${base}/invoices` : `${base}/`; }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
