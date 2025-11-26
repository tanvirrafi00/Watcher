// Feature: proxy-server-extension, Property 26: Data clearing completeness
// Feature: proxy-server-extension, Property 27: Retention policy enforcement
// Property-based tests for Request Logger

import fc from 'fast-check';
import { RequestLogger } from '../RequestLogger';
import { StorageManager } from '../StorageManager';

// Declare global chrome for tests
declare const global: typeof globalThis & {
    chrome: typeof chrome;
};

describe('Request Logger Property Tests', () => {
    const testConfig = {
        numRuns: 10,
        verbose: false,
    };

    let requestLogger: RequestLogger;
    let storageManager: StorageManager;
    const mockStorage: Map<string, any> = new Map();

    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage.clear();
        storageManager = new StorageManager();
        requestLogger = new RequestLogger(storageManager);

        // Mock chrome.storage.local
        (global.chrome.storage.local.set as jest.Mock).mockImplementation((items: Record<string, any>) => {
            Object.entries(items).forEach(([key, value]) => {
                mockStorage.set(key, value);
            });
            return Promise.resolve();
        });

        (global.chrome.storage.local.get as jest.Mock).mockImplementation((keys: string | string[] | null) => {
            if (keys === null) {
                const result: Record<string, any> = {};
                mockStorage.forEach((value, key) => {
                    result[key] = value;
                });
                return Promise.resolve(result);
            }

            const keyArray = typeof keys === 'string' ? [keys] : keys;
            const result: Record<string, any> = {};
            keyArray.forEach((key) => {
                if (mockStorage.has(key)) {
                    result[key] = mockStorage.get(key);
                }
            });
            return Promise.resolve(result);
        });

        (global.chrome.storage.local.remove as jest.Mock).mockImplementation((keys: string | string[]) => {
            const keyArray = typeof keys === 'string' ? [keys] : keys;
            keyArray.forEach((key) => {
                mockStorage.delete(key);
            });
            return Promise.resolve();
        });

        (global.chrome.storage.local.clear as jest.Mock).mockImplementation(() => {
            mockStorage.clear();
            return Promise.resolve();
        });

        (global.chrome.storage.local.getBytesInUse as jest.Mock).mockImplementation(() => {
            return Promise.resolve(0);
        });
    });

    describe('Property 26: Data clearing completeness', () => {
        test('should clear all logs when clearLogs is called without tabId', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            tabId: fc.integer({ min: 1, max: 100 }),
                            url: fc.webUrl(),
                            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
                        }),
                        { minLength: 1, maxLength: 20 }
                    ),
                    async (requests) => {
                        mockStorage.clear();

                        // Log all requests
                        for (const req of requests) {
                            await requestLogger.logRequest({
                                tabId: req.tabId,
                                url: req.url,
                                method: req.method,
                                requestHeaders: {},
                                timing: { startTime: Date.now() },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        // Verify logs exist
                        const logsBefore = await requestLogger.getAllLogs();
                        expect(logsBefore.length).toBeGreaterThan(0);

                        // Clear all logs
                        await requestLogger.clearLogs();

                        // Verify all logs are cleared
                        const logsAfter = await requestLogger.getAllLogs();
                        expect(logsAfter).toEqual([]);
                    }
                ),
                testConfig
            );
        });

        test('should clear only logs for specific tab when tabId is provided', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 10 }),
                    fc.array(
                        fc.record({
                            url: fc.webUrl(),
                            method: fc.constantFrom('GET', 'POST'),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    fc.array(
                        fc.record({
                            url: fc.webUrl(),
                            method: fc.constantFrom('GET', 'POST'),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (targetTabId, targetTabRequests, otherTabRequests) => {
                        mockStorage.clear();
                        const otherTabId = targetTabId + 1;

                        // Log requests for target tab
                        for (const req of targetTabRequests) {
                            await requestLogger.logRequest({
                                tabId: targetTabId,
                                url: req.url,
                                method: req.method,
                                requestHeaders: {},
                                timing: { startTime: Date.now() },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        // Log requests for other tab
                        for (const req of otherTabRequests) {
                            await requestLogger.logRequest({
                                tabId: otherTabId,
                                url: req.url,
                                method: req.method,
                                requestHeaders: {},
                                timing: { startTime: Date.now() },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        // Clear logs for target tab
                        await requestLogger.clearLogs(targetTabId);

                        // Verify target tab logs are cleared
                        const targetTabLogs = await requestLogger.getLogsForTab(targetTabId);
                        expect(targetTabLogs).toEqual([]);

                        // Verify other tab logs remain
                        const otherTabLogs = await requestLogger.getLogsForTab(otherTabId);
                        expect(otherTabLogs.length).toBe(otherTabRequests.length);
                    }
                ),
                testConfig
            );
        });

        test('should handle clearing logs when no logs exist', async () => {
            mockStorage.clear();

            // Clear all logs (should not throw)
            await requestLogger.clearLogs();

            // Verify no logs exist
            const logs = await requestLogger.getAllLogs();
            expect(logs).toEqual([]);

            // Clear logs for specific tab (should not throw)
            await requestLogger.clearLogs(1);

            // Verify no logs exist
            const logs2 = await requestLogger.getAllLogs();
            expect(logs2).toEqual([]);
        });
    });

    describe('Property 27: Retention policy enforcement', () => {
        test('should remove logs older than retention period', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }),
                    fc.integer({ min: 1, max: 5 }),
                    fc.integer({ min: 1, max: 5 }),
                    async (retentionDays, oldLogsCount, recentLogsCount) => {
                        // Clear mock storage
                        mockStorage.clear();
                        // Use current time as reference
                        const now = Date.now();
                        // Make old logs clearly older than retention period (add 1 day buffer)
                        const oldTimestamp = now - (retentionDays + 1) * 24 * 60 * 60 * 1000;
                        // Make recent logs clearly within retention period
                        // Subtract at least 1 hour to ensure we're safely within bounds, even for retentionDays=1
                        const recentTimestamp = now - 60 * 60 * 1000; // 1 hour ago

                        // Log old requests
                        for (let i = 0; i < oldLogsCount; i++) {
                            await requestLogger.logRequest({
                                tabId: 1,
                                url: `https://old.example.com/${i}`,
                                method: 'GET',
                                requestHeaders: {},
                                timing: { startTime: oldTimestamp },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        // Log recent requests
                        for (let i = 0; i < recentLogsCount; i++) {
                            await requestLogger.logRequest({
                                tabId: 1,
                                url: `https://recent.example.com/${i}`,
                                method: 'GET',
                                requestHeaders: {},
                                timing: { startTime: recentTimestamp },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        // Clean old data
                        await requestLogger.cleanOldData(retentionDays);

                        // Verify only recent logs remain
                        const logs = await requestLogger.getAllLogs();
                        expect(logs.length).toBe(recentLogsCount);
                        // Verify all remaining logs are the recent ones (not the old ones)
                        expect(logs.every(log => log.url.includes('recent.example.com'))).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should keep all logs when all are within retention period', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 7, max: 30 }),
                    fc.array(
                        fc.record({
                            url: fc.webUrl(),
                            daysAgo: fc.integer({ min: 0, max: 6 }),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (retentionDays, requests) => {
                        // Clear mock storage
                        mockStorage.clear();
                        // Use a fixed timestamp to avoid timing issues during test execution
                        const now = Date.now();

                        // Log requests within retention period
                        // Add 1 hour buffer to ensure logs are clearly within retention period
                        for (const req of requests) {
                            await requestLogger.logRequest({
                                tabId: 1,
                                url: req.url,
                                method: 'GET',
                                requestHeaders: {},
                                // Subtract daysAgo but add 1 hour to ensure we're safely within retention
                                timing: { startTime: now - req.daysAgo * 24 * 60 * 60 * 1000 + 60 * 60 * 1000 },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        const logsBefore = await requestLogger.getAllLogs();
                        const countBefore = logsBefore.length;

                        // Clean old data using the same reference time
                        await requestLogger.cleanOldData(retentionDays);

                        // Verify all logs remain
                        const logsAfter = await requestLogger.getAllLogs();
                        expect(logsAfter.length).toBe(countBefore);
                    }
                ),
                testConfig
            );
        });
    });

    describe('Request Logger Core Functionality', () => {
        test('should log and retrieve requests', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.record({
                        tabId: fc.integer({ min: 1, max: 100 }),
                        url: fc.webUrl(),
                        method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
                    }),
                    async (request) => {
                        mockStorage.clear();

                        const id = await requestLogger.logRequest({
                            tabId: request.tabId,
                            url: request.url,
                            method: request.method,
                            requestHeaders: {},
                            timing: { startTime: Date.now() },
                            type: 'xmlhttprequest',
                            modified: false,
                        });

                        expect(id).toBeDefined();
                        expect(typeof id).toBe('string');

                        const log = await requestLogger.getLogById(id);
                        expect(log).not.toBeNull();
                        expect(log?.url).toBe(request.url);
                        expect(log?.method).toBe(request.method);
                        expect(log?.tabId).toBe(request.tabId);
                    }
                ),
                testConfig
            );
        });

        test('should update request with response data', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.webUrl(),
                    fc.integer({ min: 100, max: 599 }),
                    async (url, status) => {
                        mockStorage.clear();

                        const id = await requestLogger.logRequest({
                            tabId: 1,
                            url,
                            method: 'GET',
                            requestHeaders: {},
                            timing: { startTime: Date.now() },
                            type: 'xmlhttprequest',
                            modified: false,
                        });

                        await requestLogger.updateRequestWithResponse(id, {
                            responseStatus: status,
                            responseHeaders: { 'content-type': 'application/json' },
                            timing: { startTime: Date.now() - 100, endTime: Date.now() },
                        });

                        const log = await requestLogger.getLogById(id);
                        expect(log?.responseStatus).toBe(status);
                        expect(log?.timing.duration).toBeDefined();
                    }
                ),
                testConfig
            );
        });

        test('should filter logs by tab', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 10 }),
                    fc.integer({ min: 1, max: 5 }),
                    async (targetTabId, logsCount) => {
                        mockStorage.clear();
                        const otherTabId = targetTabId + 1;

                        // Log requests for target tab
                        for (let i = 0; i < logsCount; i++) {
                            await requestLogger.logRequest({
                                tabId: targetTabId,
                                url: `https://example.com/${i}`,
                                method: 'GET',
                                requestHeaders: {},
                                timing: { startTime: Date.now() },
                                type: 'xmlhttprequest',
                                modified: false,
                            });
                        }

                        // Log requests for other tab
                        await requestLogger.logRequest({
                            tabId: otherTabId,
                            url: 'https://other.com',
                            method: 'GET',
                            requestHeaders: {},
                            timing: { startTime: Date.now() },
                            type: 'xmlhttprequest',
                            modified: false,
                        });

                        const targetTabLogs = await requestLogger.getLogsForTab(targetTabId);
                        expect(targetTabLogs.length).toBe(logsCount);
                        expect(targetTabLogs.every(log => log.tabId === targetTabId)).toBe(true);
                    }
                ),
                testConfig
            );
        });
    });
});
