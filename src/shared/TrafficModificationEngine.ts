// Traffic Modification Engine for applying modifications to requests and responses

import { RuleAction } from './types';

/**
 * Traffic Modification Engine class for applying modifications
 */
export class TrafficModificationEngine {
    private readonly MAX_DELAY_MS = 30000; // 30 seconds max delay
    private readonly TIMEOUT_MS = 5000; // 5 second timeout for modifications

    /**
     * Modifies request headers based on actions
     */
    modifyRequestHeaders(
        headers: chrome.webRequest.HttpHeader[],
        actions: RuleAction[]
    ): chrome.webRequest.HttpHeader[] {
        let modifiedHeaders = [...headers];

        for (const action of actions) {
            if (action.type === 'modifyHeaders' && action.config.headers) {
                for (const headerMod of action.config.headers) {
                    switch (headerMod.operation) {
                        case 'add':
                        case 'set':
                            // Remove existing header if setting
                            if (headerMod.operation === 'set') {
                                modifiedHeaders = modifiedHeaders.filter(
                                    h => h.name.toLowerCase() !== headerMod.name.toLowerCase()
                                );
                            }
                            // Add new header
                            modifiedHeaders.push({
                                name: headerMod.name,
                                value: headerMod.value || '',
                            });
                            break;

                        case 'remove':
                            modifiedHeaders = modifiedHeaders.filter(
                                h => h.name.toLowerCase() !== headerMod.name.toLowerCase()
                            );
                            break;
                    }
                }
            }
        }

        return modifiedHeaders;
    }

    /**
     * Modifies response headers based on actions
     */
    modifyResponseHeaders(
        headers: chrome.webRequest.HttpHeader[],
        actions: RuleAction[]
    ): chrome.webRequest.HttpHeader[] {
        // Same logic as request headers
        return this.modifyRequestHeaders(headers, actions);
    }

    /**
     * Creates a redirect response
     */
    createRedirect(_url: string, action: RuleAction): chrome.webRequest.BlockingResponse {
        if (action.type !== 'redirect' || !action.config.redirectUrl) {
            throw new Error('Invalid redirect action');
        }

        return {
            redirectUrl: action.config.redirectUrl,
        };
    }

    /**
     * Creates a mock response
     */
    async createMockResponse(action: RuleAction): Promise<Response> {
        if (action.type !== 'mock' || !action.config.mockResponse) {
            throw new Error('Invalid mock action');
        }

        const { status, headers, body } = action.config.mockResponse;

        // Apply delay if specified
        if (action.config.delayMs) {
            await this.applyDelay(action.config.delayMs);
        }

        return new Response(body, {
            status,
            headers,
        });
    }

    /**
     * Applies a delay
     */
    async applyDelay(duration: number): Promise<void> {
        if (duration < 0) {
            throw new Error('Delay duration must be positive');
        }

        if (duration > this.MAX_DELAY_MS) {
            throw new Error(`Delay cannot exceed ${this.MAX_DELAY_MS}ms`);
        }

        return new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Applies modifications with timeout
     */
    async applyModificationsWithTimeout<T>(
        modificationFn: () => Promise<T>
    ): Promise<T> {
        return Promise.race([
            modificationFn(),
            new Promise<T>((_, reject) =>
                setTimeout(
                    () => reject(new Error('Modification timeout exceeded')),
                    this.TIMEOUT_MS
                )
            ),
        ]);
    }

    /**
     * Checks if action should block the request
     */
    shouldBlockRequest(actions: RuleAction[]): boolean {
        return actions.some(action => action.type === 'block');
    }

    /**
     * Gets redirect URL from actions
     */
    getRedirectUrl(actions: RuleAction[]): string | null {
        const redirectAction = actions.find(action => action.type === 'redirect');
        return redirectAction?.config.redirectUrl || null;
    }

    /**
     * Gets mock response from actions
     */
    getMockResponse(actions: RuleAction[]): RuleAction['config']['mockResponse'] | null {
        const mockAction = actions.find(action => action.type === 'mock');
        return mockAction?.config.mockResponse || null;
    }

    /**
     * Gets total delay from actions
     */
    getTotalDelay(actions: RuleAction[]): number {
        return actions
            .filter(action => action.type === 'delay')
            .reduce((total, action) => total + (action.config.delayMs || 0), 0);
    }

    /**
     * Validates action configuration
     */
    validateAction(action: RuleAction): { valid: boolean; error?: string } {
        try {
            switch (action.type) {
                case 'modifyHeaders':
                    if (!action.config.headers || action.config.headers.length === 0) {
                        return { valid: false, error: 'Headers array is required' };
                    }
                    break;

                case 'redirect':
                    if (!action.config.redirectUrl) {
                        return { valid: false, error: 'Redirect URL is required' };
                    }
                    try {
                        new URL(action.config.redirectUrl);
                    } catch {
                        return { valid: false, error: 'Invalid redirect URL' };
                    }
                    break;

                case 'mock':
                    if (!action.config.mockResponse) {
                        return { valid: false, error: 'Mock response is required' };
                    }
                    const { status } = action.config.mockResponse;
                    if (status < 100 || status > 599) {
                        return { valid: false, error: 'Invalid status code' };
                    }
                    break;

                case 'delay':
                    if (!action.config.delayMs || action.config.delayMs < 0) {
                        return { valid: false, error: 'Delay must be positive' };
                    }
                    if (action.config.delayMs > this.MAX_DELAY_MS) {
                        return { valid: false, error: `Delay cannot exceed ${this.MAX_DELAY_MS}ms` };
                    }
                    break;

                case 'block':
                    // No validation needed for block
                    break;

                default:
                    return { valid: false, error: 'Unknown action type' };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Validation error',
            };
        }
    }

    /**
     * Applies all modifications from actions
     */
    async applyModifications(
        actions: RuleAction[],
        requestHeaders?: chrome.webRequest.HttpHeader[],
        responseHeaders?: chrome.webRequest.HttpHeader[]
    ): Promise<{
        modifiedRequestHeaders?: chrome.webRequest.HttpHeader[];
        modifiedResponseHeaders?: chrome.webRequest.HttpHeader[];
        shouldBlock: boolean;
        redirectUrl?: string;
        delay: number;
    }> {
        try {
            const result = {
                shouldBlock: this.shouldBlockRequest(actions),
                redirectUrl: this.getRedirectUrl(actions) || undefined,
                delay: this.getTotalDelay(actions),
                modifiedRequestHeaders: requestHeaders
                    ? this.modifyRequestHeaders(requestHeaders, actions)
                    : undefined,
                modifiedResponseHeaders: responseHeaders
                    ? this.modifyResponseHeaders(responseHeaders, actions)
                    : undefined,
            };

            return result;
        } catch (error) {
            console.error('TrafficModificationEngine: Failed to apply modifications', error);
            throw error;
        }
    }
}

// Export singleton instance
export const trafficModificationEngine = new TrafficModificationEngine();
