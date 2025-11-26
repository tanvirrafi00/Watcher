// Feature: proxy-server-extension, Property 2: Rule persistence and application
// Feature: proxy-server-extension, Property 11: Rule validation
// Feature: proxy-server-extension, Property 12: Pattern matching accuracy
// Property-based tests for Rule Engine

import fc from 'fast-check';
import { RuleEngine } from '../RuleEngine';
import { StorageManager } from '../StorageManager';
import { RequestDetails } from '../types';

// Declare global chrome for tests
declare const global: typeof globalThis & {
    chrome: typeof chrome;
};

describe('Rule Engine Property Tests', () => {
    const testConfig = {
        numRuns: 10,
        verbose: false,
    };

    let ruleEngine: RuleEngine;
    let storageManager: StorageManager;
    let mockStorage: Map<string, any>;

    beforeEach(() => {
        mockStorage = new Map();
        storageManager = new StorageManager();
        ruleEngine = new RuleEngine(storageManager);

        // Mock chrome.storage.local
        (global.chrome.storage.local.set as jest.Mock) = jest.fn((items: Record<string, any>) => {
            Object.entries(items).forEach(([key, value]) => {
                mockStorage.set(key, value);
            });
            return Promise.resolve();
        });

        (global.chrome.storage.local.get as jest.Mock) = jest.fn((keys: string | string[] | null) => {
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

        (global.chrome.storage.local.remove as jest.Mock) = jest.fn((keys: string | string[]) => {
            const keyArray = typeof keys === 'string' ? [keys] : keys;
            keyArray.forEach((key) => {
                mockStorage.delete(key);
            });
            return Promise.resolve();
        });

        (global.chrome.storage.local.clear as jest.Mock) = jest.fn(() => {
            mockStorage.clear();
            return Promise.resolve();
        });

        (global.chrome.storage.local.getBytesInUse as jest.Mock) = jest.fn(() => {
            return Promise.resolve(0);
        });
    });

    describe('Property 2: Rule persistence and application', () => {
        test('should persist and retrieve any valid rule', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        urlPattern: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                        matchType: fc.constantFrom('glob' as const, 'regex' as const),
                        priority: fc.integer({ min: 0, max: 100 }),
                    }),
                    async (ruleData) => {
                        mockStorage.clear();

                        const ruleId = await ruleEngine.saveRule({
                            name: ruleData.name,
                            urlPattern: ruleData.matchType === 'regex' ? '.*' : ruleData.urlPattern,
                            matchType: ruleData.matchType,
                            priority: ruleData.priority,
                            actions: [{ type: 'block', config: {} }],
                        });

                        expect(ruleId).toBeDefined();

                        const retrievedRule = await ruleEngine.getRuleById(ruleId);
                        expect(retrievedRule).not.toBeNull();
                        expect(retrievedRule?.name).toBe(ruleData.name);
                        expect(retrievedRule?.priority).toBe(ruleData.priority);
                    }
                ),
                testConfig
            );
        });

        test('should apply rules to matching requests', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.webUrl(),
                    async (url) => {
                        mockStorage.clear();

                        // Create a rule that matches all URLs
                        await ruleEngine.saveRule({
                            name: 'Match All',
                            urlPattern: '*',
                            matchType: 'glob',
                            actions: [{ type: 'block', config: {} }],
                        });

                        const requestDetails: RequestDetails = {
                            requestId: '123',
                            url,
                            method: 'GET',
                            tabId: 1,
                            type: 'xmlhttprequest',
                            timeStamp: Date.now(),
                            frameId: 0,
                            parentFrameId: -1,
                        };

                        const matchingRules = await ruleEngine.evaluateRequest(requestDetails);
                        expect(matchingRules.length).toBeGreaterThan(0);
                    }
                ),
                testConfig
            );
        });

        test('should update existing rules', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    async (originalName, updatedName) => {
                        mockStorage.clear();

                        const ruleId = await ruleEngine.saveRule({
                            name: originalName,
                            urlPattern: '*',
                            matchType: 'glob',
                            actions: [{ type: 'block', config: {} }],
                        });

                        await ruleEngine.saveRule({
                            id: ruleId,
                            name: updatedName,
                            urlPattern: '*',
                            matchType: 'glob',
                            actions: [{ type: 'block', config: {} }],
                        });

                        const rule = await ruleEngine.getRuleById(ruleId);
                        expect(rule?.name).toBe(updatedName);
                    }
                ),
                testConfig
            );
        });

        test('should delete rules', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    async (name) => {
                        mockStorage.clear();

                        const ruleId = await ruleEngine.saveRule({
                            name,
                            urlPattern: '*',
                            matchType: 'glob',
                            actions: [{ type: 'block', config: {} }],
                        });

                        await ruleEngine.deleteRule(ruleId);

                        const rule = await ruleEngine.getRuleById(ruleId);
                        expect(rule).toBeNull();
                    }
                ),
                testConfig
            );
        });
    });

    describe('Property 11: Rule validation', () => {
        test('should reject rules with empty names', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.constantFrom('', '   ', '\t', '\n'),
                    async (invalidName) => {
                        mockStorage.clear();

                        await expect(
                            ruleEngine.saveRule({
                                name: invalidName,
                                urlPattern: '*',
                                matchType: 'glob',
                                actions: [{ type: 'block', config: {} }],
                            })
                        ).rejects.toThrow();
                    }
                ),
                testConfig
            );
        });

        test('should reject rules with invalid regex patterns', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    async (name) => {
                        mockStorage.clear();

                        await expect(
                            ruleEngine.saveRule({
                                name,
                                urlPattern: '[invalid(regex',
                                matchType: 'regex',
                                actions: [{ type: 'block', config: {} }],
                            })
                        ).rejects.toThrow();
                    }
                ),
                testConfig
            );
        });

        test('should reject rules without actions', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    async (name) => {
                        mockStorage.clear();

                        await expect(
                            ruleEngine.saveRule({
                                name,
                                urlPattern: '*',
                                matchType: 'glob',
                                actions: [],
                            })
                        ).rejects.toThrow();
                    }
                ),
                testConfig
            );
        });

        test('should accept valid rules with all fields', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        urlPattern: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                        priority: fc.integer({ min: 0, max: 100 }),
                    }),
                    async (ruleData) => {
                        mockStorage.clear();

                        const ruleId = await ruleEngine.saveRule({
                            name: ruleData.name,
                            urlPattern: ruleData.urlPattern,
                            matchType: 'glob',
                            priority: ruleData.priority,
                            actions: [{ type: 'block', config: {} }],
                        });

                        expect(ruleId).toBeDefined();
                        expect(typeof ruleId).toBe('string');
                    }
                ),
                testConfig
            );
        });
    });

    describe('Property 12: Pattern matching accuracy', () => {
        test('should match URLs with glob patterns', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.constantFrom(
                        { pattern: '*.example.com/*', url: 'https://api.example.com/test', shouldMatch: true },
                        { pattern: '*.example.com/*', url: 'https://other.com/test', shouldMatch: false },
                        { pattern: 'https://example.com/*', url: 'https://example.com/path', shouldMatch: true },
                        { pattern: 'https://example.com/*', url: 'https://other.com/path', shouldMatch: false }
                    ),
                    async (testCase) => {
                        mockStorage.clear();

                        await ruleEngine.saveRule({
                            name: 'Test Rule',
                            urlPattern: testCase.pattern,
                            matchType: 'glob',
                            actions: [{ type: 'block', config: {} }],
                        });

                        const requestDetails: RequestDetails = {
                            requestId: '123',
                            url: testCase.url,
                            method: 'GET',
                            tabId: 1,
                            type: 'xmlhttprequest',
                            timeStamp: Date.now(),
                            frameId: 0,
                            parentFrameId: -1,
                        };

                        const matchingRules = await ruleEngine.evaluateRequest(requestDetails);

                        if (testCase.shouldMatch) {
                            expect(matchingRules.length).toBeGreaterThan(0);
                        } else {
                            expect(matchingRules.length).toBe(0);
                        }
                    }
                ),
                testConfig
            );
        });

        test('should match URLs with regex patterns', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.constantFrom(
                        { pattern: '.*\\.example\\.com/.*', url: 'https://api.example.com/test', shouldMatch: true },
                        { pattern: '.*\\.example\\.com/.*', url: 'https://other.com/test', shouldMatch: false },
                        { pattern: '^https://example\\.com/.*', url: 'https://example.com/path', shouldMatch: true },
                        { pattern: '^https://example\\.com/.*', url: 'http://example.com/path', shouldMatch: false }
                    ),
                    async (testCase) => {
                        mockStorage.clear();

                        await ruleEngine.saveRule({
                            name: 'Test Rule',
                            urlPattern: testCase.pattern,
                            matchType: 'regex',
                            actions: [{ type: 'block', config: {} }],
                        });

                        const requestDetails: RequestDetails = {
                            requestId: '123',
                            url: testCase.url,
                            method: 'GET',
                            tabId: 1,
                            type: 'xmlhttprequest',
                            timeStamp: Date.now(),
                            frameId: 0,
                            parentFrameId: -1,
                        };

                        const matchingRules = await ruleEngine.evaluateRequest(requestDetails);

                        if (testCase.shouldMatch) {
                            expect(matchingRules.length).toBeGreaterThan(0);
                        } else {
                            expect(matchingRules.length).toBe(0);
                        }
                    }
                ),
                testConfig
            );
        });

        test('should respect rule priority ordering', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 5 }),
                    async (priorities) => {
                        mockStorage.clear();

                        // Create rules with different priorities
                        for (let i = 0; i < priorities.length; i++) {
                            await ruleEngine.saveRule({
                                name: `Rule ${i}`,
                                urlPattern: '*',
                                matchType: 'glob',
                                priority: priorities[i],
                                actions: [{ type: 'block', config: {} }],
                            });
                        }

                        const requestDetails: RequestDetails = {
                            requestId: '123',
                            url: 'https://example.com',
                            method: 'GET',
                            tabId: 1,
                            type: 'xmlhttprequest',
                            timeStamp: Date.now(),
                            frameId: 0,
                            parentFrameId: -1,
                        };

                        const matchingRules = await ruleEngine.evaluateRequest(requestDetails);

                        // Verify rules are sorted by priority (descending)
                        for (let i = 0; i < matchingRules.length - 1; i++) {
                            expect(matchingRules[i].priority).toBeGreaterThanOrEqual(matchingRules[i + 1].priority);
                        }
                    }
                ),
                testConfig
            );
        });

        test('should only match enabled rules', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.boolean(),
                    async (enabled) => {
                        mockStorage.clear();

                        const ruleId = await ruleEngine.saveRule({
                            name: 'Test Rule',
                            urlPattern: '*',
                            matchType: 'glob',
                            enabled,
                            actions: [{ type: 'block', config: {} }],
                        });

                        const requestDetails: RequestDetails = {
                            requestId: '123',
                            url: 'https://example.com',
                            method: 'GET',
                            tabId: 1,
                            type: 'xmlhttprequest',
                            timeStamp: Date.now(),
                            frameId: 0,
                            parentFrameId: -1,
                        };

                        const matchingRules = await ruleEngine.evaluateRequest(requestDetails);

                        if (enabled) {
                            expect(matchingRules.length).toBeGreaterThan(0);
                            expect(matchingRules[0].id).toBe(ruleId);
                        } else {
                            expect(matchingRules.length).toBe(0);
                        }
                    }
                ),
                testConfig
            );
        });
    });

    describe('Rule Engine Core Functionality', () => {
        test('should toggle rule enabled state', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    async (name) => {
                        mockStorage.clear();

                        const ruleId = await ruleEngine.saveRule({
                            name,
                            urlPattern: '*',
                            matchType: 'glob',
                            enabled: true,
                            actions: [{ type: 'block', config: {} }],
                        });

                        await ruleEngine.toggleRule(ruleId, false);
                        let rule = await ruleEngine.getRuleById(ruleId);
                        expect(rule?.enabled).toBe(false);

                        await ruleEngine.toggleRule(ruleId, true);
                        rule = await ruleEngine.getRuleById(ruleId);
                        expect(rule?.enabled).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should export and import rules', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                            urlPattern: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    async (rulesData) => {
                        mockStorage.clear();

                        // Create rules
                        for (const ruleData of rulesData) {
                            await ruleEngine.saveRule({
                                name: ruleData.name,
                                urlPattern: ruleData.urlPattern,
                                matchType: 'glob',
                                actions: [{ type: 'block', config: {} }],
                            });
                        }

                        // Export rules
                        const exported = await ruleEngine.exportRules();
                        expect(exported).toBeDefined();

                        // Clear and import
                        await ruleEngine.clearAllRules();
                        const importedCount = await ruleEngine.importRules(exported, true);

                        expect(importedCount).toBe(rulesData.length);

                        const rules = await ruleEngine.getRules();
                        expect(rules.length).toBe(rulesData.length);
                    }
                ),
                testConfig
            );
        });
    });
});
