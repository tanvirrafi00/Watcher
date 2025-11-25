// Core data models and types for the Proxy Server Extension

/**
 * Request log entry capturing all details of a network request/response
 */
export interface RequestLog {
    id: string;
    tabId: number;
    url: string;
    method: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    timing: {
        startTime: number;
        endTime?: number;
        duration?: number;
    };
    type: chrome.webRequest.ResourceType;
    initiator?: string;
    error?: string;
    modified: boolean;
    appliedRules?: string[];
}

/**
 * Rule action types for traffic modification
 */
export type RuleActionType = 'modifyHeaders' | 'redirect' | 'block' | 'mock' | 'delay';

/**
 * Rule action configuration
 */
export interface RuleAction {
    type: RuleActionType;
    config: {
        // For modifyHeaders
        headers?: {
            name: string;
            value?: string;
            operation: 'add' | 'remove' | 'set';
        }[];

        // For redirect
        redirectUrl?: string;

        // For mock
        mockResponse?: {
            status: number;
            headers: Record<string, string>;
            body: string;
        };

        // For delay
        delayMs?: number;
    };
}

/**
 * Rule condition for additional filtering
 */
export interface RuleCondition {
    type: 'method' | 'resourceType' | 'header';
    operator: 'equals' | 'contains' | 'regex';
    value: string;
}

/**
 * Traffic modification rule
 */
export interface Rule {
    id: string;
    name: string;
    enabled: boolean;
    urlPattern: string;
    matchType: 'glob' | 'regex';
    actions: RuleAction[];
    conditions?: RuleCondition[];
    priority: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * WebSocket message entry
 */
export interface WebSocketMessage {
    id: string;
    direction: 'sent' | 'received';
    data: string;
    timestamp: number;
    size: number;
}

/**
 * WebSocket connection log
 */
export interface WebSocketLog {
    id: string;
    connectionId: string;
    tabId: number;
    url: string;
    state: 'connecting' | 'open' | 'closing' | 'closed';
    messages: WebSocketMessage[];
    createdAt: number;
    closedAt?: number;
    closeReason?: string;
}

/**
 * Filter criteria for request logs
 */
export interface LogFilter {
    search?: string;
    methods?: string[];
    statusCodes?: number[];
    resourceTypes?: chrome.webRequest.ResourceType[];
    domains?: string[];
    timeRange?: {
        start: number;
        end: number;
    };
    modifiedOnly?: boolean;
}

/**
 * Storage information
 */
export interface StorageInfo {
    bytesInUse: number;
    quota: number;
    percentUsed: number;
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
    retentionDays: number;
    maxStoredRequests: number;
    enabled: boolean;
    captureRequestBodies: boolean;
    captureResponseBodies: boolean;
}

/**
 * Message types for chrome.runtime communication
 */
export enum MessageType {
    REQUEST_CAPTURED = 'REQUEST_CAPTURED',
    RESPONSE_CAPTURED = 'RESPONSE_CAPTURED',
    WEBSOCKET_MESSAGE = 'WEBSOCKET_MESSAGE',
    RULE_UPDATED = 'RULE_UPDATED',
    RULE_DELETED = 'RULE_DELETED',
    CLEAR_LOGS = 'CLEAR_LOGS',
    GET_LOGS = 'GET_LOGS',
    GET_RULES = 'GET_RULES',
    SAVE_RULE = 'SAVE_RULE',
    DELETE_RULE = 'DELETE_RULE',
    TOGGLE_RULE = 'TOGGLE_RULE',
    EXPORT_DATA = 'EXPORT_DATA',
    GET_SETTINGS = 'GET_SETTINGS',
    UPDATE_SETTINGS = 'UPDATE_SETTINGS',
}

/**
 * Message payload for chrome.runtime communication
 */
export interface Message<T = any> {
    type: MessageType;
    payload?: T;
}

/**
 * Request details for internal processing
 */
export interface RequestDetails {
    requestId: string;
    url: string;
    method: string;
    tabId: number;
    type: chrome.webRequest.ResourceType;
    timeStamp: number;
    initiator?: string;
    frameId: number;
    parentFrameId: number;
}
