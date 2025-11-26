// Request Interceptor for the Background Service Worker

import {
    RequestLogger,
    RuleEngine,
    TrafficModificationEngine,
    StorageManager,
    RequestDetails,
    generateId,
} from '../shared';

/**
 * Request Interceptor class for handling network requests
 */
export class RequestInterceptor {
    private requestLogger: RequestLogger;
    private ruleEngine: RuleEngine;
    private trafficModificationEngine: TrafficModificationEngine;
    private pendingRequests: Map<string, { id: string; startTime: number }>;

    constructor(
        requestLogger: RequestLogger,
        ruleEngine: RuleEngine,
        trafficModificationEngine: TrafficModificationEngine
    ) {
        this.requestLogger = requestLogger;
        this.ruleEngine = ruleEngine;
        this.trafficModificationEngine = trafficModificationEngine;
        this.pendingRequests = new Map();
    }

    /**
     * Get all logged requests
     */
    async getLogs() {
        return await this.requestLogger.getAllLogs();
    }

    /**
     * Initializes webRequest listeners
     */
    initialize(): void {
        // Listen for requests before they are sent
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                this.onBeforeRequest(details);
                return undefined;
            },
            { urls: ['<all_urls>'] },
            ['requestBody']
        );

        // Listen for request headers before sending
        chrome.webRequest.onBeforeSendHeaders.addListener(
            (details) => {
                this.onBeforeSendHeaders(details);
                return undefined;
            },
            { urls: ['<all_urls>'] },
            ['requestHeaders', 'extraHeaders']
        );

        // Listen for response headers
        chrome.webRequest.onHeadersReceived.addListener(
            (details) => {
                this.onHeadersReceived(details);
                return undefined;
            },
            { urls: ['<all_urls>'] },
            ['responseHeaders']
        );

        // Listen for completed requests
        chrome.webRequest.onCompleted.addListener(
            (details) => {
                this.onCompleted(details);
            },
            { urls: ['<all_urls>'] },
            ['responseHeaders']
        );

        // Listen for errors
        chrome.webRequest.onErrorOccurred.addListener(
            (details) => {
                this.onErrorOccurred(details);
            },
            { urls: ['<all_urls>'] }
        );

        console.log('RequestInterceptor: Initialized');
    }

    /**
     * Handles requests before they are sent
     */
    private async onBeforeRequest(
        details: chrome.webRequest.WebRequestBodyDetails
    ): Promise<chrome.webRequest.BlockingResponse | void> {
        try {
            const requestId = generateId();
            this.pendingRequests.set(details.requestId, {
                id: requestId,
                startTime: details.timeStamp,
            });

            // Create request details
            const requestDetails: RequestDetails = {
                requestId: details.requestId,
                url: details.url,
                method: details.method,
                tabId: details.tabId,
                type: details.type,
                timeStamp: details.timeStamp,
                initiator: details.initiator,
                frameId: details.frameId,
                parentFrameId: details.parentFrameId,
            };

            // Evaluate rules
            const matchingRules = await this.ruleEngine.evaluateRequest(requestDetails);

            if (matchingRules.length === 0) {
                // No rules match, just log the request
                await this.requestLogger.logRequest({
                    tabId: details.tabId,
                    url: details.url,
                    method: details.method,
                    requestHeaders: {},
                    requestBody: this.extractRequestBody(details.requestBody || undefined),
                    timing: { startTime: details.timeStamp },
                    type: details.type,
                    initiator: details.initiator,
                    modified: false,
                });
                return;
            }

            // Apply modifications
            const actions = matchingRules.flatMap(rule => rule.actions);

            // Check if request should be blocked
            if (this.trafficModificationEngine.shouldBlockRequest(actions)) {
                await this.requestLogger.logRequest({
                    tabId: details.tabId,
                    url: details.url,
                    method: details.method,
                    requestHeaders: {},
                    timing: { startTime: details.timeStamp },
                    type: details.type,
                    modified: true,
                    appliedRules: matchingRules.map(r => r.id),
                });
                return { cancel: true };
            }

            // Check for redirect
            const redirectUrl = this.trafficModificationEngine.getRedirectUrl(actions);
            if (redirectUrl) {
                await this.requestLogger.logRequest({
                    tabId: details.tabId,
                    url: details.url,
                    method: details.method,
                    requestHeaders: {},
                    timing: { startTime: details.timeStamp },
                    type: details.type,
                    modified: true,
                    appliedRules: matchingRules.map(r => r.id),
                });
                return { redirectUrl };
            }

            // Log request with modifications
            await this.requestLogger.logRequest({
                tabId: details.tabId,
                url: details.url,
                method: details.method,
                requestHeaders: {},
                requestBody: this.extractRequestBody(details.requestBody || undefined),
                timing: { startTime: details.timeStamp },
                type: details.type,
                modified: matchingRules.length > 0,
                appliedRules: matchingRules.map(r => r.id),
            });
        } catch (error) {
            console.error('RequestInterceptor: Error in onBeforeRequest', error);
        }
    }

    /**
     * Handles request headers before sending
     */
    private async onBeforeSendHeaders(
        details: chrome.webRequest.WebRequestHeadersDetails
    ): Promise<chrome.webRequest.BlockingResponse | void> {
        try {
            const requestDetails: RequestDetails = {
                requestId: details.requestId,
                url: details.url,
                method: details.method,
                tabId: details.tabId,
                type: details.type,
                timeStamp: details.timeStamp,
                frameId: details.frameId,
                parentFrameId: details.parentFrameId,
            };

            const matchingRules = await this.ruleEngine.evaluateRequest(requestDetails);

            if (matchingRules.length === 0) {
                return;
            }

            const actions = matchingRules.flatMap(rule => rule.actions);
            const modifiedHeaders = this.trafficModificationEngine.modifyRequestHeaders(
                details.requestHeaders || [],
                actions
            );

            if (modifiedHeaders.length !== (details.requestHeaders || []).length ||
                JSON.stringify(modifiedHeaders) !== JSON.stringify(details.requestHeaders)) {
                return { requestHeaders: modifiedHeaders };
            }
        } catch (error) {
            console.error('RequestInterceptor: Error in onBeforeSendHeaders', error);
        }
    }

    /**
     * Handles response headers
     */
    private async onHeadersReceived(
        details: chrome.webRequest.WebResponseHeadersDetails
    ): Promise<chrome.webRequest.BlockingResponse | void> {
        try {
            const requestDetails: RequestDetails = {
                requestId: details.requestId,
                url: details.url,
                method: details.method,
                tabId: details.tabId,
                type: details.type,
                timeStamp: details.timeStamp,
                frameId: details.frameId,
                parentFrameId: details.parentFrameId,
            };

            const matchingRules = await this.ruleEngine.evaluateRequest(requestDetails);

            if (matchingRules.length === 0) {
                return;
            }

            const actions = matchingRules.flatMap(rule => rule.actions);
            const modifiedHeaders = this.trafficModificationEngine.modifyResponseHeaders(
                details.responseHeaders || [],
                actions
            );

            if (modifiedHeaders.length !== (details.responseHeaders || []).length ||
                JSON.stringify(modifiedHeaders) !== JSON.stringify(details.responseHeaders)) {
                return { responseHeaders: modifiedHeaders };
            }
        } catch (error) {
            console.error('RequestInterceptor: Error in onHeadersReceived', error);
        }
    }

    /**
     * Handles completed requests
     */
    private async onCompleted(details: chrome.webRequest.WebResponseCacheDetails): Promise<void> {
        try {
            const pending = this.pendingRequests.get(details.requestId);
            if (!pending) {
                return;
            }

            const logs = await this.requestLogger.getAllLogs();
            const log = logs.find(l =>
                l.url === details.url &&
                l.timing.startTime === pending.startTime
            );

            if (log) {
                await this.requestLogger.updateRequestWithResponse(log.id, {
                    responseStatus: details.statusCode,
                    responseHeaders: this.headersToObject(details.responseHeaders || []),
                    timing: {
                        startTime: pending.startTime,
                        endTime: details.timeStamp,
                        duration: details.timeStamp - pending.startTime,
                    },
                });
            }

            this.pendingRequests.delete(details.requestId);
        } catch (error) {
            console.error('RequestInterceptor: Error in onCompleted', error);
        }
    }

    /**
     * Handles request errors
     */
    private async onErrorOccurred(details: chrome.webRequest.WebResponseErrorDetails): Promise<void> {
        try {
            const pending = this.pendingRequests.get(details.requestId);
            if (!pending) {
                return;
            }

            await this.requestLogger.logRequest({
                tabId: details.tabId,
                url: details.url,
                method: details.method,
                requestHeaders: {},
                timing: { startTime: pending.startTime, endTime: details.timeStamp },
                type: details.type,
                error: details.error,
                modified: false,
            });

            this.pendingRequests.delete(details.requestId);
        } catch (error) {
            console.error('RequestInterceptor: Error in onErrorOccurred', error);
        }
    }

    /**
     * Extracts request body as string
     */
    private extractRequestBody(requestBody?: chrome.webRequest.WebRequestBody): string | undefined {
        if (!requestBody) return undefined;

        if (requestBody.formData) {
            return JSON.stringify(requestBody.formData);
        }

        if (requestBody.raw) {
            const decoder = new TextDecoder();
            const parts = requestBody.raw.map(part =>
                part.bytes ? decoder.decode(part.bytes) : ''
            );
            return parts.join('');
        }

        return undefined;
    }

    /**
     * Converts headers array to object
     */
    private headersToObject(headers: chrome.webRequest.HttpHeader[]): Record<string, string> {
        const result: Record<string, string> = {};
        headers.forEach(header => {
            if (header.name && header.value) {
                result[header.name] = header.value;
            }
        });
        return result;
    }
}

// Create and export singleton instance
const storageManager = new StorageManager();
const requestLogger = new RequestLogger(storageManager);
const ruleEngine = new RuleEngine(storageManager);
const trafficModificationEngine = new TrafficModificationEngine();

export const requestInterceptor = new RequestInterceptor(
    requestLogger,
    ruleEngine,
    trafficModificationEngine
);
