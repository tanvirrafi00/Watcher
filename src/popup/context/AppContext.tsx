import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RequestLog, Rule, MessageType, Message } from '../../shared/types';

interface AppState {
    requests: RequestLog[];
    rules: Rule[];
    selectedRequest: RequestLog | null;
    activeTab: number | null;
    loading: boolean;
}

interface AppContextType extends AppState {
    setRequests: (requests: RequestLog[]) => void;
    setRules: (rules: Rule[]) => void;
    setSelectedRequest: (request: RequestLog | null) => void;
    setActiveTab: (tabId: number | null) => void;
    addRequest: (request: RequestLog) => void;
    updateRequest: (requestId: string, updates: Partial<RequestLog>) => void;
    refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
};

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [state, setState] = useState<AppState>({
        requests: [],
        rules: [],
        selectedRequest: null,
        activeTab: null,
        loading: true,
    });

    // Load initial data
    useEffect(() => {
        loadInitialData();
    }, []);

    // Listen for real-time updates from background script
    useEffect(() => {
        const messageListener = (message: Message) => {
            switch (message.type) {
                case MessageType.REQUEST_CAPTURED:
                    addRequest(message.payload);
                    break;
                case MessageType.RESPONSE_CAPTURED:
                    updateRequest(message.payload.id, message.payload);
                    break;
                case MessageType.RULE_UPDATED:
                    refreshRules();
                    break;
                default:
                    break;
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    // Get active tab on mount
    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                setState(prev => ({ ...prev, activeTab: tabs[0].id! }));
            }
        });
    }, []);

    const loadInitialData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true }));

            // Load requests and rules from background
            const [requestsResponse, rulesResponse] = await Promise.all([
                chrome.runtime.sendMessage({ type: MessageType.GET_LOGS }),
                chrome.runtime.sendMessage({ type: MessageType.GET_RULES }),
            ]);

            setState(prev => ({
                ...prev,
                requests: requestsResponse?.logs || [],
                rules: rulesResponse?.rules || [],
                loading: false,
            }));
        } catch (error) {
            console.error('Failed to load initial data:', error);
            setState(prev => ({ ...prev, loading: false }));
        }
    };

    const refreshRules = async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: MessageType.GET_RULES });
            setState(prev => ({ ...prev, rules: response?.rules || [] }));
        } catch (error) {
            console.error('Failed to refresh rules:', error);
        }
    };

    const refreshData = async () => {
        await loadInitialData();
    };

    const setRequests = (requests: RequestLog[]) => {
        setState(prev => ({ ...prev, requests }));
    };

    const setRules = (rules: Rule[]) => {
        setState(prev => ({ ...prev, rules }));
    };

    const setSelectedRequest = (request: RequestLog | null) => {
        setState(prev => ({ ...prev, selectedRequest: request }));
    };

    const setActiveTab = (tabId: number | null) => {
        setState(prev => ({ ...prev, activeTab: tabId }));
    };

    const addRequest = (request: RequestLog) => {
        setState(prev => ({
            ...prev,
            requests: [request, ...prev.requests],
        }));
    };

    const updateRequest = (requestId: string, updates: Partial<RequestLog>) => {
        setState(prev => ({
            ...prev,
            requests: prev.requests.map(req =>
                req.id === requestId ? { ...req, ...updates } : req
            ),
        }));
    };

    const value: AppContextType = {
        ...state,
        setRequests,
        setRules,
        setSelectedRequest,
        setActiveTab,
        addRequest,
        updateRequest,
        refreshData,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
