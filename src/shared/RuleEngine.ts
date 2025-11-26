// Rule Engine for managing modification rules

import { Rule, RequestDetails } from './types';
import { StorageManager } from './StorageManager';
import { validateRule } from './validation';
import { matchesPattern, generateId, sortRulesByPriority } from './utils';

/**
 * Rule Engine class for managing modification rules
 */
export class RuleEngine {
    private storageManager: StorageManager;
    private readonly RULES_KEY = 'modification_rules';

    constructor(storageManager: StorageManager) {
        this.storageManager = storageManager;
    }

    /**
     * Saves a rule (creates new or updates existing)
     */
    async saveRule(rule: Partial<Rule>): Promise<string> {
        try {
            // Validate rule
            const validation = validateRule(rule);
            if (!validation.valid) {
                throw new Error(`Invalid rule: ${validation.errors.join(', ')}`);
            }

            // Get existing rules
            const rules = await this.getRules();

            // Check if updating existing rule
            if (rule.id) {
                const index = rules.findIndex(r => r.id === rule.id);
                if (index !== -1) {
                    // Update existing rule
                    rules[index] = {
                        ...rules[index],
                        ...rule,
                        updatedAt: Date.now(),
                    } as Rule;
                    await this.storageManager.save(this.RULES_KEY, rules);
                    return rule.id;
                }
            }

            // Create new rule
            const newRule: Rule = {
                id: rule.id || generateId(),
                name: rule.name!,
                enabled: rule.enabled !== undefined ? rule.enabled : true,
                urlPattern: rule.urlPattern!,
                matchType: rule.matchType || 'glob',
                actions: rule.actions!,
                conditions: rule.conditions,
                priority: rule.priority !== undefined ? rule.priority : 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            rules.push(newRule);
            await this.storageManager.save(this.RULES_KEY, rules);

            return newRule.id;
        } catch (error) {
            console.error('RuleEngine: Failed to save rule', error);
            throw new Error(`Failed to save rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Deletes a rule
     */
    async deleteRule(ruleId: string): Promise<void> {
        try {
            const rules = await this.getRules();
            const filteredRules = rules.filter(r => r.id !== ruleId);

            if (filteredRules.length === rules.length) {
                console.warn(`RuleEngine: Rule with ID ${ruleId} not found`);
                return;
            }

            await this.storageManager.save(this.RULES_KEY, filteredRules);
        } catch (error) {
            console.error('RuleEngine: Failed to delete rule', error);
            throw new Error(`Failed to delete rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets all rules
     */
    async getRules(): Promise<Rule[]> {
        try {
            const rules = await this.storageManager.get<Rule[]>(this.RULES_KEY);
            return rules || [];
        } catch (error) {
            console.error('RuleEngine: Failed to get rules', error);
            return [];
        }
    }

    /**
     * Gets a specific rule by ID
     */
    async getRuleById(id: string): Promise<Rule | null> {
        try {
            const rules = await this.getRules();
            return rules.find(r => r.id === id) || null;
        } catch (error) {
            console.error('RuleEngine: Failed to get rule by ID', error);
            return null;
        }
    }

    /**
     * Evaluates which rules match a request
     */
    async evaluateRequest(requestDetails: RequestDetails): Promise<Rule[]> {
        try {
            const rules = await this.getRules();

            // Filter enabled rules
            const enabledRules = rules.filter(r => r.enabled);

            // Find matching rules
            const matchingRules = enabledRules.filter(rule => {
                // Check URL pattern
                if (!matchesPattern(requestDetails.url, rule.urlPattern, rule.matchType)) {
                    return false;
                }

                // Check additional conditions
                if (rule.conditions && rule.conditions.length > 0) {
                    return this.evaluateConditions(rule.conditions, requestDetails);
                }

                return true;
            });

            // Sort by priority (higher priority first)
            return sortRulesByPriority(matchingRules);
        } catch (error) {
            console.error('RuleEngine: Failed to evaluate request', error);
            return [];
        }
    }

    /**
     * Toggles a rule's enabled state
     */
    async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
        try {
            const rules = await this.getRules();
            const ruleIndex = rules.findIndex(r => r.id === ruleId);

            if (ruleIndex === -1) {
                throw new Error(`Rule with ID ${ruleId} not found`);
            }

            rules[ruleIndex].enabled = enabled;
            rules[ruleIndex].updatedAt = Date.now();

            await this.storageManager.save(this.RULES_KEY, rules);
        } catch (error) {
            console.error('RuleEngine: Failed to toggle rule', error);
            throw new Error(`Failed to toggle rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets enabled rules count
     */
    async getEnabledRulesCount(): Promise<number> {
        try {
            const rules = await this.getRules();
            return rules.filter(r => r.enabled).length;
        } catch (error) {
            console.error('RuleEngine: Failed to get enabled rules count', error);
            return 0;
        }
    }

    /**
     * Clears all rules
     */
    async clearAllRules(): Promise<void> {
        try {
            await this.storageManager.remove(this.RULES_KEY);
        } catch (error) {
            console.error('RuleEngine: Failed to clear all rules', error);
            throw new Error(`Failed to clear all rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Evaluates conditions for a request
     */
    private evaluateConditions(conditions: Rule['conditions'], requestDetails: RequestDetails): boolean {
        if (!conditions) return true;

        return conditions.every(condition => {
            switch (condition.type) {
                case 'method':
                    return this.evaluateCondition(requestDetails.method, condition.operator, condition.value);

                case 'resourceType':
                    return this.evaluateCondition(requestDetails.type, condition.operator, condition.value);

                case 'header':
                    // For header conditions, we'd need access to headers
                    // This is a simplified implementation
                    return true;

                default:
                    return true;
            }
        });
    }

    /**
     * Evaluates a single condition
     */
    private evaluateCondition(actual: string, operator: 'equals' | 'contains' | 'regex', expected: string): boolean {
        switch (operator) {
            case 'equals':
                return actual.toLowerCase() === expected.toLowerCase();

            case 'contains':
                return actual.toLowerCase().includes(expected.toLowerCase());

            case 'regex':
                try {
                    const regex = new RegExp(expected, 'i');
                    return regex.test(actual);
                } catch {
                    return false;
                }

            default:
                return false;
        }
    }

    /**
     * Exports rules as JSON
     */
    async exportRules(): Promise<string> {
        try {
            const rules = await this.getRules();
            return JSON.stringify(rules, null, 2);
        } catch (error) {
            console.error('RuleEngine: Failed to export rules', error);
            throw new Error(`Failed to export rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Imports rules from JSON
     */
    async importRules(rulesJson: string, replace: boolean = false): Promise<number> {
        try {
            const importedRules = JSON.parse(rulesJson) as Rule[];

            // Validate all rules
            for (const rule of importedRules) {
                const validation = validateRule(rule);
                if (!validation.valid) {
                    throw new Error(`Invalid rule "${rule.name}": ${validation.errors.join(', ')}`);
                }
            }

            if (replace) {
                // Replace all existing rules
                await this.storageManager.save(this.RULES_KEY, importedRules);
                return importedRules.length;
            } else {
                // Merge with existing rules
                const existingRules = await this.getRules();
                const mergedRules = [...existingRules, ...importedRules];
                await this.storageManager.save(this.RULES_KEY, mergedRules);
                return importedRules.length;
            }
        } catch (error) {
            console.error('RuleEngine: Failed to import rules', error);
            throw new Error(`Failed to import rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Export singleton instance
export const ruleEngine = new RuleEngine(new StorageManager());
