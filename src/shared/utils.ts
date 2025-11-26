// Utility functions for the extension

import { RequestLog, Rule, LogFilter } from './types';

/**
 * Generates a unique ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Formats timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/**
 * Matches URL against pattern (glob or regex)
 */
export function matchesPattern(url: string, pattern: string, matchType: 'glob' | 'regex'): boolean {
    if (matchType === 'regex') {
        try {
            const regex = new RegExp(pattern);
            return regex.test(url);
        } catch {
            return false;
        }
    } else {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*/g, '.*') // * matches any characters
            .replace(/\?/g, '.'); // ? matches single character

        try {
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(url);
        } catch {
            return false;
        }
    }
}

/**
 * Extracts domain from URL
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return '';
    }
}

/**
 * Filters request logs based on filter criteria
 */
export function filterLogs(logs: RequestLog[], filter: LogFilter): RequestLog[] {
    return logs.filter((log) => {
        // Search filter
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesSearch =
                log.url.toLowerCase().includes(searchLower) ||
                log.method.toLowerCase().includes(searchLower) ||
                (log.responseStatus?.toString() || '').includes(searchLower);

            if (!matchesSearch) return false;
        }

        // Method filter
        if (filter.methods && filter.methods.length > 0) {
            if (!filter.methods.includes(log.method)) return false;
        }

        // Status code filter
        if (filter.statusCodes && filter.statusCodes.length > 0) {
            if (!log.responseStatus || !filter.statusCodes.includes(log.responseStatus)) {
                return false;
            }
        }

        // Resource type filter
        if (filter.resourceTypes && filter.resourceTypes.length > 0) {
            if (!filter.resourceTypes.includes(log.type)) return false;
        }

        // Domain filter
        if (filter.domains && filter.domains.length > 0) {
            const domain = extractDomain(log.url);
            if (!filter.domains.includes(domain)) return false;
        }

        // Time range filter
        if (filter.timeRange) {
            if (log.timing.startTime < filter.timeRange.start ||
                log.timing.startTime > filter.timeRange.end) {
                return false;
            }
        }

        // Modified only filter
        if (filter.modifiedOnly && !log.modified) {
            return false;
        }

        return true;
    });
}

/**
 * Sorts rules by priority (higher priority first)
 */
export function sortRulesByPriority(rules: Rule[]): Rule[] {
    return [...rules].sort((a, b) => b.priority - a.priority);
}

/**
 * Compresses string data (simple implementation)
 */
export function compressData(data: string): string {
    // For now, just return the data as-is
    // In production, you might want to use a compression library
    return data;
}

/**
 * Decompresses string data
 */
export function decompressData(data: string): string {
    // For now, just return the data as-is
    return data;
}

/**
 * Calculates total bandwidth from request logs
 */
export function calculateBandwidth(logs: RequestLog[]): { sent: number; received: number; total: number } {
    let sent = 0;
    let received = 0;

    logs.forEach((log) => {
        if (log.requestBody) {
            sent += new Blob([log.requestBody]).size;
        }
        if (log.responseBody) {
            received += new Blob([log.responseBody]).size;
        }
    });

    return {
        sent,
        received,
        total: sent + received,
    };
}

/**
 * Truncates string to specified length
 */
export function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if object is empty
 */
export function isEmpty(obj: any): boolean {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttles a function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
