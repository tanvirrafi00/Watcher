// Data validation functions for core models

import { Rule, RuleAction, RuleCondition, LogFilter, ExtensionSettings } from './types';

/**
 * Validates a Rule object
 */
export function validateRule(rule: Partial<Rule>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.name || rule.name.trim().length === 0) {
        errors.push('Rule name is required');
    }

    if (!rule.urlPattern || rule.urlPattern.trim().length === 0) {
        errors.push('URL pattern is required');
    }

    if (rule.matchType && !['glob', 'regex'].includes(rule.matchType)) {
        errors.push('Match type must be either "glob" or "regex"');
    }

    if (rule.matchType === 'regex') {
        try {
            new RegExp(rule.urlPattern || '');
        } catch (e) {
            errors.push('Invalid regex pattern');
        }
    }

    if (!rule.actions || rule.actions.length === 0) {
        errors.push('At least one action is required');
    } else {
        rule.actions.forEach((action, index) => {
            const actionErrors = validateRuleAction(action);
            if (!actionErrors.valid) {
                errors.push(`Action ${index + 1}: ${actionErrors.errors.join(', ')}`);
            }
        });
    }

    if (rule.priority !== undefined && (rule.priority < 0 || !Number.isInteger(rule.priority))) {
        errors.push('Priority must be a non-negative integer');
    }

    if (rule.conditions) {
        rule.conditions.forEach((condition, index) => {
            const conditionErrors = validateRuleCondition(condition);
            if (!conditionErrors.valid) {
                errors.push(`Condition ${index + 1}: ${conditionErrors.errors.join(', ')}`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates a RuleAction object
 */
export function validateRuleAction(action: RuleAction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validActionTypes: RuleAction['type'][] = ['modifyHeaders', 'redirect', 'block', 'mock', 'delay'];
    if (!validActionTypes.includes(action.type)) {
        errors.push(`Invalid action type: ${action.type}`);
    }

    switch (action.type) {
        case 'modifyHeaders':
            if (!action.config.headers || action.config.headers.length === 0) {
                errors.push('Headers array is required for modifyHeaders action');
            } else {
                action.config.headers.forEach((header, index) => {
                    if (!header.name || header.name.trim().length === 0) {
                        errors.push(`Header ${index + 1}: name is required`);
                    }
                    if (!['add', 'remove', 'set'].includes(header.operation)) {
                        errors.push(`Header ${index + 1}: operation must be "add", "remove", or "set"`);
                    }
                    if ((header.operation === 'add' || header.operation === 'set') && !header.value) {
                        errors.push(`Header ${index + 1}: value is required for "${header.operation}" operation`);
                    }
                });
            }
            break;

        case 'redirect':
            if (!action.config.redirectUrl || action.config.redirectUrl.trim().length === 0) {
                errors.push('Redirect URL is required for redirect action');
            } else {
                try {
                    new URL(action.config.redirectUrl);
                } catch (e) {
                    errors.push('Invalid redirect URL');
                }
            }
            break;

        case 'mock':
            if (!action.config.mockResponse) {
                errors.push('Mock response configuration is required for mock action');
            } else {
                const { status, headers, body } = action.config.mockResponse;
                if (!status || status < 100 || status > 599) {
                    errors.push('Mock response status must be between 100 and 599');
                }
                if (!headers || typeof headers !== 'object') {
                    errors.push('Mock response headers must be an object');
                }
                if (body === undefined || body === null) {
                    errors.push('Mock response body is required');
                }
            }
            break;

        case 'delay':
            if (!action.config.delayMs || action.config.delayMs < 0) {
                errors.push('Delay must be a positive number in milliseconds');
            }
            if (action.config.delayMs && action.config.delayMs > 30000) {
                errors.push('Delay cannot exceed 30 seconds');
            }
            break;

        case 'block':
            // No additional validation needed for block action
            break;
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates a RuleCondition object
 */
export function validateRuleCondition(condition: RuleCondition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validTypes: RuleCondition['type'][] = ['method', 'resourceType', 'header'];
    if (!validTypes.includes(condition.type)) {
        errors.push(`Invalid condition type: ${condition.type}`);
    }

    const validOperators: RuleCondition['operator'][] = ['equals', 'contains', 'regex'];
    if (!validOperators.includes(condition.operator)) {
        errors.push(`Invalid operator: ${condition.operator}`);
    }

    if (!condition.value || condition.value.trim().length === 0) {
        errors.push('Condition value is required');
    }

    if (condition.operator === 'regex') {
        try {
            new RegExp(condition.value);
        } catch (e) {
            errors.push('Invalid regex pattern in condition value');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates LogFilter object
 */
export function validateLogFilter(filter: LogFilter): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (filter.statusCodes) {
        filter.statusCodes.forEach((code) => {
            if (code < 100 || code > 599) {
                errors.push(`Invalid status code: ${code}`);
            }
        });
    }

    if (filter.timeRange) {
        if (filter.timeRange.start < 0 || filter.timeRange.end < 0) {
            errors.push('Time range values must be positive');
        }
        if (filter.timeRange.start > filter.timeRange.end) {
            errors.push('Time range start must be before end');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates ExtensionSettings object
 */
export function validateSettings(settings: Partial<ExtensionSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.retentionDays !== undefined) {
        if (settings.retentionDays < 1 || settings.retentionDays > 365) {
            errors.push('Retention days must be between 1 and 365');
        }
    }

    if (settings.maxStoredRequests !== undefined) {
        if (settings.maxStoredRequests < 10 || settings.maxStoredRequests > 10000) {
            errors.push('Max stored requests must be between 10 and 10000');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Sanitizes a string to prevent XSS attacks
 */
export function sanitizeString(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validates URL string
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates HTTP method
 */
export function isValidHttpMethod(method: string): boolean {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'];
    return validMethods.includes(method.toUpperCase());
}
