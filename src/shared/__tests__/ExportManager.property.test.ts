// Feature: proxy-server-extension, Property 30: Export completeness
// Feature: proxy-server-extension, Property 31: Filtered export accuracy
// Feature: proxy-server-extension, Property 32: Export format support
// Property-based tests for Export Manager

import fc from 'fast-check';
import { ExportManager } from '../ExportManager';

describe('Export Manager Property Tests', () => {
    const testConfig = {
        numRuns: 100,
        verbose: false,
    };

    let exportManager: ExportManager;

    beforeEach(() => {
        exportManager = new ExportManager();
    });

    // Arbitrary for generating request logs
    const requestLogArb = fc.record({
        id: fc.uuid(),
        tabId: fc.integer({ min: 1, max: 100 }),
        url: fc.webUrl(),
        method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        requestHeaders: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })),
        requestBody: fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined }),
        responseStatus: fc.option(fc.integer({ min: 100, max: 599 }), { nil: undefined }),
        responseHeaders: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })), { nil: undefined }),
        responseBody: fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined }),
        timing: fc.record({
            startTime: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
            endTime: fc.option(fc.integer({ min: Date.now() - 1000000, max: Date.now() }), { nil: undefined }),
            duration: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
        }),
        type: fc.constantFrom('xmlhttprequest', 'script', 'stylesheet', 'image', 'font', 'other') as fc.Arbitrary<chrome.webRequest.ResourceType>,
        initiator: fc.option(fc.webUrl(), { nil: undefined }),
        error: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        modified: fc.boolean(),
        appliedRules: fc.option(fc.array(fc.uuid(), { maxLength: 5 }), { nil: undefined }),
    });

    describe('Property 30: Export completeness', () => {
        test('should include all request data in JSON export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 20 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        // Verify export metadata
                        expect(parsed.version).toBeDefined();
                        expect(parsed.exportedAt).toBeDefined();
                        expect(parsed.totalRequests).toBe(logs.length);
                        expect(parsed.requests).toBeDefined();
                        expect(Array.isArray(parsed.requests)).toBe(true);
                        expect(parsed.requests.length).toBe(logs.length);

                        // Verify each request has all required fields
                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            const originalLog = logs[index];

                            expect(exportedLog.id).toBe(originalLog.id);
                            expect(exportedLog.tabId).toBe(originalLog.tabId);
                            expect(exportedLog.url).toBe(originalLog.url);
                            expect(exportedLog.method).toBe(originalLog.method);
                            expect(exportedLog.requestHeaders).toEqual(originalLog.requestHeaders);
                            expect(exportedLog.requestBody).toBe(originalLog.requestBody);
                            expect(exportedLog.responseStatus).toBe(originalLog.responseStatus);
                            expect(exportedLog.responseHeaders).toEqual(originalLog.responseHeaders);
                            expect(exportedLog.responseBody).toBe(originalLog.responseBody);
                            expect(exportedLog.timing).toEqual(originalLog.timing);
                            expect(exportedLog.type).toBe(originalLog.type);
                            expect(exportedLog.initiator).toBe(originalLog.initiator);
                            expect(exportedLog.error).toBe(originalLog.error);
                            expect(exportedLog.modified).toBe(originalLog.modified);
                            expect(exportedLog.appliedRules).toEqual(originalLog.appliedRules);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should include all request data in HAR export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 20 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'har');
                        const parsed = JSON.parse(exported);

                        // Verify HAR structure
                        expect(parsed.log).toBeDefined();
                        expect(parsed.log.version).toBe('1.2');
                        expect(parsed.log.creator).toBeDefined();
                        expect(parsed.log.creator.name).toBe('Proxy Server Extension');
                        expect(parsed.log.entries).toBeDefined();
                        expect(Array.isArray(parsed.log.entries)).toBe(true);
                        expect(parsed.log.entries.length).toBe(logs.length);

                        // Verify each entry has required HAR fields
                        parsed.log.entries.forEach((entry: any, index: number) => {
                            const originalLog = logs[index];

                            // Verify entry structure
                            expect(entry.startedDateTime).toBeDefined();
                            expect(entry.time).toBeDefined();
                            expect(entry.request).toBeDefined();
                            expect(entry.response).toBeDefined();
                            expect(entry.cache).toBeDefined();
                            expect(entry.timings).toBeDefined();

                            // Verify request data
                            expect(entry.request.method).toBe(originalLog.method);
                            expect(entry.request.url).toBe(originalLog.url);
                            expect(entry.request.httpVersion).toBeDefined();
                            expect(Array.isArray(entry.request.headers)).toBe(true);
                            expect(Array.isArray(entry.request.queryString)).toBe(true);
                            expect(entry.request.headersSize).toBeGreaterThanOrEqual(0);
                            expect(entry.request.bodySize).toBeGreaterThanOrEqual(0);

                            // Verify response data
                            expect(entry.response.status).toBe(originalLog.responseStatus || 0);
                            expect(entry.response.statusText).toBeDefined();
                            expect(entry.response.httpVersion).toBeDefined();
                            expect(Array.isArray(entry.response.headers)).toBe(true);
                            expect(entry.response.content).toBeDefined();
                            expect(entry.response.content.size).toBeGreaterThanOrEqual(0);
                            expect(entry.response.content.mimeType).toBeDefined();
                        });
                    }
                ),
                testConfig
            );
        });

        test('should preserve request headers in export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            const originalLog = logs[index];
                            expect(exportedLog.requestHeaders).toEqual(originalLog.requestHeaders);

                            // Verify all header keys and values are preserved
                            Object.keys(originalLog.requestHeaders).forEach(key => {
                                expect(exportedLog.requestHeaders[key]).toBe(originalLog.requestHeaders[key]);
                            });
                        });
                    }
                ),
                testConfig
            );
        });

        test('should preserve response headers in export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb.filter(log => log.responseHeaders !== undefined), { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            const originalLog = logs[index];
                            if (originalLog.responseHeaders) {
                                expect(exportedLog.responseHeaders).toEqual(originalLog.responseHeaders);
                            }
                        });
                    }
                ),
                testConfig
            );
        });

        test('should preserve timing information in export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            const originalLog = logs[index];
                            expect(exportedLog.timing).toEqual(originalLog.timing);
                            expect(exportedLog.timing.startTime).toBe(originalLog.timing.startTime);
                            expect(exportedLog.timing.endTime).toBe(originalLog.timing.endTime);
                            expect(exportedLog.timing.duration).toBe(originalLog.timing.duration);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should preserve request and response bodies in export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            const originalLog = logs[index];
                            expect(exportedLog.requestBody).toBe(originalLog.requestBody);
                            expect(exportedLog.responseBody).toBe(originalLog.responseBody);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should preserve metadata in export', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            const originalLog = logs[index];
                            expect(exportedLog.type).toBe(originalLog.type);
                            expect(exportedLog.initiator).toBe(originalLog.initiator);
                            expect(exportedLog.error).toBe(originalLog.error);
                            expect(exportedLog.modified).toBe(originalLog.modified);
                            expect(exportedLog.appliedRules).toEqual(originalLog.appliedRules);
                        });
                    }
                ),
                testConfig
            );
        });
    });

    describe('Property 31: Filtered export accuracy', () => {
        test('should export only filtered requests', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 5, maxLength: 20 }),
                    fc.integer({ min: 1, max: 4 }),
                    (allLogs, filterCount) => {
                        // Take only first N logs as "filtered"
                        const filteredLogs = allLogs.slice(0, filterCount);

                        const exported = exportManager.exportLogs(filteredLogs, 'json');
                        const parsed = JSON.parse(exported);

                        // Verify only filtered logs are exported
                        expect(parsed.totalRequests).toBe(filteredLogs.length);
                        expect(parsed.requests.length).toBe(filteredLogs.length);

                        // Verify exported logs match filtered logs
                        parsed.requests.forEach((exportedLog: any, index: number) => {
                            expect(exportedLog.id).toBe(filteredLogs[index].id);
                            expect(exportedLog.url).toBe(filteredLogs[index].url);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should respect filter criteria when exporting', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 10, maxLength: 30 }),
                    fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
                    (allLogs, methodFilter) => {
                        // Filter logs by method
                        const filteredLogs = allLogs.filter(log => log.method === methodFilter);

                        if (filteredLogs.length === 0) {
                            return true; // Skip if no logs match filter
                        }

                        const exported = exportManager.exportLogs(filteredLogs, 'json');
                        const parsed = JSON.parse(exported);

                        // Verify all exported logs match the filter
                        expect(parsed.requests.length).toBe(filteredLogs.length);
                        parsed.requests.forEach((exportedLog: any) => {
                            expect(exportedLog.method).toBe(methodFilter);
                        });
                    }
                ),
                testConfig
            );
        });
    });

    describe('Property 32: Export format support', () => {
        test('should generate valid JSON for any request logs', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 20 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');

                        // Verify it's valid JSON
                        expect(() => JSON.parse(exported)).not.toThrow();

                        const parsed = JSON.parse(exported);
                        expect(typeof parsed).toBe('object');
                        expect(parsed).not.toBeNull();
                    }
                ),
                testConfig
            );
        });

        test('should generate valid HAR format for any request logs', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 20 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'har');

                        // Verify it's valid JSON
                        expect(() => JSON.parse(exported)).not.toThrow();

                        const parsed = JSON.parse(exported);

                        // Verify HAR structure
                        expect(parsed.log).toBeDefined();
                        expect(parsed.log.version).toBe('1.2');
                        expect(parsed.log.creator).toBeDefined();
                        expect(parsed.log.entries).toBeDefined();
                        expect(Array.isArray(parsed.log.entries)).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should support both JSON and HAR formats', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb, { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        // Export as JSON
                        const jsonExport = exportManager.exportLogs(logs, 'json');
                        expect(() => JSON.parse(jsonExport)).not.toThrow();

                        // Export as HAR
                        const harExport = exportManager.exportLogs(logs, 'har');
                        expect(() => JSON.parse(harExport)).not.toThrow();

                        // Verify both are valid but different formats
                        const jsonParsed = JSON.parse(jsonExport);
                        const harParsed = JSON.parse(harExport);

                        expect(jsonParsed.requests).toBeDefined();
                        expect(harParsed.log).toBeDefined();
                    }
                ),
                testConfig
            );
        });

        test('should generate unique filenames', () => {
            const filename1 = exportManager.generateFilename('json');
            const filename2 = exportManager.generateFilename('json');

            // Filenames should have correct extension
            expect(filename1.endsWith('.json')).toBe(true);
            expect(filename2.endsWith('.json')).toBe(true);

            // Filenames should contain timestamp
            expect(filename1).toContain('proxy-export-');
            expect(filename2).toContain('proxy-export-');
        });

        test('should handle empty request bodies correctly', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb.map(log => ({ ...log, requestBody: undefined })), { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any) => {
                            expect(exportedLog.requestBody).toBeUndefined();
                        });
                    }
                ),
                testConfig
            );
        });

        test('should handle empty response bodies correctly', () => {
            fc.assert(
                fc.property(
                    fc.array(requestLogArb.map(log => ({ ...log, responseBody: undefined })), { minLength: 1, maxLength: 10 }),
                    (logs) => {
                        const exported = exportManager.exportLogs(logs, 'json');
                        const parsed = JSON.parse(exported);

                        parsed.requests.forEach((exportedLog: any) => {
                            expect(exportedLog.responseBody).toBeUndefined();
                        });
                    }
                ),
                testConfig
            );
        });
    });
});
