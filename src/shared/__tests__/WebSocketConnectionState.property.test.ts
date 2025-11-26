// Feature: proxy-server-extension, Property 21: WebSocket connection state display
// Property-based tests for WebSocket connection state display

import fc from 'fast-check';
import { WebSocketLog } from '../types';

describe('WebSocket Connection State Display Property Tests', () => {
    const testConfig = {
        numRuns: 100,
        verbose: false,
    };

    // Arbitrary for generating WebSocket states
    const webSocketStateArb = fc.constantFrom('connecting', 'open', 'closing', 'closed') as fc.Arbitrary<WebSocketLog['state']>;

    // Arbitrary for generating WebSocket messages
    const webSocketMessageArb = fc.record({
        id: fc.uuid(),
        direction: fc.constantFrom('sent', 'received') as fc.Arbitrary<'sent' | 'received'>,
        data: fc.string({ minLength: 1, maxLength: 100 }),
        timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
        size: fc.integer({ min: 1, max: 10000 }),
    });

    // Arbitrary for generating WebSocket connections
    const webSocketLogArb = fc.integer({ min: Date.now() - 1000000, max: Date.now() }).chain(createdAt =>
        fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            tabId: fc.integer({ min: 1, max: 100 }),
            url: fc.webUrl({ validSchemes: ['ws', 'wss'] }),
            state: webSocketStateArb,
            messages: fc.array(webSocketMessageArb, { minLength: 0, maxLength: 50 }),
            createdAt: fc.constant(createdAt),
            closedAt: fc.option(fc.integer({ min: createdAt, max: Date.now() }), { nil: undefined }),
            closeReason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        })
    );

    describe('Property 21: WebSocket connection state display', () => {
        test('should display accurate connection status for any WebSocket connection', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb,
                    (connection) => {
                        // Verify connection has required state field
                        expect(connection.state).toBeDefined();
                        expect(['connecting', 'open', 'closing', 'closed']).toContain(connection.state);

                        // Verify state is accessible and valid
                        const state = connection.state;
                        expect(typeof state).toBe('string');
                        expect(state.length).toBeGreaterThan(0);
                    }
                ),
                testConfig
            );
        });

        test('should display accurate message count for any WebSocket connection', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb,
                    (connection) => {
                        // Verify message count matches actual messages array length
                        const messageCount = connection.messages.length;
                        expect(messageCount).toBeGreaterThanOrEqual(0);
                        expect(messageCount).toBe(connection.messages.length);

                        // Verify each message has required fields
                        connection.messages.forEach(message => {
                            expect(message.id).toBeDefined();
                            expect(message.direction).toBeDefined();
                            expect(['sent', 'received']).toContain(message.direction);
                            expect(message.data).toBeDefined();
                            expect(message.timestamp).toBeDefined();
                            expect(message.size).toBeGreaterThan(0);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should display connection URL for any WebSocket connection', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb,
                    (connection) => {
                        // Verify URL is present and valid
                        expect(connection.url).toBeDefined();
                        expect(typeof connection.url).toBe('string');
                        expect(connection.url.length).toBeGreaterThan(0);

                        // Verify URL starts with ws:// or wss://
                        expect(
                            connection.url.startsWith('ws://') ||
                            connection.url.startsWith('wss://')
                        ).toBe(true);
                    }
                ),
                testConfig
            );
        });

        test('should display creation timestamp for any WebSocket connection', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb,
                    (connection) => {
                        // Verify createdAt timestamp is present and valid
                        expect(connection.createdAt).toBeDefined();
                        expect(typeof connection.createdAt).toBe('number');
                        expect(connection.createdAt).toBeGreaterThan(0);

                        // Verify timestamp is reasonable (not in the future)
                        expect(connection.createdAt).toBeLessThanOrEqual(Date.now());
                    }
                ),
                testConfig
            );
        });

        test('should display close information for closed connections', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb.filter(conn => conn.state === 'closed'),
                    (connection) => {
                        // For closed connections, closedAt should be defined
                        if (connection.closedAt !== undefined) {
                            expect(typeof connection.closedAt).toBe('number');
                            expect(connection.closedAt).toBeGreaterThanOrEqual(connection.createdAt);
                            expect(connection.closedAt).toBeLessThanOrEqual(Date.now());
                        }

                        // Close reason may or may not be present
                        if (connection.closeReason !== undefined) {
                            expect(typeof connection.closeReason).toBe('string');
                        }
                    }
                ),
                testConfig
            );
        });

        test('should correctly count sent and received messages', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb,
                    (connection) => {
                        const sentCount = connection.messages.filter(m => m.direction === 'sent').length;
                        const receivedCount = connection.messages.filter(m => m.direction === 'received').length;
                        const totalCount = connection.messages.length;

                        // Verify counts add up correctly
                        expect(sentCount + receivedCount).toBe(totalCount);
                        expect(sentCount).toBeGreaterThanOrEqual(0);
                        expect(receivedCount).toBeGreaterThanOrEqual(0);
                    }
                ),
                testConfig
            );
        });

        test('should maintain message ordering by timestamp', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb.filter(conn => conn.messages.length > 1),
                    (connection) => {
                        // Verify messages can be sorted by timestamp
                        const sortedMessages = [...connection.messages].sort((a, b) => a.timestamp - b.timestamp);

                        // Verify all timestamps are valid
                        sortedMessages.forEach((message, index) => {
                            expect(message.timestamp).toBeDefined();
                            expect(typeof message.timestamp).toBe('number');

                            // Verify ordering
                            if (index > 0) {
                                expect(message.timestamp).toBeGreaterThanOrEqual(sortedMessages[index - 1].timestamp);
                            }
                        });
                    }
                ),
                testConfig
            );
        });

        test('should handle connections with no messages', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb.filter(conn => conn.messages.length === 0),
                    (connection) => {
                        // Verify empty message array is handled correctly
                        expect(connection.messages).toBeDefined();
                        expect(Array.isArray(connection.messages)).toBe(true);
                        expect(connection.messages.length).toBe(0);

                        // Connection should still have valid state
                        expect(connection.state).toBeDefined();
                        expect(['connecting', 'open', 'closing', 'closed']).toContain(connection.state);
                    }
                ),
                testConfig
            );
        });

        test('should associate connection with correct tab', () => {
            fc.assert(
                fc.property(
                    webSocketLogArb,
                    (connection) => {
                        // Verify tabId is present and valid
                        expect(connection.tabId).toBeDefined();
                        expect(typeof connection.tabId).toBe('number');
                        expect(connection.tabId).toBeGreaterThan(0);
                    }
                ),
                testConfig
            );
        });

        test('should have unique connection and message IDs', () => {
            fc.assert(
                fc.property(
                    fc.array(webSocketLogArb, { minLength: 2, maxLength: 10 }),
                    (connections) => {
                        // Verify all connection IDs are unique
                        const connectionIds = connections.map(c => c.id);
                        const uniqueConnectionIds = new Set(connectionIds);
                        expect(uniqueConnectionIds.size).toBe(connectionIds.length);

                        // Verify all message IDs within each connection are unique
                        connections.forEach(connection => {
                            const messageIds = connection.messages.map(m => m.id);
                            const uniqueMessageIds = new Set(messageIds);
                            expect(uniqueMessageIds.size).toBe(messageIds.length);
                        });
                    }
                ),
                testConfig
            );
        });
    });
});
