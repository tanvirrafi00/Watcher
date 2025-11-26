import React, { useState, useEffect } from 'react';
import { Rule, RuleAction } from '../../shared/types';
import './RuleEditor.css';

interface RuleEditorProps {
    rule?: Rule;
    onSave: (rule: Partial<Rule>) => void;
    onCancel: () => void;
}

interface HeaderModification {
    name: string;
    value: string;
    operation: 'add' | 'remove' | 'set';
}

const RuleEditor: React.FC<RuleEditorProps> = ({ rule, onSave, onCancel }) => {
    const [name, setName] = useState(rule?.name || '');
    const [urlPattern, setUrlPattern] = useState(rule?.urlPattern || '');
    const [matchType, setMatchType] = useState<'glob' | 'regex'>(rule?.matchType || 'glob');
    const [enabled, setEnabled] = useState(rule?.enabled !== undefined ? rule.enabled : true);
    const [priority, setPriority] = useState(rule?.priority || 0);

    // Action configuration
    const [actionType, setActionType] = useState<RuleAction['type']>(rule?.actions[0]?.type || 'block');
    const [headers, setHeaders] = useState<HeaderModification[]>(
        rule?.actions[0]?.config?.headers?.map(h => ({
            name: h.name,
            value: h.value || '',
            operation: h.operation
        })) || [{ name: '', value: '', operation: 'add' }]
    );
    const [redirectUrl, setRedirectUrl] = useState(rule?.actions[0]?.config?.redirectUrl || '');
    const [mockStatus, setMockStatus] = useState(rule?.actions[0]?.config?.mockResponse?.status || 200);
    const [mockHeaders, setMockHeaders] = useState(
        rule?.actions[0]?.config?.mockResponse?.headers
            ? Object.entries(rule.actions[0].config.mockResponse.headers).map(([k, v]) => ({ key: k, value: v }))
            : [{ key: 'Content-Type', value: 'application/json' }]
    );
    const [mockBody, setMockBody] = useState(rule?.actions[0]?.config?.mockResponse?.body || '');
    const [delayMs, setDelayMs] = useState(rule?.actions[0]?.config?.delayMs || 1000);

    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Validate the form
    useEffect(() => {
        const errors: string[] = [];

        if (!name.trim()) {
            errors.push('Rule name is required');
        }

        if (!urlPattern.trim()) {
            errors.push('URL pattern is required');
        }

        // Validate regex pattern if matchType is regex
        if (matchType === 'regex') {
            try {
                new RegExp(urlPattern);
            } catch (e) {
                errors.push('Invalid regex pattern');
            }
        }

        // Action-specific validation
        if (actionType === 'modifyHeaders') {
            const validHeaders = headers.filter(h => h.name.trim());
            if (validHeaders.length === 0) {
                errors.push('At least one header modification is required');
            }
        }

        if (actionType === 'redirect') {
            if (!redirectUrl.trim()) {
                errors.push('Redirect URL is required');
            } else {
                try {
                    new URL(redirectUrl);
                } catch (e) {
                    errors.push('Invalid redirect URL');
                }
            }
        }

        if (actionType === 'mock') {
            if (mockStatus < 100 || mockStatus > 599) {
                errors.push('Mock status must be between 100 and 599');
            }
        }

        if (actionType === 'delay') {
            if (delayMs < 0 || delayMs > 30000) {
                errors.push('Delay must be between 0 and 30000ms');
            }
        }

        setValidationErrors(errors);
    }, [name, urlPattern, matchType, actionType, headers, redirectUrl, mockStatus, delayMs]);

    const handleAddHeader = () => {
        setHeaders([...headers, { name: '', value: '', operation: 'add' }]);
    };

    const handleRemoveHeader = (index: number) => {
        setHeaders(headers.filter((_, i) => i !== index));
    };

    const handleHeaderChange = (index: number, field: keyof HeaderModification, value: string) => {
        const newHeaders = [...headers];
        newHeaders[index] = { ...newHeaders[index], [field]: value };
        setHeaders(newHeaders);
    };

    const handleAddMockHeader = () => {
        setMockHeaders([...mockHeaders, { key: '', value: '' }]);
    };

    const handleRemoveMockHeader = (index: number) => {
        setMockHeaders(mockHeaders.filter((_, i) => i !== index));
    };

    const handleMockHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
        const newHeaders = [...mockHeaders];
        newHeaders[index] = { ...newHeaders[index], [field]: value };
        setMockHeaders(newHeaders);
    };

    const handleSave = () => {
        if (validationErrors.length > 0) {
            return;
        }

        // Build action config based on action type
        let actionConfig: RuleAction['config'] = {};

        switch (actionType) {
            case 'modifyHeaders':
                actionConfig.headers = headers.filter(h => h.name.trim());
                break;
            case 'redirect':
                actionConfig.redirectUrl = redirectUrl;
                break;
            case 'mock':
                actionConfig.mockResponse = {
                    status: mockStatus,
                    headers: Object.fromEntries(
                        mockHeaders.filter(h => h.key.trim()).map(h => [h.key, h.value])
                    ),
                    body: mockBody,
                };
                break;
            case 'delay':
                actionConfig.delayMs = delayMs;
                break;
            case 'block':
                // No config needed for block
                break;
        }

        const ruleData: Partial<Rule> = {
            id: rule?.id,
            name,
            urlPattern,
            matchType,
            priority,
            enabled,
            actions: [{ type: actionType, config: actionConfig }],
        };

        onSave(ruleData);
    };

    const isValid = validationErrors.length === 0;

    return (
        <div className="rule-editor">
            <div className="rule-editor-header">
                <h2>{rule ? 'Edit Rule' : 'Create New Rule'}</h2>
                <label className="toggle-switch">
                    <span className="toggle-label">Enabled</span>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                </label>
            </div>

            {validationErrors.length > 0 && (
                <div className="validation-errors">
                    {validationErrors.map((error, idx) => (
                        <div key={idx} className="error-message">⚠️ {error}</div>
                    ))}
                </div>
            )}

            <div className="form-section">
                <h3>Basic Information</h3>

                <div className="form-group">
                    <label>Rule Name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Block Analytics"
                        className={!name.trim() ? 'invalid' : ''}
                    />
                </div>

                <div className="form-group">
                    <label>URL Pattern *</label>
                    <input
                        type="text"
                        value={urlPattern}
                        onChange={(e) => setUrlPattern(e.target.value)}
                        placeholder={matchType === 'glob' ? '*.example.com/*' : '^https://.*\\.example\\.com/.*$'}
                        className={!urlPattern.trim() ? 'invalid' : ''}
                    />
                    <small className="form-hint">
                        {matchType === 'glob'
                            ? 'Use * for wildcards (e.g., *.google.com/*)'
                            : 'Use JavaScript regex syntax'}
                    </small>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Pattern Type</label>
                        <select value={matchType} onChange={(e) => setMatchType(e.target.value as 'glob' | 'regex')}>
                            <option value="glob">Glob Pattern</option>
                            <option value="regex">Regular Expression</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Priority</label>
                        <input
                            type="number"
                            value={priority}
                            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                            min="0"
                            max="1000"
                        />
                        <small className="form-hint">Higher priority rules execute first</small>
                    </div>
                </div>
            </div>

            <div className="form-section">
                <h3>Action Configuration</h3>

                <div className="form-group">
                    <label>Action Type</label>
                    <select value={actionType} onChange={(e) => setActionType(e.target.value as RuleAction['type'])}>
                        <option value="block">Block Request</option>
                        <option value="modifyHeaders">Modify Headers</option>
                        <option value="redirect">Redirect</option>
                        <option value="mock">Mock Response</option>
                        <option value="delay">Add Delay</option>
                    </select>
                </div>

                {/* Action-specific configuration */}
                {actionType === 'modifyHeaders' && (
                    <div className="action-config">
                        <label>Header Modifications</label>
                        {headers.map((header, index) => (
                            <div key={index} className="header-row">
                                <input
                                    type="text"
                                    placeholder="Header Name"
                                    value={header.name}
                                    onChange={(e) => handleHeaderChange(index, 'name', e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Header Value"
                                    value={header.value}
                                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                    disabled={header.operation === 'remove'}
                                />
                                <select
                                    value={header.operation}
                                    onChange={(e) => handleHeaderChange(index, 'operation', e.target.value)}
                                >
                                    <option value="add">Add</option>
                                    <option value="set">Set</option>
                                    <option value="remove">Remove</option>
                                </select>
                                <button
                                    type="button"
                                    className="btn-remove"
                                    onClick={() => handleRemoveHeader(index)}
                                    disabled={headers.length === 1}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn-add" onClick={handleAddHeader}>
                            + Add Header
                        </button>
                    </div>
                )}

                {actionType === 'redirect' && (
                    <div className="action-config">
                        <div className="form-group">
                            <label>Redirect URL *</label>
                            <input
                                type="text"
                                value={redirectUrl}
                                onChange={(e) => setRedirectUrl(e.target.value)}
                                placeholder="https://example.com/new-path"
                                className={!redirectUrl.trim() ? 'invalid' : ''}
                            />
                        </div>
                    </div>
                )}

                {actionType === 'mock' && (
                    <div className="action-config">
                        <div className="form-group">
                            <label>Response Status Code</label>
                            <input
                                type="number"
                                value={mockStatus}
                                onChange={(e) => setMockStatus(parseInt(e.target.value) || 200)}
                                min="100"
                                max="599"
                            />
                        </div>

                        <div className="form-group">
                            <label>Response Headers</label>
                            {mockHeaders.map((header, index) => (
                                <div key={index} className="header-row">
                                    <input
                                        type="text"
                                        placeholder="Header Name"
                                        value={header.key}
                                        onChange={(e) => handleMockHeaderChange(index, 'key', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Header Value"
                                        value={header.value}
                                        onChange={(e) => handleMockHeaderChange(index, 'value', e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="btn-remove"
                                        onClick={() => handleRemoveMockHeader(index)}
                                        disabled={mockHeaders.length === 1}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button type="button" className="btn-add" onClick={handleAddMockHeader}>
                                + Add Header
                            </button>
                        </div>

                        <div className="form-group">
                            <label>Response Body</label>
                            <textarea
                                value={mockBody}
                                onChange={(e) => setMockBody(e.target.value)}
                                placeholder='{"message": "Mocked response"}'
                                rows={6}
                            />
                        </div>
                    </div>
                )}

                {actionType === 'delay' && (
                    <div className="action-config">
                        <div className="form-group">
                            <label>Delay (milliseconds)</label>
                            <input
                                type="number"
                                value={delayMs}
                                onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
                                min="0"
                                max="30000"
                            />
                            <small className="form-hint">Maximum delay: 30 seconds</small>
                        </div>
                    </div>
                )}

                {actionType === 'block' && (
                    <div className="action-config">
                        <p className="info-message">
                            ℹ️ This rule will block all requests matching the URL pattern.
                        </p>
                    </div>
                )}
            </div>

            <div className="form-actions">
                <button className="btn-cancel" onClick={onCancel}>Cancel</button>
                <button className="btn-save" onClick={handleSave} disabled={!isValid}>
                    {rule ? 'Update' : 'Create'} Rule
                </button>
            </div>
        </div>
    );
};

export default RuleEditor;
