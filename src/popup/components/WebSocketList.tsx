import React from 'react';
import { WebSocketLog } from '../../shared/types';
import './WebSocketList.css';

interface WebSocketListProps {
    connections: WebSocketLog[];
    selectedConnection: WebSocketLog | null;
    onSelectConnection: (connection: WebSocketLog) => void;
}

const WebSocketList: React.FC<WebSocketListProps> = ({
    connections,
    selectedConnection,
    onSelectConnection,
}) => {
    if (connections.length === 0) {
        return (
            <div className="websocket-list empty">
                <div className="empty-state">
                    <p>No WebSocket connections</p>
                    <small>WebSocket connections will appear here when detected</small>
                </div>
            </div>
        );
    }

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

    const getStateLabel = (state: WebSocketLog['state']) => {
        return state.charAt(0).toUpperCase() + state.slice(1);
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    return (
        <div className="websocket-list">
            {connections.map((connection) => (
                <div
                    key={connection.id}
                    className={`websocket-item ${selectedConnection?.id === connection.id ? 'selected' : ''}`}
                    onClick={() => onSelectConnection(connection)}
                >
                    <div className="websocket-item-header">
                        <span className="websocket-state">
                            {getStateIcon(connection.state)} {getStateLabel(connection.state)}
                        </span>
                        <span className="websocket-message-count">
                            {connection.messages.length} messages
                        </span>
                    </div>
                    <div className="websocket-url" title={connection.url}>
                        {connection.url}
                    </div>
                    <div className="websocket-meta">
                        <span>Created: {formatTimestamp(connection.createdAt)}</span>
                        {connection.closedAt && (
                            <span>Closed: {formatTimestamp(connection.closedAt)}</span>
                        )}
                    </div>
                    {connection.closeReason && (
                        <div className="websocket-close-reason">
                            Reason: {connection.closeReason}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default WebSocketList;
