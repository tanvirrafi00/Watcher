import React, { useState } from 'react';
import { Rule, MessageType } from '../../shared/types';
import RuleEditor from './RuleEditor';
import './RuleList.css';

interface RuleListProps {
    rules: Rule[];
    onRulesChange: () => void;
}

const RuleList: React.FC<RuleListProps> = ({ rules, onRulesChange }) => {
    const [showEditor, setShowEditor] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | undefined>();

    const handleCreateNew = () => {
        setEditingRule(undefined);
        setShowEditor(true);
    };

    const handleEdit = (rule: Rule) => {
        setEditingRule(rule);
        setShowEditor(true);
    };

    const handleSave = async (ruleData: Partial<Rule>) => {
        try {
            await chrome.runtime.sendMessage({
                type: MessageType.SAVE_RULE,
                payload: ruleData,
            });
            setShowEditor(false);
            setEditingRule(undefined);
            onRulesChange();
        } catch (error) {
            console.error('Failed to save rule:', error);
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            await chrome.runtime.sendMessage({
                type: MessageType.DELETE_RULE,
                payload: { ruleId },
            });
            onRulesChange();
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    const handleToggle = async (ruleId: string, enabled: boolean) => {
        try {
            await chrome.runtime.sendMessage({
                type: MessageType.TOGGLE_RULE,
                payload: { ruleId, enabled },
            });
            onRulesChange();
        } catch (error) {
            console.error('Failed to toggle rule:', error);
        }
    };

    if (showEditor) {
        return (
            <RuleEditor
                rule={editingRule}
                onSave={handleSave}
                onCancel={() => {
                    setShowEditor(false);
                    setEditingRule(undefined);
                }}
            />
        );
    }

    return (
        <div className="rule-list">
            <div className="rule-list-header">
                <h2>Modification Rules</h2>
                <button className="btn-create" onClick={handleCreateNew}>
                    + Create Rule
                </button>
            </div>

            {rules.length === 0 ? (
                <div className="rule-list-empty">
                    <p>No rules created yet</p>
                    <small>Create rules to modify network traffic</small>
                </div>
            ) : (
                <div className="rules-container">
                    {rules.map(rule => (
                        <div key={rule.id} className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}>
                            <div className="rule-main">
                                <div className="rule-info">
                                    <h3>{rule.name}</h3>
                                    <p className="rule-pattern">
                                        <span className="pattern-type">{rule.matchType}</span>
                                        {rule.urlPattern}
                                    </p>
                                    <div className="rule-actions-list">
                                        {rule.actions.map((action, idx) => (
                                            <span key={idx} className="action-badge">
                                                {action.type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="rule-controls">
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={rule.enabled}
                                            onChange={(e) => handleToggle(rule.id, e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <button className="btn-edit" onClick={() => handleEdit(rule)}>
                                        ✏️
                                    </button>
                                    <button className="btn-delete" onClick={() => handleDelete(rule.id)}>
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RuleList;
