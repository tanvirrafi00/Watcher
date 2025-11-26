/**
 * Property-based tests for rule update immediacy
 * Feature: proxy-server-extension, Property 4: Rule update immediacy
 * Validates: Requirements 2.5, 5.5
 */

import fc from 'fast-check';
import { RuleEngine, StorageManager } from '../../shared';
import { Rule } from '../../shared/types';

// Mock chrome.storage API
const mockStorage: Record<string, any> = {};

global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys: string | string[] | null) => {
                if (keys === null) {
                    return Promise.resolve(mockStorage);
                }
                if (typeof keys === 'string') {
                    return Promise.resolve({ [keys]: mockStorage[keys] });
                }
                const result: Record<string, any> = {};
                keys.forEach(key => {
                    if (mockStorage[key] !== undefined) {
                        result[key] = mockStorage[key];
                    }
                });
                return Promise.resolve(result);
            }),
            set: jest.fn((items: Record<string, any>) => {
                Object.assign(mockStorage, items);
                return Promise.resolve();
            }),
            remove: jest.fn((keys: string | string[]) => {
                const keysArray = Array.isArray(keys) ? keys : [keys];
                keysArray.forEach(key => delete mockStorage[key]);
                return Promise.resolve();
            }),
            getBytesInUse: jest.fn(() => {
                const str = JSON.stringify(mockStorage);
                return Promise.resolve(str.length);
            }),
        },
    },
} as any;

describe('Rule Update Immediacy Property Tests', () => {
    let storageManager: StorageManager;
    let ruleEngine: RuleEngine;

    beforeEach(() => {
        // Clear mock storage
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        jest.clearAllMocks();

        storageManager = new StorageManager();
        ruleEngine = new RuleEngine(storageManager);
    });

    /**
     * Property 4: Rule update immediacy
     * For any modification rule that is updated or toggled, subsequent requests
     * should reflect the updated rule state without requiring extension restart.
     * Validates: Requirements 2.5, 5.5
     */
    test('Property 4: Toggling a rule should immediately affect request evaluation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.boolean(), // Initial enabled state
                async (initialEnabled) => {
                    // Clear storage for this iteration
                    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

                    // Create a simple rule
                    const rule: Partial<Rule> = {
                        name: 'Test Rule',
                        urlPattern: '*',
                        matchType: 'glob',
                        enabled: initialEnabled,
                        actions: [{
                            type: 'modifyHeaders',
                            config: {
                                headers: [{
                                    name: 'X-Test',
                                    value: 'test-value',
                                    operation: 'add',
                                }],
                            },
                        }],
                        priority: 1,
                    };

                    const ruleId = await ruleEngine.saveRule(rule);

                    // Verify the rule was saved with correct enabled state
                    const savedRule = await ruleEngine.getRuleById(ruleId);
                    expect(savedRule?.enabled).toBe(initialEnabled);

                    // Create a test request
                    const requestDetails = {
                        requestId: 'test-request',
                        url: 'https://example.com/test',
                        method: 'GET',
                        tabId: 1,
                        type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
                        timeStamp: Date.now(),
                        frameId: 0,
                        parentFrameId: -1,
                    };

                    // Evaluate request with initial state
                    const matches1 = await ruleEngine.evaluateRequest(requestDetails);
                    const initiallyMatched = matches1.length > 0;

                    // Verify initial state - disabled rules should not match
                    if (initialEnabled) {
                        expect(initiallyMatched).toBe(true);
                    } else {
                        expect(initiallyMatched).toBe(false);
                    }

                    // Toggle the rule
                    await ruleEngine.toggleRule(ruleId, !initialEnabled);

                    // Evaluate request again - should reflect new state immediately
                    const matches2 = await ruleEngine.evaluateRequest(requestDetails);
                    const matchedAfterToggle = matches2.length > 0;

                    // Verify the rule state changed immediately
                    expect(matchedAfterToggle).toBe(!initialEnabled);
                }
            ),
            { numRuns: 100 }
        );
    });

    test('Property 4: Updating rule URL pattern should immediately affect matching', async () => {
        // Create a rule that matches all URLs
        const rule: Partial<Rule> = {
            name: 'Test Rule',
            urlPattern: '*',
            matchType: 'glob',
            enabled: true,
            actions: [{
                type: 'modifyHeaders',
                config: {
                    headers: [{
                        name: 'X-Test',
                        value: 'test-value',
                        operation: 'add',
                    }],
                },
            }],
            priority: 1,
        };

        const ruleId = await ruleEngine.saveRule(rule);

        const requestDetails = {
            requestId: 'test-request',
            url: 'https://different.com/test',
            method: 'GET',
            tabId: 1,
            type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
            timeStamp: Date.now(),
            frameId: 0,
            parentFrameId: -1,
        };

        // Should match with wildcard pattern
        const matches1 = await ruleEngine.evaluateRequest(requestDetails);
        expect(matches1.length).toBe(1);

        // Update rule to match only example.com
        const existingRule = await ruleEngine.getRuleById(ruleId);
        await ruleEngine.saveRule({
            ...existingRule!,
            urlPattern: 'https://example.com/*',
        });

        // Should not match different.com anymore
        const matches2 = await ruleEngine.evaluateRequest(requestDetails);
        expect(matches2.length).toBe(0);

        // Should match example.com
        const exampleRequest = {
            ...requestDetails,
            url: 'https://example.com/test',
        };
        const matches3 = await ruleEngine.evaluateRequest(exampleRequest);
        expect(matches3.length).toBe(1);
    });

    test('Property 4: Rule priority updates should immediately affect evaluation order', async () => {
        // Create three rules with different priorities
        const rule1Id = await ruleEngine.saveRule({
            name: 'Rule 1',
            urlPattern: '*',
            matchType: 'glob',
            enabled: true,
            actions: [{ type: 'modifyHeaders', config: { headers: [{ name: 'X-Rule', value: '1', operation: 'add' }] } }],
            priority: 10,
        });

        const rule2Id = await ruleEngine.saveRule({
            name: 'Rule 2',
            urlPattern: '*',
            matchType: 'glob',
            enabled: true,
            actions: [{ type: 'modifyHeaders', config: { headers: [{ name: 'X-Rule', value: '2', operation: 'add' }] } }],
            priority: 20,
        });

        const rule3Id = await ruleEngine.saveRule({
            name: 'Rule 3',
            urlPattern: '*',
            matchType: 'glob',
            enabled: true,
            actions: [{ type: 'modifyHeaders', config: { headers: [{ name: 'X-Rule', value: '3', operation: 'add' }] } }],
            priority: 30,
        });

        const requestDetails = {
            requestId: 'test-request',
            url: 'https://example.com/test',
            method: 'GET',
            tabId: 1,
            type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
            timeStamp: Date.now(),
            frameId: 0,
            parentFrameId: -1,
        };

        // Evaluate - should be ordered by priority (highest first)
        const matches1 = await ruleEngine.evaluateRequest(requestDetails);
        expect(matches1[0].id).toBe(rule3Id); // Priority 30
        expect(matches1[1].id).toBe(rule2Id); // Priority 20
        expect(matches1[2].id).toBe(rule1Id); // Priority 10

        // Update rule1 to have highest priority
        const rule1 = await ruleEngine.getRuleById(rule1Id);
        await ruleEngine.saveRule({
            ...rule1!,
            priority: 100,
        });

        // Evaluate again - rule1 should now be first
        const matches2 = await ruleEngine.evaluateRequest(requestDetails);
        expect(matches2[0].id).toBe(rule1Id); // Priority 100
        expect(matches2[1].id).toBe(rule3Id); // Priority 30
        expect(matches2[2].id).toBe(rule2Id); // Priority 20
    });
});
