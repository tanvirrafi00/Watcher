// Feature: proxy-server-extension, Property 1: Complete request capture
// Property-based tests for data model validation

import fc from 'fast-check';
import {
    validateRule,
    validateRuleAction,
    validateRuleCondition,
    validateLogFilter,
    validateSettings,
    isValidUrl,
    isValidHttpMethod,
} from '../validation';
import { Rule, RuleAction, RuleCondition, LogFilter, ExtensionSettings } from '../types';

describe('Property 1: Complete request capture - Data Model Validation', () => {
    // Configure property-based test runs
    const testConfig = {
        numRuns: 100,
        verbose: false,
    };

    describe('Rule validation', () => {
        test('should accept valid rules with all required fields', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
                    fc.constantFrom('glob' as const, 'regex' as const),
                    fc.integer({ min: 0, max: 100 }),
                    (name, urlPattern, matchType, priority) => {
                        const rule: Partial<Rule> = {
                            name,
                            urlPattern: matchType === 'regex' ? '.*' : urlPattern,
                            matchType,
                            priority,
                            actions: [{
                                type: 'block',
                                config: {},
                            }],
                        };

                        const result = validateRule(rule);
                        expect(result.valid).toBe(true);
                        expect(result.errors).toHaveLength(0);
                    }
                ),
                testConfig
            );
        });

        test('should reject rules with empty name', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }),
                    (urlPattern) => {
                        const rule: Partial<Rule> = {
                            name: '',
                            urlPattern,
                            matchType: 'glob',
                            actions: [{ type: 'block', config: {} }],
                        };

                        const result = validateRule(rule);
                        expect(result.valid).toBe(false);
                        expect(result.errors.some(e => e.includes('name'))).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject rules with invalid regex patterns', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }),
                    (name) => {
                        const rule: Partial<Rule> = {
                            name,
                            urlPattern: '[invalid(regex',
                            matchType: 'regex',
                            actions: [{ type: 'block', config: {} }],
                        };

                        const result = validateRule(rule);
                        expect(result.valid).toBe(false);
                        expect(result.errors.some(e => e.includes('regex'))).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject rules without actions', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }),
                    fc.string({ minLength: 1 }),
                    (name, urlPattern) => {
                        const rule: Partial<Rule> = {
                            name,
                            urlPattern,
                            matchType: 'glob',
                            actions: [],
                        };

                        const result = validateRule(rule);
                        expect(result.valid).toBe(false);
                        expect(result.errors.some(e => e.includes('action'))).toBe(true);
                    }
                ),
                testConfig
            );
        });
    });

    describe('RuleAction validation', () => {
        test('should accept valid modifyHeaders actions', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    fc.constantFrom('add' as const, 'remove' as const, 'set' as const),
                    (headerName, headerValue, operation) => {
                        const action: RuleAction = {
                            type: 'modifyHeaders',
                            config: {
                                headers: [{
                                    name: headerName,
                                    value: operation !== 'remove' ? headerValue : undefined,
                                    operation,
                                }],
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should accept valid redirect actions with valid URLs', () => {
            fc.assert(
                fc.property(
                    fc.webUrl(),
                    (redirectUrl) => {
                        const action: RuleAction = {
                            type: 'redirect',
                            config: {
                                redirectUrl,
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject redirect actions with invalid URLs', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }).filter(s => {
                        // Filter out strings that could be valid URLs
                        try {
                            new URL(s);
                            return false; // If URL constructor succeeds, filter it out
                        } catch {
                            return true; // If it fails, keep it (it's invalid)
                        }
                    }),
                    (invalidUrl) => {
                        const action: RuleAction = {
                            type: 'redirect',
                            config: {
                                redirectUrl: invalidUrl,
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });

        test('should accept valid mock actions', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 100, max: 599 }),
                    fc.string(),
                    (status, body) => {
                        const action: RuleAction = {
                            type: 'mock',
                            config: {
                                mockResponse: {
                                    status,
                                    headers: { 'Content-Type': 'application/json' },
                                    body,
                                },
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject mock actions with invalid status codes', () => {
            fc.assert(
                fc.property(
                    fc.integer().filter(n => n < 100 || n > 599),
                    (invalidStatus) => {
                        const action: RuleAction = {
                            type: 'mock',
                            config: {
                                mockResponse: {
                                    status: invalidStatus,
                                    headers: {},
                                    body: 'test',
                                },
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });

        test('should accept valid delay actions within limits', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 30000 }),
                    (delayMs) => {
                        const action: RuleAction = {
                            type: 'delay',
                            config: {
                                delayMs,
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject delay actions exceeding 30 seconds', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 30001, max: 100000 }),
                    (delayMs) => {
                        const action: RuleAction = {
                            type: 'delay',
                            config: {
                                delayMs,
                            },
                        };

                        const result = validateRuleAction(action);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });
    });

    describe('RuleCondition validation', () => {
        test('should accept valid conditions', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('method' as const, 'resourceType' as const, 'header' as const),
                    fc.constantFrom('equals' as const, 'contains' as const, 'regex' as const),
                    fc.string({ minLength: 1 }),
                    (type, operator, value) => {
                        const condition: RuleCondition = {
                            type,
                            operator: operator === 'regex' ? 'equals' : operator, // Avoid invalid regex
                            value,
                        };

                        const result = validateRuleCondition(condition);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject conditions with empty values', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('method' as const, 'resourceType' as const, 'header' as const),
                    fc.constantFrom('equals' as const, 'contains' as const, 'regex' as const),
                    (type, operator) => {
                        const condition: RuleCondition = {
                            type,
                            operator,
                            value: '',
                        };

                        const result = validateRuleCondition(condition);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });
    });

    describe('LogFilter validation', () => {
        test('should accept valid log filters', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.integer({ min: 100, max: 599 })),
                    fc.integer({ min: 0, max: Date.now() }),
                    (statusCodes, startTime) => {
                        const filter: LogFilter = {
                            statusCodes,
                            timeRange: {
                                start: startTime,
                                end: startTime + 1000,
                            },
                        };

                        const result = validateLogFilter(filter);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject filters with invalid time ranges', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1000, max: Date.now() }),
                    (endTime) => {
                        const filter: LogFilter = {
                            timeRange: {
                                start: endTime,
                                end: endTime - 1000, // Start after end
                            },
                        };

                        const result = validateLogFilter(filter);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });
    });

    describe('ExtensionSettings validation', () => {
        test('should accept valid settings', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 365 }),
                    fc.integer({ min: 10, max: 10000 }),
                    (retentionDays, maxStoredRequests) => {
                        const settings: Partial<ExtensionSettings> = {
                            retentionDays,
                            maxStoredRequests,
                        };

                        const result = validateSettings(settings);
                        expect(result.valid).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject settings with invalid retention days', () => {
            fc.assert(
                fc.property(
                    fc.integer().filter(n => n < 1 || n > 365),
                    (retentionDays) => {
                        const settings: Partial<ExtensionSettings> = {
                            retentionDays,
                        };

                        const result = validateSettings(settings);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });

        test('should reject settings with invalid max stored requests', () => {
            fc.assert(
                fc.property(
                    fc.integer().filter(n => n < 10 || n > 10000),
                    (maxStoredRequests) => {
                        const settings: Partial<ExtensionSettings> = {
                            maxStoredRequests,
                        };

                        const result = validateSettings(settings);
                        expect(result.valid).toBe(false);
                    }
                ),
                testConfig
            );
        });
    });

    describe('URL validation', () => {
        test('should accept valid URLs', () => {
            fc.assert(
                fc.property(
                    fc.webUrl(),
                    (url) => {
                        expect(isValidUrl(url)).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject invalid URLs', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }).filter(s => {
                        // Filter out strings that could be valid URLs
                        try {
                            new URL(s);
                            return false;
                        } catch {
                            return true;
                        }
                    }),
                    (invalidUrl) => {
                        expect(isValidUrl(invalidUrl)).toBe(false);
                    }
                ),
                testConfig
            );
        });
    });

    describe('HTTP method validation', () => {
        test('should accept valid HTTP methods', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'),
                    (method) => {
                        expect(isValidHttpMethod(method)).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should reject invalid HTTP methods', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1 }).filter(s =>
                        !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'].includes(s.toUpperCase())
                    ),
                    (invalidMethod) => {
                        expect(isValidHttpMethod(invalidMethod)).toBe(false);
                    }
                ),
                testConfig
            );
        });
    });
});
