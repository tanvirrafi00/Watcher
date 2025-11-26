// Content Script Entry Point
// Implements WebSocket monitoring by intercepting native WebSocket API

import { MessageType, WebSocketLog, WebSocketMessage } from '../shared/types';
import { generateId } from '../shared/utils';

/**
 * WebSocket Monitor
 * Intercepts and monitors WebSocket connections in web pages
 */
class WebSocketMonitor {
    private connections = new Map<WebSocket, WebSocketLog>();
    private originalWebSocket: typeof WebSocket;

    constructor() {
        this.originalWebSocket = window.WebSocket;
    }

    /**
     * Initialize WebSocket monitoring
     */
    initialize(): void {
        console.log('WebSocketMonitor: Initializing WebSocket interception');

        // Store reference to original WebSocket
        const OriginalWebSocket = this.originalWebSocket;
        const monitor = this;

        // Override native WebSocket constructor
        window.WebSocket = function (
            url: string | URL,
            protocols?: string | string[]
        ): WebSocket {
            console.log('WebSocketMonitor: Intercepting WebSocket connection to', url);

            // Create actual WebSocket using original constructor
            const ws = new OriginalWebSocket(url, protocols);

            // Initialize connection log
            const connectionLog: WebSocketLog = {
                id: generateId(),
                connectionId: generateId(),
                tabId: -1, // Will be set by background script
                url: url.toString(),
                state: 'connecting',
                messages: [],
                createdAt: Date.now(),
            };

            monitor.connections.set(ws, connectionLog);

            // Wrap WebSocket methods and events
            monitor.wrapWebSocket(ws, connectionLog);

            // Send handshake info to background
            monitor.sendToBackground({
                type: MessageType.WEBSOCKET_MESSAGE,
                payload: {
                    event: 'handshake',
                    connectionLog,
                },
            });

            return ws;
        } as any;

        // Copy static properties from original WebSocket
        Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
        window.WebSocket.prototype = OriginalWebSocket.prototype;

        // Copy readonly constants using Object.defineProperty
        Object.defineProperty(window.WebSocket, 'CONNECTING', { value: OriginalWebSocket.CONNECTING });
        Object.defineProperty(window.WebSocket, 'OPEN', { value: OriginalWebSocket.OPEN });
        Object.defineProperty(window.WebSocket, 'CLOSING', { value: OriginalWebSocket.CLOSING });
        Object.defineProperty(window.WebSocket, 'CLOSED', { value: OriginalWebSocket.CLOSED });

        console.log('WebSocketMonitor: WebSocket interception initialized');
    }

    /**
     * Wrap WebSocket instance to monitor messages and state changes
     */
    private wrapWebSocket(ws: WebSocket, connectionLog: WebSocketLog): void {
        // Wrap send method
        const originalSend = ws.send.bind(ws);
        ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
            this.logMessage(ws, connectionLog, 'sent', data);
            return originalSend(data);
        };

        // Wrap onopen event
        const originalOnOpen = ws.onopen;
        ws.onopen = (event: Event) => {
            connectionLog.state = 'open';
            this.sendConnectionUpdate(connectionLog);

            if (originalOnOpen) {
                originalOnOpen.call(ws, event);
            }
        };

        // Wrap onmessage event
        const originalOnMessage = ws.onmessage;
        ws.onmessage = (event: MessageEvent) => {
            this.logMessage(ws, connectionLog, 'received', event.data);

            if (originalOnMessage) {
                originalOnMessage.call(ws, event);
            }
        };

        // Wrap onclose event
        const originalOnClose = ws.onclose;
        ws.onclose = (event: CloseEvent) => {
            connectionLog.state = 'closed';
            connectionLog.closedAt = Date.now();
            connectionLog.closeReason = `${event.code}: ${event.reason}`;
            this.sendConnectionUpdate(connectionLog);
            this.connections.delete(ws);

            if (originalOnClose) {
                originalOnClose.call(ws, event);
            }
        };

        // Wrap onerror event
        const originalOnError = ws.onerror;
        ws.onerror = (event: Event) => {
            console.error('WebSocketMonitor: WebSocket error', event);

            if (originalOnError) {
                originalOnError.call(ws, event);
            }
        };

        // Also wrap addEventListener for more robust monitoring
        const originalAddEventListener = ws.addEventListener.bind(ws);
        ws.addEventListener = (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions
        ) => {
            if (type === 'message' && typeof listener === 'function') {
                const wrappedListener = (event: MessageEvent) => {
                    this.logMessage(ws, connectionLog, 'received', event.data);
                    listener(event);
                };
                return originalAddEventListener(type, wrappedListener, options);
            }

            return originalAddEventListener(type, listener, options);
        };
    }

    /**
     * Log a WebSocket message
     */
    private logMessage(
        _ws: WebSocket,
        connectionLog: WebSocketLog,
        direction: 'sent' | 'received',
        data: any
    ): void {
        try {
            // Convert data to string
            let messageData: string;
            if (typeof data === 'string') {
                messageData = data;
            } else if (data instanceof Blob) {
                messageData = '[Blob data]';
            } else if (data instanceof ArrayBuffer) {
                messageData = '[ArrayBuffer data]';
            } else {
                messageData = String(data);
            }

            // Create message log
            const message: WebSocketMessage = {
                id: generateId(),
                direction,
                data: messageData,
                timestamp: Date.now(),
                size: new Blob([messageData]).size,
            };

            // Add to connection log
            connectionLog.messages.push(message);

            // Send to background
            this.sendToBackground({
                type: MessageType.WEBSOCKET_MESSAGE,
                payload: {
                    event: 'message',
                    connectionId: connectionLog.connectionId,
                    message,
                },
            });

            console.log(
                `WebSocketMonitor: ${direction} message on ${connectionLog.url}`,
                messageData.substring(0, 100)
            );
        } catch (error) {
            console.error('WebSocketMonitor: Error logging message', error);
        }
    }

    /**
     * Send connection state update to background
     */
    private sendConnectionUpdate(connectionLog: WebSocketLog): void {
        this.sendToBackground({
            type: MessageType.WEBSOCKET_MESSAGE,
            payload: {
                event: 'stateChange',
                connectionLog,
            },
        });
    }

    /**
     * Send data to background service worker
     */
    private sendToBackground(message: any): void {
        try {
            chrome.runtime.sendMessage(message, (_response) => {
                if (chrome.runtime.lastError) {
                    console.error(
                        'WebSocketMonitor: Error sending to background',
                        chrome.runtime.lastError
                    );
                }
            });
        } catch (error) {
            console.error('WebSocketMonitor: Failed to send message to background', error);
        }
    }

    /**
     * Get active connections count
     */
    getActiveConnectionsCount(): number {
        return this.connections.size;
    }

    /**
     * Get all connection logs
     */
    getConnectionLogs(): WebSocketLog[] {
        return Array.from(this.connections.values());
    }
}

// Initialize WebSocket monitor
const webSocketMonitor = new WebSocketMonitor();
webSocketMonitor.initialize();

console.log('Proxy Server Extension - Content Script initialized');

// Export for testing
export { WebSocketMonitor, webSocketMonitor };
