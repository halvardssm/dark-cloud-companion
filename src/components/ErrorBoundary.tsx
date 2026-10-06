import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Short name of the page section, shown in the message. */
  label: string;
  /** Optional extra recovery action (e.g. clearing remembered inputs). */
  recover?: { label: string; run: () => void };
}

/** Shows what went wrong instead of a blank page when an island throws while rendering. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        className="border-destructive/50 flex flex-col gap-3 rounded-md border p-4 text-sm"
      >
        <p className="text-destructive font-medium">Something went wrong in {this.props.label}.</p>
        <pre className="text-muted-foreground max-h-40 overflow-auto text-xs whitespace-pre-wrap">
          {String(error.stack ?? error.message).slice(0, 1200)}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-1.5"
            onClick={() => location.reload()}
          >
            Reload
          </button>
          {this.props.recover && (
            <button
              type="button"
              className="rounded-md border px-3 py-1.5"
              onClick={() => {
                this.props.recover!.run();
                this.setState({ error: null });
              }}
            >
              {this.props.recover.label}
            </button>
          )}
        </div>
      </div>
    );
  }
}
