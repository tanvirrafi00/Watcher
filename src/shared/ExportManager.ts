import { RequestLog } from './types';

/**
 * HAR (HTTP Archive) format types
 * Based on HAR 1.2 specification: http://www.softwareishard.com/blog/har-12-spec/
 */
interface HARLog {
    version: string;
    creator: {
        name: string;
        version: string;
    };
    entries: HAREntry[];
}

interface HAREntry {
    startedDateTime: string;
    time: number;
    request: HARRequest;
    response: HARResponse;
    cache: {};
    timings: HARTimings;
}

interface HARRequest {
    method: string;
    url: string;
    httpVersion: string;
    headers: HARHeader[];
    queryString: HARQueryString[];
    cookies: HARCookie[];
    headersSize: number;
    bodySize: number;
    postData?: {
        mimeType: string;
        text: string;
    };
}

interface HARResponse {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: HARHeader[];
    cookies: HARCookie[];
    content: {
        size: number;
        mimeType: string;
        text?: string;
    };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
}

interface HARHeader {
    name: string;
    value: string;
}

interface HARQueryString {
    name: string;
    value: string;
}

interface HARCookie {
    name: string;
    value: string;
}

interface HARTimings {
    send: number;
    wait: number;
    receive: number;
}

export type ExportFormat = 'json' | 'har';

export class ExportManager {
    /**
     * Export request logs in the specified format
     */
    exportLogs(logs: RequestLog[], format: ExportFormat): string {
        switch (format) {
            case 'json':
                return this.exportAsJSON(logs);
            case 'har':
                return this.exportAsHAR(logs);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Export logs as JSON format
     */
    private exportAsJSON(logs: RequestLog[]): string {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            totalRequests: logs.length,
            requests: logs.map(log => ({
                id: log.id,
                tabId: log.tabId,
                url: log.url,
                method: log.method,
                requestHeaders: log.requestHeaders,
                requestBody: log.requestBody,
                responseStatus: log.responseStatus,
                responseHeaders: log.responseHeaders,
                responseBody: log.responseBody,
                timing: log.timing,
                type: log.type,
                initiator: log.initiator,
                error: log.error,
                modified: log.modified,
                appliedRules: log.appliedRules,
            })),
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Export logs as HAR (HTTP Archive) format
     */
    private exportAsHAR(logs: RequestLog[]): string {
        const harLog: HARLog = {
            version: '1.2',
            creator: {
                name: 'Proxy Server Extension',
                version: '1.0.0',
            },
            entries: logs.map(log => this.convertToHAREntry(log)),
        };

        const har = {
            log: harLog,
        };

        return JSON.stringify(har, null, 2);
    }

    /**
     * Convert a RequestLog to HAR entry format
     */
    private convertToHAREntry(log: RequestLog): HAREntry {
        const startedDateTime = new Date(log.timing.startTime).toISOString();
        const time = log.timing.duration || 0;

        // Parse URL for query string
        const url = new URL(log.url);
        const queryString: HARQueryString[] = [];
        url.searchParams.forEach((value, name) => {
            queryString.push({ name, value });
        });

        // Convert headers to HAR format
        const requestHeaders: HARHeader[] = Object.entries(log.requestHeaders).map(([name, value]) => ({
            name,
            value,
        }));

        const responseHeaders: HARHeader[] = log.responseHeaders
            ? Object.entries(log.responseHeaders).map(([name, value]) => ({
                name,
                value,
            }))
            : [];

        // Calculate sizes
        const requestBodySize = log.requestBody ? new Blob([log.requestBody]).size : 0;
        const responseBodySize = log.responseBody ? new Blob([log.responseBody]).size : 0;
        const requestHeadersSize = this.calculateHeadersSize(requestHeaders);
        const responseHeadersSize = this.calculateHeadersSize(responseHeaders);

        // Get content type
        const contentType = log.responseHeaders?.['content-type'] || 'application/octet-stream';

        const entry: HAREntry = {
            startedDateTime,
            time,
            request: {
                method: log.method,
                url: log.url,
                httpVersion: 'HTTP/1.1',
                headers: requestHeaders,
                queryString,
                cookies: [],
                headersSize: requestHeadersSize,
                bodySize: requestBodySize,
            },
            response: {
                status: log.responseStatus || 0,
                statusText: this.getStatusText(log.responseStatus || 0),
                httpVersion: 'HTTP/1.1',
                headers: responseHeaders,
                cookies: [],
                content: {
                    size: responseBodySize,
                    mimeType: contentType,
                    text: log.responseBody,
                },
                redirectURL: '',
                headersSize: responseHeadersSize,
                bodySize: responseBodySize,
            },
            cache: {},
            timings: {
                send: 0,
                wait: time,
                receive: 0,
            },
        };

        // Add request body if present
        if (log.requestBody) {
            entry.request.postData = {
                mimeType: log.requestHeaders['content-type'] || 'application/octet-stream',
                text: log.requestBody,
            };
        }

        return entry;
    }

    /**
     * Calculate approximate size of headers in bytes
     */
    private calculateHeadersSize(headers: HARHeader[]): number {
        return headers.reduce((total, header) => {
            return total + header.name.length + header.value.length + 4; // +4 for ": " and "\r\n"
        }, 0);
    }

    /**
     * Get HTTP status text from status code
     */
    private getStatusText(status: number): string {
        const statusTexts: Record<number, string> = {
            200: 'OK',
            201: 'Created',
            204: 'No Content',
            301: 'Moved Permanently',
            302: 'Found',
            304: 'Not Modified',
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable',
        };

        return statusTexts[status] || 'Unknown';
    }

    /**
     * Trigger browser download with the exported data
     */
    downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate filename with timestamp
     */
    generateFilename(format: ExportFormat): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        return `proxy-export-${timestamp}.${format}`;
    }
}
