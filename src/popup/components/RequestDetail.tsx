import React, { useState } from 'react';
import { RequestLog } from '../../shared/types';
import './RequestDetail.css';

interface RequestDetailProps {
    request: RequestLog | null;
}

const RequestDetail: React.FC<RequestDetailProps> = ({ request }) => {
    const [activeTab, setActiveTab] = useState<'headers' | 'body' | 'timing'>('headers');

    if (!request) {
        return (
            <div className="request-detail-empty">
                <p>Select a request to view details</p>
            </div>
        );
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const formatHeaders = (headers: Record<string, string>) => {
        return Object.entries(headers).map(([key, value]) => (
            <div key={key} className="header-row">
                <span className="header-key">{key}:</span>
                <span className="header-value">{value}</span>
                <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(`${key}: ${value}`)}
                    title="Copy"
                >
                    📋
                </button>
            </div>
        ));
    };

    const formatBody = (body?: string) => {
        if (!body) return <div className="no-data">No body data</div>;

        try {
            const parsed = JSON.parse(body);
            return <pre className="json-body">{JSON.stringify(parsed, null, 2)}</pre>;
        } catch {
            return <pre className="text-body">{body}</pre>;
        }
    };

    return (
        <div className="request-detail">
            <div className="detail-header">
                <div className="detail-title">
                    <span className="method-badge">{request.method}</span>
                    <span className="url-text" title={request.url}>{request.url}</span>
                </div>
                <div className="detail-meta">
                    <span className={`status-badge status-${Math.floor((request.responseStatus || 0) / 100)}`}>
                        {request.responseStatus || 'Pending'}
                    </span>
                    {request.modified && <span className="modified-badge">Modified</span>}
                    {request.error && <span className="error-badge">Error</span>}
                </div>
            </div>

            <div className="detail-tabs">
                <button
                    className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('headers')}
                >
                    Headers
                </button>
                <button
                    className={`tab ${activeTab === 'body' ? 'active' : ''}`}
                    onClick={() => setActiveTab('body')}
                >
                    Body
                </button>
                <button
                    className={`tab ${activeTab === 'timing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('timing')}
                >
                    Timing
                </button>
            </div>

            <div className="detail-content">
                {activeTab === 'headers' && (
                    <div className="headers-section">
                        <div className="section-group">
                            <h3>Request Headers</h3>
                            <div className="headers-list">
                                {formatHeaders(request.requestHeaders)}
                            </div>
                        </div>
                        {request.responseHeaders && (
                            <div className="section-group">
                                <h3>Response Headers</h3>
                                <div className="headers-list">
                                    {formatHeaders(request.responseHeaders)}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'body' && (
                    <div className="body-section">
                        <div className="section-group">
                            <h3>Request Body</h3>
                            {formatBody(request.requestBody)}
                        </div>
                        {request.responseBody && (
                            <div className="section-group">
                                <h3>Response Body</h3>
                                {formatBody(request.responseBody)}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'timing' && (
                    <div className="timing-section">
                        <div className="timing-row">
                            <span className="timing-label">Start Time:</span>
                            <span className="timing-value">
                                {new Date(request.timing.startTime).toLocaleString()}
                            </span>
                        </div>
                        {request.timing.endTime && (
                            <div className="timing-row">
                                <span className="timing-label">End Time:</span>
                                <span className="timing-value">
                                    {new Date(request.timing.endTime).toLocaleString()}
                                </span>
                            </div>
                        )}
                        {request.timing.duration && (
                            <div className="timing-row">
                                <span className="timing-label">Duration:</span>
                                <span className="timing-value">
                                    {request.timing.duration < 1000
                                        ? `${request.timing.duration}ms`
                                        : `${(request.timing.duration / 1000).toFixed(2)}s`}
                                </span>
                            </div>
                        )}
                        <div className="timing-row">
                            <span className="timing-label">Type:</span>
                            <span className="timing-value">{request.type}</span>
                        </div>
                        {request.initiator && (
                            <div className="timing-row">
                                <span className="timing-label">Initiator:</span>
                                <span className="timing-value">{request.initiator}</span>
                            </div>
                        )}
                        {request.appliedRules && request.appliedRules.length > 0 && (
                            <div className="timing-row">
                                <span className="timing-label">Applied Rules:</span>
                                <span className="timing-value">
                                    {request.appliedRules.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestDetail;
