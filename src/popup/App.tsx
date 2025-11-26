import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';
import FilterControls from './components/FilterControls';
import { LogFilter } from '../shared/types';
import { filterLogs } from '../shared/utils';
import './App.css';

const AppContent: React.FC = () => {
    const { requests, rules, loading, selectedRequest, setSelectedRequest } = useAppContext();
    const [filter, setFilter] = useState<LogFilter>({});

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

    const filteredRequests = filterLogs(requests, filter);

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
                </div>
            </header>

            <main className="app-main">
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
