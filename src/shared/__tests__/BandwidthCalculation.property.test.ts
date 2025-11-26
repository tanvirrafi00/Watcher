// Feature: proxy-server-extension, Property 8: Bandwidth calculation accuracy
// Property-based test for bandwidth calculation

import fc from 'fast-check';
import { calculateBandwidth } from '../utils';
import { RequestLog } from '../types';

describe('Bandwidth Calculation Property Tests', () => {
    const testConfig = {
        numRuns: 100,
        verbose: false,
    };

    // Arbitrary for generating RequestLog with bodies
    const requestLogArbitrary = fc.record({
        id: fc.string(),
        tabId: fc.integer({ min: 0 }),
        url: fc.webUrl(),
        method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        requestHeaders: fc.dictionary(fc.string(), fc.string()),
        requestBody: fc.option(fc.string(), { nil: undefined }),
        responseStatus: fc.option(fc.integer({ min: 100, max: 599 }), { nil: undefined }),
        responseHeaders: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
        responseBody: fc.option(fc.string(), { nil: undefined }),
        timing: fc.record({
            startTime: fc.integer({ min: 0 }),
            endTime: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
            duration: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
        }),
        type: fc.constantFrom('main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webbundle', 'other') as fc.Arbitrary<chrome.webRequest.ResourceType>,
        initiator: fc.option(fc.string(), { nil: undefined }),
        error: fc.option(fc.string(), { nil: undefined }),
        modified: fc.boolean(),
        appliedRules: fc.option(fc.array(fc.string()), { nil: undefined }),
    });

    // **Property 8: Bandwidth calculation accuracy**
    // For any sequence of network requests, the calculated bandwidth usage should equal 
    // the sum of all request and response body sizes
    test('bandwidth calculation should equal sum of request and response body sizes', () => {
        fc.assert(
            fc.property(
                fc.array(requestLogArbitrary, { minLength: 0, maxLength: 50 }),
                (logs) => {
                    const bandwidth = calculateBandwidth(logs);

                    // Manually calculate expected values
                    let expectedSent = 0;
                    let expectedReceived = 0;

                    logs.forEach((log) => {
                        if (log.requestBody) {
                            expectedSent += new Blob([log.requestBody]).size;
                        }
                        if (log.responseBody) {
                            expectedReceived += new Blob([log.responseBody]).size;
                        }
                    });

                    const expectedTotal = expectedSent + expectedReceived;

                    // Verify the property holds
                    expect(bandwidth.sent).toBe(expectedSent);
                    expect(bandwidth.received).toBe(expectedReceived);
                    expect(bandwidth.total).toBe(expectedTotal);
                    expect(bandwidth.total).toBe(bandwidth.sent + bandwidth.received);
                }
            ),
            testConfig
        );
    });

    test('bandwidth calculation should handle empty request list', () => {
        const bandwidth = calculateBandwidth([]);
        expect(bandwidth.sent).toBe(0);
        expect(bandwidth.received).toBe(0);
        expect(bandwidth.total).toBe(0);
    });

    test('bandwidth calculation should handle requests with no bodies', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        id: fc.string(),
                        tabId: fc.integer({ min: 0 }),
                        url: fc.webUrl(),
                        method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
                        requestHeaders: fc.dictionary(fc.string(), fc.string()),
                        requestBody: fc.constant(undefined),
                        responseStatus: fc.option(fc.integer({ min: 100, max: 599 }), { nil: undefined }),
                        responseHeaders: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
                        responseBody: fc.constant(undefined),
                        timing: fc.record({
                            startTime: fc.integer({ min: 0 }),
                            endTime: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
                            duration: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
                        }),
                        type: fc.constantFrom('main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webbundle', 'other') as fc.Arbitrary<chrome.webRequest.ResourceType>,
                        initiator: fc.option(fc.string(), { nil: undefined }),
                        error: fc.option(fc.string(), { nil: undefined }),
                        modified: fc.boolean(),
                        appliedRules: fc.option(fc.array(fc.string()), { nil: undefined }),
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                (logs) => {
                    const bandwidth = calculateBandwidth(logs as RequestLog[]);
                    expect(bandwidth.sent).toBe(0);
                    expect(bandwidth.received).toBe(0);
                    expect(bandwidth.total).toBe(0);
                }
            ),
            testConfig
        );
    });

    test('bandwidth calculation should be additive', () => {
        fc.assert(
            fc.property(
                fc.array(requestLogArbitrary, { minLength: 1, maxLength: 20 }),
                fc.array(requestLogArbitrary, { minLength: 1, maxLength: 20 }),
                (logs1, logs2) => {
                    const bandwidth1 = calculateBandwidth(logs1);
                    const bandwidth2 = calculateBandwidth(logs2);
                    const combinedBandwidth = calculateBandwidth([...logs1, ...logs2]);

                    // The combined bandwidth should equal the sum of individual bandwidths
                    expect(combinedBandwidth.sent).toBe(bandwidth1.sent + bandwidth2.sent);
                    expect(combinedBandwidth.received).toBe(bandwidth1.received + bandwidth2.received);
                    expect(combinedBandwidth.total).toBe(bandwidth1.total + bandwidth2.total);
                }
            ),
            testConfig
        );
    });

    test('bandwidth total should always be non-negative', () => {
        fc.assert(
            fc.property(
                fc.array(requestLogArbitrary, { minLength: 0, maxLength: 50 }),
                (logs) => {
                    const bandwidth = calculateBandwidth(logs);
                    expect(bandwidth.sent).toBeGreaterThanOrEqual(0);
                    expect(bandwidth.received).toBeGreaterThanOrEqual(0);
                    expect(bandwidth.total).toBeGreaterThanOrEqual(0);
                }
            ),
            testConfig
        );
    });
});
