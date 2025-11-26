import React, { useState, useEffect } from 'react';
import { ExtensionSettings, MessageType } from '../../shared/types';
import './Settings.css';

const DEFAULT_SETTINGS: ExtensionSettings = {
    retentionDays: 7,
    maxStoredRequests: 1000,
    enabled: true,
    captureRequestBodies: true,
    captureResponseBodies: true,
};

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
    const [storageInfo, setStorageInfo] = useState<{ bytesInUse: number; quota: number; percentUsed: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadSettings();
        loadStorageInfo();
    }, []);

    const loadSettings = async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: MessageType.GET_SETTINGS });
            if (response?.settings) {
                setSettings(response.settings);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            showMessage('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadStorageInfo = async () => {
        try {
            const result = await chrome.storage.local.getBytesInUse(null);
            const quota = 10 * 1024 * 1024; // 10MB quota for chrome.storage.local
            setStorageInfo({
                bytesInUse: result,
                quota,
                percentUsed: (result / quota) * 100,
            });
        } catch (error) {
            console.error('Failed to load storage info:', error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await chrome.runtime.sendMessage({
                type: MessageType.UPDATE_SETTINGS,
                payload: settings,
            });
            showMessage('Settings saved successfully', 'success');
            await loadStorageInfo();
        } catch (error) {
            console.error('Failed to save settings:', error);
            showMessage('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleClearHistory = async () => {
        if (!confirm('Are you sure you want to clear all traffic history? This cannot be undone.')) {
            return;
        }

        try {
            await chrome.runtime.sendMessage({ type: MessageType.CLEAR_LOGS });
            showMessage('History cleared successfully', 'success');
            await loadStorageInfo();
        } catch (error) {
            console.error('Failed to clear history:', error);
            showMessage('Failed to clear history', 'error');
        }
    };

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    if (loading) {
        return (
            <div className="settings-container">
                <div className="loading">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="settings-container">
            <h2>Settings</h2>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="settings-section">
                <h3>Extension Status</h3>
                <div className="setting-item">
                    <label className="setting-label">
                        <input
                            type="checkbox"
                            checked={settings.enabled}
                            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                        />
                        <span>Enable extension</span>
                    </label>
                    <p className="setting-description">
                        When disabled, the extension will not capture any traffic
                    </p>
                </div>
            </div>

            <div className="settings-section">
                <h3>Data Capture</h3>
                <div className="setting-item">
                    <label className="setting-label">
                        <input
                            type="checkbox"
                            checked={settings.captureRequestBodies}
                            onChange={(e) => setSettings({ ...settings, captureRequestBodies: e.target.checked })}
                        />
                        <span>Capture request bodies</span>
                    </label>
                    <p className="setting-description">
                        Capture and store request body content
                    </p>
                </div>
                <div className="setting-item">
                    <label className="setting-label">
                        <input
                            type="checkbox"
                            checked={settings.captureResponseBodies}
                            onChange={(e) => setSettings({ ...settings, captureResponseBodies: e.target.checked })}
                        />
                        <span>Capture response bodies</span>
                    </label>
                    <p className="setting-description">
                        Capture and store response body content
                    </p>
                </div>
            </div>

            <div className="settings-section">
                <h3>Storage</h3>
                <div className="setting-item">
                    <label className="setting-label">
                        <span>Retention period (days)</span>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            value={settings.retentionDays}
                            onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 7 })}
                            className="setting-input"
                        />
                    </label>
                    <p className="setting-description">
                        Automatically delete traffic data older than this many days
                    </p>
                </div>
                <div className="setting-item">
                    <label className="setting-label">
                        <span>Max stored requests</span>
                        <input
                            type="number"
                            min="100"
                            max="10000"
                            value={settings.maxStoredRequests}
                            onChange={(e) => setSettings({ ...settings, maxStoredRequests: parseInt(e.target.value) || 1000 })}
                            className="setting-input"
                        />
                    </label>
                    <p className="setting-description">
                        Maximum number of requests to keep in storage
                    </p>
                </div>
            </div>

            {storageInfo && (
                <div className="settings-section">
                    <h3>Storage Usage</h3>
                    <div className="storage-info">
                        <div className="storage-bar">
                            <div
                                className="storage-bar-fill"
                                style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
                            />
                        </div>
                        <div className="storage-stats">
                            <span>{formatBytes(storageInfo.bytesInUse)} / {formatBytes(storageInfo.quota)}</span>
                            <span>{storageInfo.percentUsed.toFixed(1)}% used</span>
                        </div>
                    </div>
                    <button className="btn-danger" onClick={handleClearHistory}>
                        Clear All History
                    </button>
                </div>
            )}

            <div className="settings-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

export default Settings;
