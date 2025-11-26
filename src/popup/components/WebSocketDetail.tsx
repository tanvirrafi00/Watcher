import React, { useState, useMemo } from 'react';
import { WebSocketLog } from '../../shared/types';
import './WebSocketDetail.css';

interface WebSocketDetailProps {
    connection: WebSocketLog | null;
}

const WebSocketDetail: React.FC<WebSocketDetailProps> = ({ connection }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [directionFilter, setDirectionFilter] = useState<'all' | 'sent' | 'received'>('all');

    if (!connection) {
        return (
            <div className="websocket-detail empty">
                <div className="empty-state">
                    <p>No connection selected</p>
                    <small>Select a WebSocket connection to view message history</small>
                </div>
            </div>
        );
    }

    const filteredMessages = useMemo(() => {
        let messages = connection.messages;

        // Filter by direction
        if (directionFilter !== 'all') {
            messages = messages.filter(msg => msg.direction === directionFilter);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            messages = messages.filter(msg =>
                msg.data.toLowerCase().includes(query)
            );
        }

        return messages;
    }, [connection.messages, searchQuery, directionFilter]);

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const getStateIcon = (state: WebSocketLog['state']) => {
        switch (state) {
            case 'connecting':
                return '🔄';
            case 'open':
                return '🟢';
            case 'closing':
                return '🟡';
            case 'closed':
                return '🔴';
            default:
                return '⚪';
        }
    };

    const totalSent = connection.messages.filter(m => m.direction === 'sent').length;
    const totalReceived = connection.messages.filter(m => m.direction === 'received').length;

    return (
        <div className="websocket-detail">
            <div className="websocket-detail-header">
                <div className="connection-info">
                    <h3>
                        {getStateIcon(connection.state)} WebSocket Connection
                    </h3>
                    <div className="connection-url" title={connection.url}>
                        {connection.url}
                    </div>
                    <div className="connection-stats">
                        <span>↑ {totalSent} sent</span>
                        <span>↓ {totalReceived} received</span>
                        <span>Total: {connection.messages.length} messages</span>
                    </div>
                </div>

                <div className="message-filters">
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    <select
                        value={directionFilter}
                        onChange={(e) => setDirectionFilter(e.target.value as any)}
                        className="direction-filter"
                    >
                        <option value="all">All Messages</option>
                        <option value="sent">Sent Only</option>
                        <option value="received">Received Only</option>
                    </select>
                </div>
            </div>

            <div className="messages-container">
                {filteredMessages.length === 0 ? (
                    <div className="empty-messages">
                        <p>No messages found</p>
                        {searchQuery && <small>Try adjusting your search or filters</small>}
                    </div>
                ) : (
                    filteredMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`message-item ${message.direction}`}
                        >
                            <div className="message-header">
                                <span className="message-direction">
                                    {message.direction === 'sent' ? '↑ Sent' : '↓ Received'}
                                </span>
                                <span className="message-timestamp">
                                    {formatTimestamp(message.timestamp)}
                                </span>
                                <span className="message-size">
                                    {formatBytes(message.size)}
                                </span>
                                <button
                                    className="copy-btn"
                                    onClick={() => copyToClipboard(message.data)}
                                    title="Copy to clipboard"
                                >
                                    📋
                                </button>
                            </div>
                            <div className="message-content">
                                <pre>{message.data}</pre>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WebSocketDetail;
