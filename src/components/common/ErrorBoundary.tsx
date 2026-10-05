import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken page never takes down the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Kiran Planner error:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
        <h2 className="text-lg font-semibold">Something went wrong on this page</h2>
        <p className="mt-1 text-sm">Your data is safe. Try again, or go to another page.</p>
        <p className="mt-2 break-words font-mono text-xs opacity-80">{this.state.error.message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="min-h-touch rounded-xl bg-red-600 px-4 font-medium text-white"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <a href="#/" className="inline-flex min-h-touch items-center rounded-xl px-4 font-medium underline">
            Go to Today
          </a>
        </div>
      </div>
    );
  }
}
