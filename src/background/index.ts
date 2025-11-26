// Background Service Worker Entry Point

import { requestInterceptor } from './RequestInterceptor';
import { mockResponseManager } from './MockResponseManager';
import { MessageType, Message } from '../shared/types';
import { ruleEngine } from '../shared';

console.log('Proxy Server Extension - Background Service Worker starting...');

// Initialize the request interceptor
requestInterceptor.initialize();

console.log('Proxy Server Extension - Background Service Worker initialized');

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    handleMessage(message)
        .then(sendResponse)
        .catch(error => {
            console.error('Background: Error handling message', error);
            sendResponse({ error: error.message });
        });
    return true; // Keep message channel open for async response
});

/**
 * Handle messages from extension UI and content scripts
 */
async function handleMessage(message: Message): Promise<any> {
    console.log('Background: Received message', message.type);

    switch (message.type) {
        case MessageType.GET_RULES:
            // Get all rules
            const rules = await ruleEngine.getRules();
            return { rules };

        case MessageType.GET_LOGS:
            // Get all request logs
            const logs = await requestInterceptor.getLogs();
            return { logs };

        case MessageType.SAVE_RULE:
            // Save rule and update mock rules if needed
            const ruleId = await ruleEngine.saveRule(message.payload);
            const updatedRules = await ruleEngine.getRules();
            await mockResponseManager.registerMockRules(updatedRules);
            // Notify that rules have been updated
            await notifyRuleUpdate();
            return { ruleId };

        case MessageType.DELETE_RULE:
            // Delete rule and remove mock rules
            await mockResponseManager.removeMockRules(message.payload.ruleId);
            await ruleEngine.deleteRule(message.payload.ruleId);
            // Notify that rules have been updated
            await notifyRuleUpdate();
            return { success: true };

        case MessageType.TOGGLE_RULE:
            // Toggle rule and update mock rules
            await ruleEngine.toggleRule(message.payload.ruleId, message.payload.enabled);
            const toggledRules = await ruleEngine.getRules();
            await mockResponseManager.registerMockRules(toggledRules);
            // Notify that rules have been updated
            await notifyRuleUpdate();
            return { success: true };

        case MessageType.RULE_UPDATED:
            // Reload all mock rules when rules are updated
            const allRules = await ruleEngine.getRules();
            await mockResponseManager.registerMockRules(allRules);
            // Notify that rules have been updated
            await notifyRuleUpdate();
            return { success: true };

        default:
            console.warn('Background: Unknown message type', message.type);
            return { error: 'Unknown message type' };
    }
}

/**
 * Notify all extension components that rules have been updated
 */
async function notifyRuleUpdate(): Promise<void> {
    console.log('Background: Notifying rule update');

    // The Request Interceptor evaluates rules on each request,
    // so no explicit reload is needed. The next request will
    // automatically use the updated rules.

    // Broadcast to all extension pages (popup, devtools, etc.)
    try {
        await chrome.runtime.sendMessage({
            type: MessageType.RULE_UPDATED,
            payload: {},
        });
    } catch (error) {
        // It's okay if no listeners are active
        console.log('Background: No active listeners for rule update notification');
    }
}

// Export for testing
export { requestInterceptor, mockResponseManager };
