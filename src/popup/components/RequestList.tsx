import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { RequestLog } from '../../shared/types';
import { formatBytes } from '../../shared/utils';
import './RequestList.css';

interface RequestListProps {
    requests: RequestLog[];
    selectedRequest: RequestLog | null;
    onSelectRequest: (request: RequestLog) => void;
}

const RequestList: React.FC<RequestListProps> = ({ requests, selectedRequest, onSelectRequest }) => {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const request = requests[index];
        const isSelected = selectedRequest?.id === request.id;

        const getStatusClass = (status?: number) => {
            if (!status) return 'status-pending';
            if (status >= 200 && status < 300) return 'status-success';
            if (status >= 300 && status < 400) return 'status-redirect';
            if (status >= 400 && status < 500) return 'status-client-error';
            if (status >= 500) return 'status-server-error';
            return 'status-unknown';
        };

        const formatDuration = (duration?: number) => {
            if (!duration) return '-';
            if (duration < 1000) return `${duration}ms`;
            return `${(duration / 1000).toFixed(2)}s`;
        };

        const calculateRequestSize = (req: RequestLog) => {
            let size = 0;
            if (req.requestBody) {
                size += new Blob([req.requestBody]).size;
            }
            if (req.responseBody) {
                size += new Blob([req.responseBody]).size;
            }
            return size;
        };

        return (
            <div
                style={style}
                className={`request-item ${isSelected ? 'selected' : ''} ${request.modified ? 'modified' : ''}`}
                onClick={() => onSelectRequest(request)}
            >
                <div className="request-method">{request.method}</div>
                <div className={`request-status ${getStatusClass(request.responseStatus)}`}>
                    {request.responseStatus || request.error ? (request.responseStatus || 'ERR') : '...'}
                </div>
                <div className="request-url" title={request.url}>
                    {new URL(request.url).pathname || '/'}
                </div>
                <div className="request-domain">{new URL(request.url).hostname}</div>
                <div className="request-time">{formatDuration(request.timing.duration)}</div>
                <div className="request-size">{formatBytes(calculateRequestSize(request))}</div>
                {request.modified && <div className="request-badge">Modified</div>}
            </div>
        );
    };

    if (requests.length === 0) {
        return (
            <div className="request-list-empty">
                <p>No requests captured yet</p>
                <small>Navigate to a website to see network traffic</small>
            </div>
        );
    }

    return (
        <div className="request-list">
            <div className="request-list-header">
                <div className="header-method">Method</div>
                <div className="header-status">Status</div>
                <div className="header-url">Path</div>
                <div className="header-domain">Domain</div>
                <div className="header-time">Time</div>
                <div className="header-size">Size</div>
            </div>
            <List
                height={500}
                itemCount={requests.length}
                itemSize={50}
                width="100%"
            >
                {Row}
            </List>
        </div>
    );
};

export default RequestList;
