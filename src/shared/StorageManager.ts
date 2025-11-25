// Storage Manager for handling chrome.storage operations with quota management

import { StorageInfo } from './types';
import { compressData, decompressData } from './utils';

/**
 * Storage Manager class for managing browser storage with quota management
 */
export class StorageManager {
    private static readonly QUOTA_THRESHOLD = 0.8; // 80% threshold for cleanup
    private static readonly STORAGE_QUOTA = 10 * 1024 * 1024; // 10MB (chrome.storage.local quota)

    /**
     * Saves data to chrome.storage.local with automatic quota management
     */
    async save<T>(key: string, data: T): Promise<void> {
        try {
            // Check storage before saving
            const storageInfo = await this.getStorageInfo();

            // If storage is above threshold, clean up old data
            if (storageInfo.percentUsed >= StorageManager.QUOTA_THRESHOLD) {
                await this.performCleanup();
            }

            // Serialize and optionally compress data
            const serialized = JSON.stringify(data);
            const dataToStore = this.shouldCompress(serialized)
                ? compressData(serialized)
                : serialized;

            // Save to storage
            await chrome.storage.local.set({ [key]: dataToStore });
        } catch (error) {
            console.error(`StorageManager: Failed to save data for key "${key}"`, error);
            throw new Error(`Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Retrieves data from chrome.storage.local
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const result = await chrome.storage.local.get(key);

            if (!(key in result)) {
                return null;
            }

            // Deserialize and decompress if needed
            const data = typeof result[key] === 'string'
                ? decompressData(result[key])
                : result[key];

            return typeof data === 'string' ? JSON.parse(data) : data;
        } catch (error) {
            console.error(`StorageManager: Failed to get data for key "${key}"`, error);
            throw new Error(`Failed to retrieve data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Removes data from chrome.storage.local
     */
    async remove(key: string): Promise<void> {
        try {
            await chrome.storage.local.remove(key);
        } catch (error) {
            console.error(`StorageManager: Failed to remove data for key "${key}"`, error);
            throw new Error(`Failed to remove data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clears all data from chrome.storage.local
     */
    async clear(): Promise<void> {
        try {
            await chrome.storage.local.clear();
        } catch (error) {
            console.error('StorageManager: Failed to clear storage', error);
            throw new Error(`Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets current storage usage information
     */
    async getStorageInfo(): Promise<StorageInfo> {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            const quota = StorageManager.STORAGE_QUOTA;
            const percentUsed = bytesInUse / quota;

            return {
                bytesInUse,
                quota,
                percentUsed,
            };
        } catch (error) {
            console.error('StorageManager: Failed to get storage info', error);
            // Return default values if API fails
            return {
                bytesInUse: 0,
                quota: StorageManager.STORAGE_QUOTA,
                percentUsed: 0,
            };
        }
    }

    /**
     * Cleans old data based on retention policy
     */
    async cleanOldData(retentionDays: number): Promise<void> {
        try {
            const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

            // Get all keys
            const allData = await chrome.storage.local.get(null);
            const keysToRemove: string[] = [];

            // Check each key for timestamp-based data
            for (const [key, value] of Object.entries(allData)) {
                if (this.isTimestampedData(value)) {
                    const timestamp = this.extractTimestamp(value);
                    if (timestamp && timestamp < cutoffTime) {
                        keysToRemove.push(key);
                    }
                }
            }

            // Remove old keys
            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`StorageManager: Cleaned ${keysToRemove.length} old entries`);
            }
        } catch (error) {
            console.error('StorageManager: Failed to clean old data', error);
            throw new Error(`Failed to clean old data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Performs LRU eviction when storage reaches threshold
     */
    private async performCleanup(): Promise<void> {
        try {
            console.log('StorageManager: Performing cleanup due to quota threshold');

            // Get all data
            const allData = await chrome.storage.local.get(null);
            const entries = Object.entries(allData);

            // Sort by timestamp (oldest first)
            const sortedEntries = entries
                .filter(([_, value]) => this.isTimestampedData(value))
                .sort((a, b) => {
                    const timeA = this.extractTimestamp(a[1]) || 0;
                    const timeB = this.extractTimestamp(b[1]) || 0;
                    return timeA - timeB;
                });

            // Remove oldest 20% of entries
            const removeCount = Math.ceil(sortedEntries.length * 0.2);
            const keysToRemove = sortedEntries.slice(0, removeCount).map(([key]) => key);

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`StorageManager: Removed ${keysToRemove.length} oldest entries`);
            }

            // Check if we're still above threshold
            const storageInfo = await this.getStorageInfo();
            if (storageInfo.percentUsed >= StorageManager.QUOTA_THRESHOLD) {
                console.warn('StorageManager: Still above threshold after cleanup');
            }
        } catch (error) {
            console.error('StorageManager: Failed to perform cleanup', error);
            // Don't throw - cleanup failure shouldn't prevent saving
        }
    }

    /**
     * Determines if data should be compressed based on size
     */
    private shouldCompress(data: string): boolean {
        // Compress if data is larger than 1KB
        return data.length > 1024;
    }

    /**
     * Checks if data has timestamp information
     */
    private isTimestampedData(data: any): boolean {
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch {
                return false;
            }
        }

        return (
            data &&
            typeof data === 'object' &&
            (data.timestamp !== undefined ||
                data.createdAt !== undefined ||
                data.timing?.startTime !== undefined)
        );
    }

    /**
     * Extracts timestamp from data
     */
    private extractTimestamp(data: any): number | null {
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch {
                return null;
            }
        }

        if (!data || typeof data !== 'object') {
            return null;
        }

        return (
            data.timestamp ||
            data.createdAt ||
            data.timing?.startTime ||
            null
        );
    }

    /**
     * Gets all keys from storage
     */
    async getAllKeys(): Promise<string[]> {
        try {
            const allData = await chrome.storage.local.get(null);
            return Object.keys(allData);
        } catch (error) {
            console.error('StorageManager: Failed to get all keys', error);
            return [];
        }
    }

    /**
     * Gets multiple items from storage
     */
    async getMultiple<T>(keys: string[]): Promise<Record<string, T>> {
        try {
            const result = await chrome.storage.local.get(keys);
            const parsed: Record<string, T> = {};

            for (const key of keys) {
                if (result[key]) {
                    const data = typeof result[key] === 'string'
                        ? decompressData(result[key])
                        : result[key];
                    parsed[key] = typeof data === 'string' ? JSON.parse(data) : data;
                }
            }

            return parsed;
        } catch (error) {
            console.error('StorageManager: Failed to get multiple items', error);
            return {};
        }
    }

    /**
     * Saves multiple items to storage
     */
    async saveMultiple(items: Record<string, any>): Promise<void> {
        try {
            const storageInfo = await this.getStorageInfo();

            if (storageInfo.percentUsed >= StorageManager.QUOTA_THRESHOLD) {
                await this.performCleanup();
            }

            const processedItems: Record<string, any> = {};

            for (const [key, value] of Object.entries(items)) {
                const serialized = JSON.stringify(value);
                processedItems[key] = this.shouldCompress(serialized)
                    ? compressData(serialized)
                    : serialized;
            }

            await chrome.storage.local.set(processedItems);
        } catch (error) {
            console.error('StorageManager: Failed to save multiple items', error);
            throw new Error(`Failed to save multiple items: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Export singleton instance
export const storageManager = new StorageManager();
