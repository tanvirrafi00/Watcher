// Jest setup file for testing environment
// Add custom matchers or global test setup here

// Mock chrome API for tests
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn(),
            getBytesInUse: jest.fn(),
        },
        sync: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn(),
        },
    },
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
    tabs: {
        query: jest.fn(),
    },
    webRequest: {
        onBeforeRequest: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onBeforeSendHeaders: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onHeadersReceived: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onCompleted: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        onErrorOccurred: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
    declarativeNetRequest: {
        updateDynamicRules: jest.fn(),
        getDynamicRules: jest.fn(),
    },
} as any;
