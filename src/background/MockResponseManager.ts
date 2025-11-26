// Mock Response Manager
// Handles declarativeNetRequest for mock responses

import { Rule } from '../shared/types';

/**
 * MockResponseManager
 * Manages mock responses using Chrome's declarativeNetRequest API
 */
export class MockResponseManager {
    private readonly RULE_ID_PREFIX = 'mock_';
    private activeMockRules = new Map<string, number>(); // ruleId -> declarativeNetRequest ruleId

    /**
     * Convert a Rule to declarativeNetRequest rule(s)
     */
    convertRuleToDeclarativeNetRequest(rule: Rule): chrome.declarativeNetRequest.Rule[] {
        const declarativeRules: chrome.declarativeNetRequest.Rule[] = [];

        // Only process mock actions
        const mockActions = rule.actions.filter(action => action.type === 'mock');

        if (mockActions.length === 0) {
            return declarativeRules;
        }

        mockActions.forEach((action, index) => {
            const mockConfig = action.config.mockResponse;
            if (!mockConfig) {
                return;
            }

            // Generate unique rule ID
            const declarativeRuleId = this.generateDeclarativeRuleId(rule.id, index);

            // Create condition based on URL pattern
            const condition = this.createCondition(rule.urlPattern, rule.matchType);

            // Create redirect action with data URL
            const dataUrl = this.createDataUrl(mockConfig);

            const declarativeRule: chrome.declarativeNetRequest.Rule = {
                id: declarativeRuleId,
                priority: rule.priority || 1,
                condition,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
                    redirect: {
                        url: dataUrl,
                    },
                },
            };

            declarativeRules.push(declarativeRule);
        });

        return declarativeRules;
    }

    /**
     * Register mock response rules dynamically
     */
    async registerMockRules(rules: Rule[]): Promise<void> {
        try {
            // Convert all rules to declarativeNetRequest rules
            const declarativeRules: chrome.declarativeNetRequest.Rule[] = [];
            const ruleMapping = new Map<number, string>(); // declarativeRuleId -> original ruleId

            rules.forEach(rule => {
                if (!rule.enabled) {
                    return;
                }

                const converted = this.convertRuleToDeclarativeNetRequest(rule);
                converted.forEach(declarativeRule => {
                    declarativeRules.push(declarativeRule);
                    ruleMapping.set(declarativeRule.id, rule.id);
                });
            });

            if (declarativeRules.length === 0) {
                console.log('MockResponseManager: No mock rules to register');
                return;
            }

            // Get existing dynamic rules
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const existingMockRuleIds = existingRules
                .filter(rule => this.isMockRule(rule.id))
                .map(rule => rule.id);

            // Remove old mock rules and add new ones
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: existingMockRuleIds,
                addRules: declarativeRules,
            });

            // Update active mock rules mapping
            this.activeMockRules.clear();
            ruleMapping.forEach((originalRuleId, declarativeRuleId) => {
                this.activeMockRules.set(originalRuleId, declarativeRuleId);
            });

            console.log(`MockResponseManager: Registered ${declarativeRules.length} mock rules`);
        } catch (error) {
            console.error('MockResponseManager: Failed to register mock rules', error);
            throw error;
        }
    }

    /**
     * Remove mock rules for a specific rule ID
     */
    async removeMockRules(ruleId: string): Promise<void> {
        try {
            const declarativeRuleId = this.activeMockRules.get(ruleId);
            if (!declarativeRuleId) {
                console.log(`MockResponseManager: No mock rule found for ${ruleId}`);
                return;
            }

            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [declarativeRuleId],
            });

            this.activeMockRules.delete(ruleId);
            console.log(`MockResponseManager: Removed mock rule for ${ruleId}`);
        } catch (error) {
            console.error('MockResponseManager: Failed to remove mock rules', error);
            throw error;
        }
    }

    /**
     * Clear all mock rules
     */
    async clearAllMockRules(): Promise<void> {
        try {
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const mockRuleIds = existingRules
                .filter(rule => this.isMockRule(rule.id))
                .map(rule => rule.id);

            if (mockRuleIds.length === 0) {
                console.log('MockResponseManager: No mock rules to clear');
                return;
            }

            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: mockRuleIds,
            });

            this.activeMockRules.clear();
            console.log(`MockResponseManager: Cleared ${mockRuleIds.length} mock rules`);
        } catch (error) {
            console.error('MockResponseManager: Failed to clear mock rules', error);
            throw error;
        }
    }

    /**
     * Create condition for declarativeNetRequest rule
     */
    private createCondition(
        urlPattern: string,
        matchType: 'glob' | 'regex'
    ): chrome.declarativeNetRequest.RuleCondition {
        if (matchType === 'regex') {
            return {
                regexFilter: urlPattern,
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                ],
            };
        } else {
            // Convert glob to URL filter
            // For simplicity, we'll use regexFilter for glob patterns too
            const regexPattern = this.globToRegex(urlPattern);
            return {
                regexFilter: regexPattern,
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                ],
            };
        }
    }

    /**
     * Convert glob pattern to regex
     */
    private globToRegex(pattern: string): string {
        return pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
    }

    /**
     * Create data URL for mock response
     */
    private createDataUrl(mockResponse: {
        status: number;
        headers: Record<string, string>;
        body: string;
    }): string {
        // For declarativeNetRequest, we can only redirect to data URLs
        // We'll encode the response body as a data URL
        const contentType = mockResponse.headers['Content-Type'] || 'text/plain';
        const encodedBody = encodeURIComponent(mockResponse.body);

        // Create data URL
        return `data:${contentType};charset=utf-8,${encodedBody}`;
    }

    /**
     * Generate unique declarativeNetRequest rule ID
     */
    private generateDeclarativeRuleId(ruleId: string, actionIndex: number): number {
        // Create a numeric ID from the rule ID and action index
        // Use a hash function to convert string to number
        const hash = this.hashString(`${this.RULE_ID_PREFIX}${ruleId}_${actionIndex}`);
        return Math.abs(hash) % 1000000; // Keep it within a reasonable range
    }

    /**
     * Check if a rule ID is a mock rule
     */
    private isMockRule(ruleId: number): boolean {
        // Check if this rule ID is in our active mock rules
        return Array.from(this.activeMockRules.values()).includes(ruleId);
    }

    /**
     * Simple hash function for strings
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    /**
     * Get active mock rules count
     */
    getActiveMockRulesCount(): number {
        return this.activeMockRules.size;
    }

    /**
     * Check if a rule has active mock
     */
    hasMockRule(ruleId: string): boolean {
        return this.activeMockRules.has(ruleId);
    }
}

// Export singleton instance
export const mockResponseManager = new MockResponseManager();
