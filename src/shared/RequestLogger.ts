// Request Logger for managing traffic logs

import { RequestLog, LogFilter } from './types';
import { StorageManager } from './StorageManager';
import { filterLogs, generateId } from './utils';

/**
 * Request Logger class for managing traffic logs
 */
export class RequestLogger {
    private storageManager: StorageManager;
    private readonly LOGS_KEY = 'request_logs';
    private readonly MAX_LOGS_KEY = 'max_stored_requests';
    private readonly DEFAULT_MAX_LOGS = 1000;

    constructor(storageManager: StorageManager) {
        this.storageManager = storageManager;
    }

    /**
     * Logs a new request
     */
    async logRequest(log: Omit<RequestLog, 'id'>): Promise<string> {
        try {
            const id = generateId();
            const requestLog: RequestLog = {
                ...log,
                id,
            };

            // Get existing logs
            const logs = await this.getAllLogs();

            // Add new log
            logs.push(requestLog);

            // Enforce max logs limit
            const maxLogs = await this.getMaxLogs();
            if (logs.length > maxLogs) {
                // Remove oldest logs
                logs.splice(0, logs.length - maxLogs);
            }

            // Save updated logs
            await this.storageManager.save(this.LOGS_KEY, logs);

            return id;
        } catch (error) {
            console.error('RequestLogger: Failed to log request', error);
            throw new Error(`Failed to log request: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Updates a request with response data
     */
    async updateRequestWithResponse(
        requestId: string,
        responseData: Partial<RequestLog>
    ): Promise<void> {
        try {
            const logs = await this.getAllLogs();
            const logIndex = logs.findIndex(log => log.id === requestId);

            if (logIndex === -1) {
                console.warn(`RequestLogger: Request with ID ${requestId} not found`);
                return;
            }

            // Update the log (merge timing separately to avoid overwriting)
            const updatedLog = {
                ...logs[logIndex],
                ...responseData,
                timing: {
                    ...logs[logIndex].timing,
                    ...(responseData.timing || {}),
                },
            };

            // Calculate duration if both start and end times are present
            if (updatedLog.timing.startTime && updatedLog.timing.endTime) {
                updatedLog.timing.duration =
                    updatedLog.timing.endTime - updatedLog.timing.startTime;
            }

            logs[logIndex] = updatedLog;

            await this.storageManager.save(this.LOGS_KEY, logs);
        } catch (error) {
            console.error('RequestLogger: Failed to update request', error);
            throw new Error(`Failed to update request: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets logs for a specific tab
     */
    async getLogsForTab(tabId: number): Promise<RequestLog[]> {
        try {
            const logs = await this.getAllLogs();
            return logs.filter(log => log.tabId === tabId);
        } catch (error) {
            console.error('RequestLogger: Failed to get logs for tab', error);
            return [];
        }
    }

    /**
     * Gets all logs
     */
    async getAllLogs(): Promise<RequestLog[]> {
        try {
            const logs = await this.storageManager.get<RequestLog[]>(this.LOGS_KEY);
            return logs || [];
        } catch (error) {
            console.error('RequestLogger: Failed to get all logs', error);
            return [];
        }
    }

    /**
     * Searches logs with filter support
     */
    async searchLogs(query: string, filters?: LogFilter): Promise<RequestLog[]> {
        try {
            let logs = await this.getAllLogs();

            // Apply text search
            if (query && query.trim().length > 0) {
                const searchLower = query.toLowerCase();
                logs = logs.filter(log =>
                    log.url.toLowerCase().includes(searchLower) ||
                    log.method.toLowerCase().includes(searchLower) ||
                    (log.responseStatus?.toString() || '').includes(searchLower)
                );
            }

            // Apply filters
            if (filters) {
                logs = filterLogs(logs, filters);
            }

            return logs;
        } catch (error) {
            console.error('RequestLogger: Failed to search logs', error);
            return [];
        }
    }

    /**
     * Clears logs (optionally for a specific tab)
     */
    async clearLogs(tabId?: number): Promise<void> {
        try {
            if (tabId !== undefined) {
                // Clear logs for specific tab
                const logs = await this.getAllLogs();
                const filteredLogs = logs.filter(log => log.tabId !== tabId);
                await this.storageManager.save(this.LOGS_KEY, filteredLogs);
            } else {
                // Clear all logs
                await this.storageManager.remove(this.LOGS_KEY);
            }
        } catch (error) {
            console.error('RequestLogger: Failed to clear logs', error);
            throw new Error(`Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Cleans old data based on retention policy
     */
    async cleanOldData(retentionDays: number): Promise<void> {
        try {
            const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
            const logs = await this.getAllLogs();

            const filteredLogs = logs.filter(log =>
                log.timing.startTime >= cutoffTime
            );

            if (filteredLogs.length < logs.length) {
                await this.storageManager.save(this.LOGS_KEY, filteredLogs);
                console.log(`RequestLogger: Cleaned ${logs.length - filteredLogs.length} old logs`);
            }
        } catch (error) {
            console.error('RequestLogger: Failed to clean old data', error);
            throw new Error(`Failed to clean old data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets the maximum number of logs to store
     */
    private async getMaxLogs(): Promise<number> {
        try {
            const maxLogs = await this.storageManager.get<number>(this.MAX_LOGS_KEY);
            return maxLogs || this.DEFAULT_MAX_LOGS;
        } catch (error) {
            return this.DEFAULT_MAX_LOGS;
        }
    }

    /**
     * Sets the maximum number of logs to store
     */
    async setMaxLogs(maxLogs: number): Promise<void> {
        try {
            if (maxLogs < 10 || maxLogs > 10000) {
                throw new Error('Max logs must be between 10 and 10000');
            }
            await this.storageManager.save(this.MAX_LOGS_KEY, maxLogs);
        } catch (error) {
            console.error('RequestLogger: Failed to set max logs', error);
            throw new Error(`Failed to set max logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets a specific log by ID
     */
    async getLogById(id: string): Promise<RequestLog | null> {
        try {
            const logs = await this.getAllLogs();
            return logs.find(log => log.id === id) || null;
        } catch (error) {
            console.error('RequestLogger: Failed to get log by ID', error);
            return null;
        }
    }

    /**
     * Gets logs count
     */
    async getLogsCount(): Promise<number> {
        try {
            const logs = await this.getAllLogs();
            return logs.length;
        } catch (error) {
            console.error('RequestLogger: Failed to get logs count', error);
            return 0;
        }
    }

    /**
     * Gets logs count for a specific tab
     */
    async getLogsCountForTab(tabId: number): Promise<number> {
        try {
            const logs = await this.getLogsForTab(tabId);
            return logs.length;
        } catch (error) {
            console.error('RequestLogger: Failed to get logs count for tab', error);
            return 0;
        }
    }
}

// Export singleton instance
export const requestLogger = new RequestLogger(new StorageManager());
