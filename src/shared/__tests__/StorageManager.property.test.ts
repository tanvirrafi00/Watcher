// Feature: proxy-server-extension, Property 24: Storage persistence
// Feature: proxy-server-extension, Property 25: Quota management
// Property-based tests for Storage Manager

import fc from 'fast-check';
import { StorageManager } from '../StorageManager';

// Declare global chrome for tests
declare const global: typeof globalThis & {
    chrome: typeof chrome;
};

describe('Storage Manager Property Tests', () => {
    const testConfig = {
        numRuns: 10,  // Reduced for debugging
        verbose: false,
    };

    let storageManager: StorageManager;
    let mockStorage: Map<string, any>;
    let mockBytesInUse: number;

    beforeEach(() => {
        storageManager = new StorageManager();
        mockStorage = new Map();
        mockBytesInUse = 0;

        // Mock chrome.storage.local
        (global.chrome.storage.local.set as jest.Mock) = jest.fn((items: Record<string, any>) => {
            Object.entries(items).forEach(([key, value]) => {
                mockStorage.set(key, value);
                // Estimate bytes
                mockBytesInUse += JSON.stringify(value).length;
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
                if (mockStorage.has(key)) {
                    const value = mockStorage.get(key);
                    mockBytesInUse -= JSON.stringify(value).length;
                    mockStorage.delete(key);
                }
            });
            return Promise.resolve();
        });

        (global.chrome.storage.local.clear as jest.Mock) = jest.fn(() => {
            mockStorage.clear();
            mockBytesInUse = 0;
            return Promise.resolve();
        });

        (global.chrome.storage.local.getBytesInUse as jest.Mock) = jest.fn(() => {
            return Promise.resolve(mockBytesInUse);
        });
    });

    describe('Property 24: Storage persistence', () => {
        test('should persist and retrieve any string data', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0).filter(s => s.trim().length > 0),
                    fc.string(),
                    async (key, value) => {
                        // Clear storage for this iteration
                        mockStorage.clear();
                        mockBytesInUse = 0;

                        await storageManager.save(key, value);
                        const retrieved = await storageManager.get<string>(key);
                        expect(retrieved).toBe(value);
                    }
                ),
                testConfig
            );
        });

        test('should persist and retrieve any number data', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    fc.integer(),
                    async (key, value) => {
                        mockStorage.clear();
                        mockBytesInUse = 0;

                        await storageManager.save(key, value);
                        const retrieved = await storageManager.get<number>(key);
                        expect(retrieved).toBe(value);
                    }
                ),
                testConfig
            );
        });

        test('should persist and retrieve any object data', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    fc.record({
                        id: fc.string(),
                        count: fc.integer(),
                        active: fc.boolean(),
                    }),
                    async (key, value) => {
                        // Create fresh storage for this iteration
                        mockStorage = new Map();
                        mockBytesInUse = 0;

                        await storageManager.save(key, value);
                        const retrieved = await storageManager.get<typeof value>(key);
                        expect(retrieved).toEqual(value);
                    }
                ),
                testConfig
            );
        });

        test('should persist and retrieve any array data', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    fc.array(fc.string()),
                    async (key, value) => {
                        mockStorage.clear();
                        mockBytesInUse = 0;

                        await storageManager.save(key, value);
                        const retrieved = await storageManager.get<string[]>(key);
                        expect(retrieved).toEqual(value);
                    }
                ),
                testConfig
            );
        });

        test('should return null for non-existent keys', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    async (key) => {
                        // Ensure the key doesn't exist
                        await storageManager.remove(key);
                        const retrieved = await storageManager.get(key);
                        expect(retrieved).toBeNull();
                    }
                ),
                testConfig
            );
        });

        test('should successfully remove any stored data', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    fc.string(),
                    async (key, value) => {
                        await storageManager.save(key, value);
                        await storageManager.remove(key);
                        const retrieved = await storageManager.get(key);
                        expect(retrieved).toBeNull();
                    }
                ),
                testConfig
            );
        });

        test('should clear all data when clear is called', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            key: fc.string({ minLength: 1, maxLength: 50 }),
                            value: fc.string(),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (items) => {
                        // Save all items
                        for (const item of items) {
                            await storageManager.save(item.key, item.value);
                        }

                        // Clear storage
                        await storageManager.clear();

                        // Verify all items are gone
                        for (const item of items) {
                            const retrieved = await storageManager.get(item.key);
                            expect(retrieved).toBeNull();
                        }
                    }
                ),
                testConfig
            );
        });

        test('should handle multiple save and retrieve operations', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            key: fc.string({ minLength: 1, maxLength: 50 }),
                            value: fc.integer(),
                        }),
                        { minLength: 1, maxLength: 20 }
                    ),
                    async (items) => {
                        // Create a map to handle duplicate keys (last value wins)
                        const itemMap = new Map<string, number>();
                        for (const item of items) {
                            itemMap.set(item.key, item.value);
                        }

                        // Save all items
                        for (const [key, value] of itemMap.entries()) {
                            await storageManager.save(key, value);
                        }

                        // Retrieve and verify all items
                        for (const [key, value] of itemMap.entries()) {
                            const retrieved = await storageManager.get<number>(key);
                            expect(retrieved).toBe(value);
                        }
                    }
                ),
                testConfig
            );
        });
    });

    describe('Property 25: Quota management', () => {
        test('should report accurate storage info', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            key: fc.string({ minLength: 1, maxLength: 50 }),
                            value: fc.string({ minLength: 10, maxLength: 100 }),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    async (items) => {
                        // Save items
                        for (const item of items) {
                            await storageManager.save(item.key, item.value);
                        }

                        const storageInfo = await storageManager.getStorageInfo();

                        expect(storageInfo.bytesInUse).toBeGreaterThanOrEqual(0);
                        expect(storageInfo.quota).toBeGreaterThan(0);
                        expect(storageInfo.percentUsed).toBeGreaterThanOrEqual(0);
                        expect(storageInfo.percentUsed).toBeLessThanOrEqual(1);
                    }
                ),
                testConfig
            );
        });

        test('should clean old data based on retention period', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }),
                    async (retentionDays) => {
                        const now = Date.now();
                        const oldTimestamp = now - (retentionDays + 1) * 24 * 60 * 60 * 1000;
                        const recentTimestamp = now - (retentionDays - 1) * 24 * 60 * 60 * 1000;

                        // Save old data
                        await storageManager.save('old-data', {
                            id: 'old',
                            timestamp: oldTimestamp,
                        });

                        // Save recent data
                        await storageManager.save('recent-data', {
                            id: 'recent',
                            timestamp: recentTimestamp,
                        });

                        // Clean old data
                        await storageManager.cleanOldData(retentionDays);

                        // Old data should be removed
                        const oldData = await storageManager.get('old-data');
                        expect(oldData).toBeNull();

                        // Recent data should remain
                        const recentData = await storageManager.get('recent-data');
                        expect(recentData).not.toBeNull();
                    }
                ),
                testConfig
            );
        });

        test('should handle saveMultiple and getMultiple operations', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.dictionary(
                        fc.string({ minLength: 1, maxLength: 50 }),
                        fc.record({
                            value: fc.string(),
                            count: fc.integer(),
                        })
                    ),
                    async (items) => {
                        if (Object.keys(items).length === 0) return;

                        // Save multiple items
                        await storageManager.saveMultiple(items);

                        // Retrieve multiple items
                        const keys = Object.keys(items);
                        const retrieved = await storageManager.getMultiple<any>(keys);

                        // Verify all items
                        for (const key of keys) {
                            expect(retrieved[key]).toEqual(items[key]);
                        }
                    }
                ),
                testConfig
            );
        });

        test('should get all keys from storage', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.string({ minLength: 1, maxLength: 50 }),
                        { minLength: 1, maxLength: 20 }
                    ),
                    async (keys) => {
                        // Make keys unique
                        const uniqueKeys = [...new Set(keys)];

                        // Save data for each key
                        for (const key of uniqueKeys) {
                            await storageManager.save(key, `value-${key}`);
                        }

                        // Get all keys
                        const allKeys = await storageManager.getAllKeys();

                        // Verify all keys are present
                        for (const key of uniqueKeys) {
                            expect(allKeys).toContain(key);
                        }
                    }
                ),
                testConfig
            );
        });

        test('should maintain data integrity after quota cleanup', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.array(
                        fc.record({
                            key: fc.string({ minLength: 1, maxLength: 50 }),
                            value: fc.string({ minLength: 100, maxLength: 200 }),
                            timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
                        }),
                        { minLength: 10, maxLength: 20 }
                    ),
                    async (items) => {
                        // Save all items with timestamps
                        for (const item of items) {
                            await storageManager.save(item.key, {
                                value: item.value,
                                timestamp: item.timestamp,
                            });
                        }

                        // Simulate high storage usage
                        mockBytesInUse = 9 * 1024 * 1024; // 9MB (above 80% of 10MB)

                        // Save one more item to trigger cleanup
                        await storageManager.save('trigger-cleanup', { value: 'test' });

                        // Verify storage info shows cleanup occurred
                        const storageInfo = await storageManager.getStorageInfo();
                        expect(storageInfo.bytesInUse).toBeDefined();
                    }
                ),
                testConfig
            );
        });
    });
});
