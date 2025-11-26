import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';
import FilterControls from './components/FilterControls';
import RuleList from './components/RuleList';
import WebSocketList from './components/WebSocketList';
import WebSocketDetail from './components/WebSocketDetail';
import { LogFilter } from '../shared/types';
import { filterLogs, calculateBandwidth, formatBytes } from '../shared/utils';
import './App.css';

type ViewMode = 'requests' | 'rules' | 'websockets';

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
    const tabFilteredRequests = showAllTabs || !activeTab
        ? requests
        : requests.filter(req => req.tabId === activeTab);

    const filteredRequests = filterLogs(tabFilteredRequests, filter);

    // Filter WebSockets by active tab
    const tabFilteredWebSockets = showAllTabs || !activeTab
        ? webSockets
        : webSockets.filter(ws => ws.tabId === activeTab);

    // Calculate bandwidth
    const bandwidth = React.useMemo(() => {
        return calculateBandwidth(filteredRequests);
    }, [filteredRequests]);

    const handleClearFilters = () => {
        setFilter({});
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
                ) : (
                    <div className="rules-view">
                        <RuleList rules={rules} onRulesChange={refreshRules} />
                    </div>
                )}
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

export default App;
