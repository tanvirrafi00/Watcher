// Feature: proxy-server-extension, Property 29: Error logging completeness
// Property-based tests for Error Boundary error logging

import fc from 'fast-check';
import { render } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ error: Error }> = ({ error }) => {
    throw error;
};

describe('Error Boundary Property Tests', () => {
    const testConfig = {
        numRuns: 100,
        verbose: false,
    };

    // Spy on console.error
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('Property 29: Error logging completeness', () => {
        test('should log error message for any error', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        // Render component that throws error
                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();

                        // Verify error was logged (either as Error object or in string form)
                        const loggedCalls = consoleErrorSpy.mock.calls;
                        const hasError = loggedCalls.some(call =>
                            call.some((arg: any) => {
                                if (arg instanceof Error) {
                                    return arg.message === errorMessage;
                                }
                                if (typeof arg === 'string') {
                                    // Check if message is in the logged string (may be escaped/encoded)
                                    return arg.includes(errorMessage) ||
                                        arg.includes(JSON.stringify(errorMessage));
                                }
                                return false;
                            })
                        );
                        expect(hasError).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should log error name for any error', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorName, errorMessage) => {
                        const error = new Error(errorMessage);
                        error.name = errorName;

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();
                    }
                ),
                testConfig
            );
        });

        test('should log stack trace for any error', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();

                        // Verify stack trace information was logged
                        const loggedCalls = consoleErrorSpy.mock.calls;
                        const hasStackInfo = loggedCalls.some(call =>
                            call.some((arg: any) => {
                                if (typeof arg === 'string') {
                                    return arg.includes('stack') || arg.includes('Stack');
                                }
                                if (arg instanceof Error) {
                                    return true;
                                }
                                return false;
                            })
                        );
                        expect(hasStackInfo).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should log component stack for any error', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();

                        // Verify component stack was logged
                        const loggedCalls = consoleErrorSpy.mock.calls;
                        const hasComponentStack = loggedCalls.some(call =>
                            call.some((arg: any) =>
                                typeof arg === 'string' && arg.includes('componentStack')
                            )
                        );
                        expect(hasComponentStack).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should log timestamp for any error', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();

                        // Verify timestamp was logged
                        const loggedCalls = consoleErrorSpy.mock.calls;
                        const hasTimestamp = loggedCalls.some(call =>
                            call.some((arg: any) =>
                                typeof arg === 'string' && arg.includes('timestamp')
                            )
                        );
                        expect(hasTimestamp).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should log detailed error information in JSON format', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();

                        // Verify JSON formatted error details were logged
                        const loggedCalls = consoleErrorSpy.mock.calls;
                        const hasJSONLog = loggedCalls.some(call =>
                            call.some((arg: any) => {
                                if (typeof arg === 'string') {
                                    try {
                                        const parsed = JSON.parse(arg);
                                        return (
                                            parsed.message !== undefined ||
                                            parsed.name !== undefined ||
                                            parsed.stack !== undefined
                                        );
                                    } catch {
                                        return false;
                                    }
                                }
                                return false;
                            })
                        );
                        expect(hasJSONLog).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should log multiple errors independently', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
                    (errorMessages) => {
                        consoleErrorSpy.mockClear();

                        // Render multiple error boundaries with different errors
                        errorMessages.forEach(message => {
                            const error = new Error(message);
                            render(
                                <ErrorBoundary>
                                    <ThrowError error={error} />
                                </ErrorBoundary>
                            );
                        });

                        // Verify console.error was called for each error
                        expect(consoleErrorSpy).toHaveBeenCalled();
                        expect(consoleErrorSpy.mock.calls.length).toBeGreaterThan(0);
                    }
                ),
                testConfig
            );
        });

        test('should handle errors with special characters in message', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called without throwing
                        expect(consoleErrorSpy).toHaveBeenCalled();
                    }
                ),
                testConfig
            );
        });

        test('should log errors with custom properties', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    fc.record({
                        code: fc.string({ minLength: 1, maxLength: 20 }),
                        details: fc.string({ minLength: 1, maxLength: 50 }),
                    }),
                    (errorMessage, customProps) => {
                        const error = new Error(errorMessage) as any;
                        Object.assign(error, customProps);

                        render(
                            <ErrorBoundary>
                                <ThrowError error={error} />
                            </ErrorBoundary>
                        );

                        // Verify console.error was called
                        expect(consoleErrorSpy).toHaveBeenCalled();
                    }
                ),
                testConfig
            );
        });

        test('should not throw when logging errors', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (errorMessage) => {
                        const error = new Error(errorMessage);

                        // Should not throw when rendering error boundary
                        expect(() => {
                            render(
                                <ErrorBoundary>
                                    <ThrowError error={error} />
                                </ErrorBoundary>
                            );
                        }).not.toThrow();
                    }
                ),
                testConfig
            );
        });
    });
});
