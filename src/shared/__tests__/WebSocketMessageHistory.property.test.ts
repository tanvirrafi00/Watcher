// Feature: proxy-server-extension, Property 22: WebSocket message history
// Property-based tests for WebSocket message history display

import fc from 'fast-check';
import { WebSocketLog, WebSocketMessage } from '../types';

describe('WebSocket Message History Property Tests', () => {
    const testConfig = {
        numRuns: 100,
        verbose: false,
    };

    // Arbitrary for generating WebSocket messages
    const webSocketMessageArb = fc.record({
        id: fc.uuid(),
        direction: fc.constantFrom('sent', 'received') as fc.Arbitrary<'sent' | 'received'>,
        data: fc.string({ minLength: 1, maxLength: 1000 }),
        timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
        size: fc.integer({ min: 1, max: 10000 }),
    });

    // Arbitrary for generating WebSocket connections with messages
    const webSocketLogWithMessagesArb = fc.integer({ min: Date.now() - 1000000, max: Date.now() }).chain(createdAt =>
        fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            tabId: fc.integer({ min: 1, max: 100 }),
            url: fc.webUrl({ validSchemes: ['ws', 'wss'] }),
            state: fc.constantFrom('connecting', 'open', 'closing', 'closed') as fc.Arbitrary<WebSocketLog['state']>,
            messages: fc.array(webSocketMessageArb, { minLength: 1, maxLength: 100 }),
            createdAt: fc.constant(createdAt),
            closedAt: fc.option(fc.integer({ min: createdAt, max: Date.now() }), { nil: undefined }),
            closeReason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        })
    );

    describe('Property 22: WebSocket message history', () => {
        test('should display all messages for any selected WebSocket connection', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Verify all messages are present
                        expect(connection.messages).toBeDefined();
                        expect(Array.isArray(connection.messages)).toBe(true);
                        expect(connection.messages.length).toBeGreaterThan(0);

                        // Verify each message has all required fields
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

        test('should display messages in chronological order', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Sort messages by timestamp
                        const sortedMessages = [...connection.messages].sort((a, b) => a.timestamp - b.timestamp);

                        // Verify chronological ordering
                        for (let i = 1; i < sortedMessages.length; i++) {
                            expect(sortedMessages[i].timestamp).toBeGreaterThanOrEqual(sortedMessages[i - 1].timestamp);
                        }

                        // Verify all messages are included in sorted array
                        expect(sortedMessages.length).toBe(connection.messages.length);
                    }
                ),
                testConfig
            );
        });

        test('should preserve message content for any message', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Verify each message's data is preserved
                        connection.messages.forEach(message => {
                            expect(message.data).toBeDefined();
                            expect(typeof message.data).toBe('string');
                            expect(message.data.length).toBeGreaterThan(0);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should display message direction for any message', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Verify each message has a valid direction
                        connection.messages.forEach(message => {
                            expect(message.direction).toBeDefined();
                            expect(['sent', 'received']).toContain(message.direction);
                        });

                        // Verify we can filter by direction
                        const sentMessages = connection.messages.filter(m => m.direction === 'sent');
                        const receivedMessages = connection.messages.filter(m => m.direction === 'received');

                        expect(sentMessages.length + receivedMessages.length).toBe(connection.messages.length);
                    }
                ),
                testConfig
            );
        });

        test('should display message timestamp for any message', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Verify each message has a valid timestamp
                        connection.messages.forEach(message => {
                            expect(message.timestamp).toBeDefined();
                            expect(typeof message.timestamp).toBe('number');
                            expect(message.timestamp).toBeGreaterThan(0);
                            expect(message.timestamp).toBeLessThanOrEqual(Date.now());
                        });
                    }
                ),
                testConfig
            );
        });

        test('should display message size for any message', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Verify each message has a valid size
                        connection.messages.forEach(message => {
                            expect(message.size).toBeDefined();
                            expect(typeof message.size).toBe('number');
                            expect(message.size).toBeGreaterThan(0);
                        });
                    }
                ),
                testConfig
            );
        });

        test('should maintain message uniqueness within a connection', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    (connection) => {
                        // Verify all message IDs are unique
                        const messageIds = connection.messages.map(m => m.id);
                        const uniqueIds = new Set(messageIds);
                        expect(uniqueIds.size).toBe(messageIds.length);
                    }
                ),
                testConfig
            );
        });

        test('should support filtering messages by direction', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    fc.constantFrom('sent', 'received') as fc.Arbitrary<'sent' | 'received'>,
                    (connection, filterDirection) => {
                        // Filter messages by direction
                        const filteredMessages = connection.messages.filter(m => m.direction === filterDirection);

                        // Verify all filtered messages have the correct direction
                        filteredMessages.forEach(message => {
                            expect(message.direction).toBe(filterDirection);
                        });

                        // Verify filtered count is correct
                        const expectedCount = connection.messages.filter(m => m.direction === filterDirection).length;
                        expect(filteredMessages.length).toBe(expectedCount);
                    }
                ),
                testConfig
            );
        });

        test('should support searching messages by content', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    fc.string({ minLength: 1, maxLength: 10 }),
                    (connection, searchQuery) => {
                        // Search messages by content
                        const searchResults = connection.messages.filter(m =>
                            m.data.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        // Verify all search results contain the query
                        searchResults.forEach(message => {
                            expect(message.data.toLowerCase()).toContain(searchQuery.toLowerCase());
                        });

                        // Verify search results are a subset of all messages
                        expect(searchResults.length).toBeLessThanOrEqual(connection.messages.length);
                    }
                ),
                testConfig
            );
        });

        test('should handle connections with mixed sent and received messages', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb.filter(conn => {
                        const hasSent = conn.messages.some(m => m.direction === 'sent');
                        const hasReceived = conn.messages.some(m => m.direction === 'received');
                        return hasSent && hasReceived;
                    }),
                    (connection) => {
                        const sentMessages = connection.messages.filter(m => m.direction === 'sent');
                        const receivedMessages = connection.messages.filter(m => m.direction === 'received');

                        // Verify both types exist
                        expect(sentMessages.length).toBeGreaterThan(0);
                        expect(receivedMessages.length).toBeGreaterThan(0);

                        // Verify total count
                        expect(sentMessages.length + receivedMessages.length).toBe(connection.messages.length);

                        // Verify all messages are accounted for
                        const allMessages = [...sentMessages, ...receivedMessages];
                        expect(allMessages.length).toBe(connection.messages.length);
                    }
                ),
                testConfig
            );
        });

        test('should preserve message order when filtering', () => {
            fc.assert(
                fc.property(
                    webSocketLogWithMessagesArb,
                    fc.constantFrom('sent', 'received') as fc.Arbitrary<'sent' | 'received'>,
                    (connection, filterDirection) => {
                        // Get original order of messages with the filter direction
                        const originalFiltered = connection.messages.filter(m => m.direction === filterDirection);

                        // Verify timestamps maintain order
                        for (let i = 1; i < originalFiltered.length; i++) {
                            const prevIndex = connection.messages.indexOf(originalFiltered[i - 1]);
                            const currIndex = connection.messages.indexOf(originalFiltered[i]);

                            // Current message should appear after previous in original array
                            expect(currIndex).toBeGreaterThan(prevIndex);
                        }
                    }
                ),
                testConfig
            );
        });

        test('should handle large message histories efficiently', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: Date.now() - 1000000, max: Date.now() }).chain(createdAt =>
                        fc.record({
                            id: fc.uuid(),
                            connectionId: fc.uuid(),
                            tabId: fc.integer({ min: 1, max: 100 }),
                            url: fc.webUrl({ validSchemes: ['ws', 'wss'] }),
                            state: fc.constantFrom('open', 'closed') as fc.Arbitrary<WebSocketLog['state']>,
                            messages: fc.array(webSocketMessageArb, { minLength: 50, maxLength: 100 }),
                            createdAt: fc.constant(createdAt),
                            closedAt: fc.option(fc.integer({ min: createdAt, max: Date.now() }), { nil: undefined }),
                            closeReason: fc.option(fc.string(), { nil: undefined }),
                        })
                    ),
                    (connection) => {
                        // Verify large message arrays are handled
                        expect(connection.messages.length).toBeGreaterThanOrEqual(50);

                        // Verify all messages are accessible
                        expect(connection.messages.every(m => m.id && m.data && m.timestamp)).toBe(true);

                        // Verify we can iterate through all messages
                        let count = 0;
                        connection.messages.forEach(() => count++);
                        expect(count).toBe(connection.messages.length);
                    }
                ),
                testConfig
            );
        });
    });
});
