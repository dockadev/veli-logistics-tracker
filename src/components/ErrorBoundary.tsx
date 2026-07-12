import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error in sub-component:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="table-container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                    <div className="empty-row" style={{ border: 'none' }}>
                        <AlertOctagon size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--color-negative)', display: 'block' }} />
                        <h3>Component Error</h3>
                        <p style={{ maxWidth: '400px', margin: '0.5rem auto 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            An isolated error occurred while rendering this view: {this.state.error?.message}
                        </p>
                        <button
                            className="btn btn-secondary"
                            onClick={() => this.setState({ hasError: false, error: null })}
                            style={{ marginTop: '1.25rem' }}
                        >
                            Reset View
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
