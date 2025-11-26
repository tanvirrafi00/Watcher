import { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to extension console
        console.error('Error caught by ErrorBoundary:', error);
        console.error('Error info:', errorInfo);
        console.error('Component stack:', errorInfo.componentStack);

        // Log detailed error information
        this.logErrorToConsole(error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });
    }

    logErrorToConsole(error: Error, errorInfo: ErrorInfo): void {
        const errorDetails = {
            message: error.message,
            name: error.name,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
        };

        console.error('[Extension Error]', JSON.stringify(errorDetails, null, 2));
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="error-boundary-fallback">
                    <div className="error-boundary-content">
                        <h2>⚠️ Something went wrong</h2>
                        <p className="error-message">
                            The extension encountered an unexpected error. Please try reloading.
                        </p>
                        {this.state.error && (
                            <details className="error-details">
                                <summary>Error Details</summary>
                                <pre className="error-stack">
                                    <strong>Error:</strong> {this.state.error.message}
                                    {'\n\n'}
                                    <strong>Stack:</strong>
                                    {'\n'}
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                        <div className="error-actions">
                            <button className="error-btn primary" onClick={this.handleReset}>
                                Try Again
                            </button>
                            <button
                                className="error-btn secondary"
                                onClick={() => window.location.reload()}
                            >
                                Reload Extension
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
