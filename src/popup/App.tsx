import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';
import FilterControls from './components/FilterControls';
import RuleList from './components/RuleList';
import WebSocketList from './components/WebSocketList';
import WebSocketDetail from './components/WebSocketDetail';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import { LogFilter } from '../shared/types';
import { filterLogs, calculateBandwidth, formatBytes } from '../shared/utils';
import { ExportManager, ExportFormat } from '../shared/ExportManager';
import './App.css';

type ViewMode = 'requests' | 'rules' | 'websockets' | 'settings';

const AppContent: React.FC = () => {
    const {
        requests,
        rules,
        webSockets,
        loading,
        selectedRequest,
        setSelectedRequest,
        selectedWebSocket,
        setSelectedWebSocket,
        activeTab,
        refreshRules
    } = useAppContext();
    const [filter, setFilter] = useState<LogFilter>({});
    const [showAllTabs, setShowAllTabs] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('requests');

    if (loading) {
        return (
            <div className="app-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Filter by active tab if not showing all tabs
    const tabFilteredRequests = React.useMemo(() => {
        return showAllTabs || !activeTab
            ? requests
            : requests.filter(req => req.tabId === activeTab);
    }, [showAllTabs, activeTab, requests]);

    const filteredRequests = React.useMemo(() => {
        return filterLogs(tabFilteredRequests, filter);
    }, [tabFilteredRequests, filter]);

    // Filter WebSockets by active tab
    const tabFilteredWebSockets = React.useMemo(() => {
        return showAllTabs || !activeTab
            ? webSockets
            : webSockets.filter(ws => ws.tabId === activeTab);
    }, [showAllTabs, activeTab, webSockets]);

    // Calculate bandwidth
    const bandwidth = React.useMemo(() => {
        return calculateBandwidth(filteredRequests);
    }, [filteredRequests]);

    const handleClearFilters = () => {
        setFilter({});
    };

    const handleExport = (format: ExportFormat) => {
        const exportManager = new ExportManager();
        const logsToExport = viewMode === 'requests' ? filteredRequests : [];

        if (logsToExport.length === 0) {
            alert('No data to export');
            return;
        }

        try {
            const content = exportManager.exportLogs(logsToExport, format);
            const filename = exportManager.generateFilename(format);
            exportManager.downloadFile(content, filename);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>🔍 Proxy Server Extension</h1>
                <div className="header-stats">
                    <span className="stat">
                        <strong>{filteredRequests.length}</strong> / {requests.length} requests
                    </span>
                    <span className="stat">
                        <strong>{rules.filter(r => r.enabled).length}</strong> active rules
                    </span>
                    <span className="stat bandwidth-stat" title={`Sent: ${formatBytes(bandwidth.sent)} | Received: ${formatBytes(bandwidth.received)}`}>
                        📊 <strong>{formatBytes(bandwidth.total)}</strong>
                        <span className="bandwidth-detail">
                            ↑ {formatBytes(bandwidth.sent)} | ↓ {formatBytes(bandwidth.received)}
                        </span>
                    </span>
                    <button
                        className="tab-toggle-btn"
                        onClick={() => setShowAllTabs(!showAllTabs)}
                        title={showAllTabs ? 'Show current tab only' : 'Show all tabs'}
                    >
                        {showAllTabs ? '📑 All Tabs' : '📄 Current Tab'}
                    </button>
                    {viewMode === 'requests' && filteredRequests.length > 0 && (
                        <div className="export-buttons">
                            <button
                                className="export-btn"
                                onClick={() => handleExport('json')}
                                title="Export as JSON"
                            >
                                📥 JSON
                            </button>
                            <button
                                className="export-btn"
                                onClick={() => handleExport('har')}
                                title="Export as HAR"
                            >
                                📥 HAR
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <nav className="app-nav">
                <button
                    className={`nav-btn ${viewMode === 'requests' ? 'active' : ''}`}
                    onClick={() => setViewMode('requests')}
                >
                    📡 Requests
                </button>
                <button
                    className={`nav-btn ${viewMode === 'websockets' ? 'active' : ''}`}
                    onClick={() => setViewMode('websockets')}
                >
                    🔌 WebSockets
                </button>
                <button
                    className={`nav-btn ${viewMode === 'rules' ? 'active' : ''}`}
                    onClick={() => setViewMode('rules')}
                >
                    ⚙️ Rules
                </button>
                <button
                    className={`nav-btn ${viewMode === 'settings' ? 'active' : ''}`}
                    onClick={() => setViewMode('settings')}
                >
                    🔧 Settings
                </button>
            </nav>

            <main className="app-main">
                {viewMode === 'requests' ? (
                    <div className="main-content">
                        <div className="left-panel">
                            <FilterControls
                                filter={filter}
                                onFilterChange={setFilter}
                                onClearFilters={handleClearFilters}
                            />
                            <RequestList
                                requests={filteredRequests}
                                selectedRequest={selectedRequest}
                                onSelectRequest={setSelectedRequest}
                            />
                        </div>
                        <div className="right-panel">
                            <RequestDetail request={selectedRequest} />
                        </div>
                    </div>
                ) : viewMode === 'websockets' ? (
                    <div className="main-content">
                        <div className="left-panel">
                            <WebSocketList
                                connections={tabFilteredWebSockets}
                                selectedConnection={selectedWebSocket}
                                onSelectConnection={setSelectedWebSocket}
                            />
                        </div>
                        <div className="right-panel">
                            <WebSocketDetail connection={selectedWebSocket} />
                        </div>
                    </div>
                ) : viewMode === 'rules' ? (
                    <div className="rules-view">
                        <RuleList rules={rules} onRulesChange={refreshRules} />
                    </div>
                ) : (
                    <div className="settings-view">
                        <Settings />
                    </div>
                )}
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AppProvider>
                <AppContent />
            </AppProvider>
        </ErrorBoundary>
    );
};

export default App;
