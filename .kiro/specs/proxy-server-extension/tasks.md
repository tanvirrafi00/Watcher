# Implementation Plan

- [x] 1. Set up project structure and development environment
  - Initialize npm project with TypeScript configuration
  - Set up Webpack/Vite for Chrome extension bundling
  - Configure manifest.json for Manifest V3
  - Create directory structure: src/background, src/content, src/popup, src/shared
  - Install dependencies: React, TypeScript, fast-check, Jest
  - Set up build scripts for development and production
  - _Requirements: All_

- [x] 2. Implement core data models and types
  - Create TypeScript interfaces for RequestLog, Rule, RuleAction, WebSocketLog, LogFilter
  - Define Chrome API type extensions
  - Create utility types for request/response data
  - Implement data validation functions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.1 Write property test for data model validation
  - **Property 1: Complete request capture**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 3. Implement Storage Manager
  - Create StorageManager class with chrome.storage.local wrapper
  - Implement save, get, remove operations with error handling
  - Add quota monitoring and reporting
  - Implement LRU eviction when storage reaches 80% quota
  - Add data compression for large payloads
  - _Requirements: 8.1, 8.3_

- [x] 3.1 Write property test for storage persistence
  - **Property 24: Storage persistence**
  - **Validates: Requirements 8.1, 8.2**

- [x] 3.2 Write property test for quota management
  - **Property 25: Quota management**
  - **Validates: Requirements 8.3**

- [x] 4. Implement Request Logger
  - Create RequestLogger class for managing traffic logs
  - Implement logRequest method to store captured requests
  - Implement updateRequestWithResponse to add response data
  - Add getLogsForTab and getAllLogs retrieval methods
  - Implement searchLogs with filter support
  - Add clearLogs functionality
  - Implement retention policy cleanup (delete old data)
  - _Requirements: 1.4, 8.1, 8.4, 8.5_

- [x] 4.1 Write property test for data clearing
  - **Property 26: Data clearing completeness**
  - **Validates: Requirements 8.4**

- [x] 4.2 Write property test for retention policy
  - **Property 27: Retention policy enforcement**
  - **Validates: Requirements 8.5**

- [x] 5. Implement Rule Engine
  - Create RuleEngine class for managing modification rules
  - Implement saveRule with validation
  - Implement deleteRule and getRules methods
  - Create evaluateRequest method for pattern matching (glob and regex)
  - Implement toggleRule for enabling/disabling rules
  - Add rule priority sorting
  - _Requirements: 2.1, 5.1, 5.2_

- [x] 5.1 Write property test for rule persistence
  - **Property 2: Rule persistence and application**
  - **Validates: Requirements 2.1**

- [x] 5.2 Write property test for rule validation
  - **Property 11: Rule validation**
  - **Validates: Requirements 5.1**

- [x] 5.3 Write property test for pattern matching
  - **Property 12: Pattern matching accuracy**
  - **Validates: Requirements 5.2**

- [x] 6. Implement Traffic Modification Engine
  - Create TrafficModificationEngine class
  - Implement modifyRequestHeaders method (add, remove, set operations)
  - Implement modifyResponseHeaders method
  - Create createRedirect method for URL modifications
  - Implement createMockResponse for response mocking
  - Add applyDelay method for artificial delays
  - Add timeout handling (5 second limit)
  - _Requirements: 2.2, 2.3, 2.4, 6.2, 6.3, 6.4_

- [x] 6.1 Write property test for traffic modification
  - **Property 3: Traffic modification correctness**
  - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 6.2 Write property test for modification application
  - **Property 13: Modification application**
  - **Validates: Requirements 5.3**

- [x] 6.3 Write property test for mock response delivery
  - **Property 16: Mock response delivery**
  - **Validates: Requirements 6.2, 6.3**

- [x] 6.4 Write property test for mock response delay
  - **Property 17: Mock response delay**
  - **Validates: Requirements 6.4**

- [x] 7. Implement Request Interceptor in Background Service Worker
  - Create background service worker entry point
  - Register chrome.webRequest listeners (onBeforeRequest, onBeforeSendHeaders, onHeadersReceived, onCompleted, onErrorOccurred)
  - Implement request capture logic in onBeforeRequest
  - Implement header modification in onBeforeSendHeaders
  - Implement response header modification in onHeadersReceived
  - Capture response bodies using fetch API
  - Add error handling for failed requests
  - Integrate with RequestLogger to store captured data
  - Integrate with RuleEngine to evaluate rules
  - Integrate with TrafficModificationEngine to apply modifications
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3, 2.4, 9.1_

- [x] 7.1 Write property test for request failure logging
  - **Property 28: Request failure logging**
  - **Validates: Requirements 9.1**

- [x] 7.2 Write property test for graceful error handling
  - **Property 14: Graceful error handling**
  - **Validates: Requirements 5.4, 9.2, 9.4**

- [x] 8. Implement declarativeNetRequest for mock responses
  - Create mock response rule converter (Rule → declarativeNetRequest rule)
  - Implement dynamic rule registration using chrome.declarativeNetRequest
  - Handle data URL generation for mock response bodies
  - Implement rule cleanup when mocks are disabled
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 8.1 Write property test for mock response storage
  - **Property 15: Mock response storage**
  - **Validates: Requirements 6.1**

- [x] 8.2 Write property test for mock rule disable
  - **Property 18: Mock rule disable restoration**
  - **Validates: Requirements 6.5**

- [x] 9. Implement rule update immediacy
  - Add chrome.runtime.onMessage listener for rule updates
  - Implement immediate rule reload when rules change
  - Update webRequest listeners with new rules
  - Update declarativeNetRequest rules dynamically
  - _Requirements: 2.5, 5.5_

- [x] 9.1 Write property test for rule update immediacy
  - **Property 4: Rule update immediacy**
  - **Validates: Requirements 2.5, 5.5**

- [x] 10. Checkpoint - Ensure all background service worker tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement WebSocket monitoring in Content Script
  - Create content script entry point
  - Override native WebSocket constructor
  - Wrap WebSocket.send() to capture outgoing messages
  - Wrap WebSocket.onmessage to capture incoming messages
  - Capture WebSocket handshake details
  - Track connection state (connecting, open, closing, closed)
  - Capture close reason and message count
  - Send captured data to background service worker via chrome.runtime.sendMessage
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 11.1 Write property test for WebSocket handshake capture
  - **Property 19: WebSocket handshake capture**
  - **Validates: Requirements 7.1**

- [x] 11.2 Write property test for WebSocket message capture
  - **Property 20: WebSocket message capture**
  - **Validates: Requirements 7.2**

- [x] 11.3 Write property test for WebSocket closure logging
  - **Property 23: WebSocket closure logging**
  - **Validates: Requirements 7.5**

- [x] 12. Set up React UI foundation
  - Create React app structure in src/popup
  - Set up React Context for global state management
  - Create main App component
  - Set up routing (if using multiple views)
  - Create theme and styling foundation (CSS modules or styled-components)
  - Implement chrome.runtime.onMessage listener for real-time updates
  - _Requirements: 3.1, 3.2_

- [x] 13. Implement Request List component
  - Create RequestList component to display captured requests
  - Implement virtualized list for performance (react-window)
  - Display request URL, method, status, timing for each item
  - Add request selection handler
  - Implement real-time updates when new requests arrive
  - Add loading and empty states
  - _Requirements: 3.1, 3.2_

- [x] 13.1 Write property test for real-time UI updates
  - **Property 5: Real-time UI updates**
  - **Validates: Requirements 3.1, 3.2**

- [x] 14. Implement Request Detail viewer
  - Create RequestDetail component for displaying full request/response data
  - Display request headers, body, and metadata
  - Display response headers, body, status, and timing
  - Add syntax highlighting for JSON/XML bodies
  - Add copy-to-clipboard functionality
  - Implement collapsible sections for headers
  - _Requirements: 3.3_

- [x] 14.1 Write property test for request detail completeness
  - **Property 6: Request detail completeness**
  - **Validates: Requirements 3.3**

- [x] 15. Implement Filter Controls component
  - Create FilterControls component with search input
  - Add domain filter dropdown
  - Add resource type filter (XHR, fetch, script, image, etc.)
  - Add method filter (GET, POST, PUT, DELETE, etc.)
  - Add status code filter
  - Implement filter application logic
  - Add clear filters button
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 15.1 Write property test for comprehensive filtering
  - **Property 9: Comprehensive filtering**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 15.2 Write property test for filter reset
  - **Property 10: Filter reset completeness**
  - **Validates: Requirements 4.5**

- [x] 16. Implement tab-specific traffic filtering
  - Get active tab ID using chrome.tabs.query
  - Filter displayed requests by active tab ID
  - Update display when user switches tabs
  - Add "All Tabs" option to view traffic from all tabs
  - _Requirements: 3.5_

- [x] 16.1 Write property test for tab-specific isolation
  - **Property 7: Tab-specific traffic isolation**
  - **Validates: Requirements 3.5**

- [x] 17. Implement bandwidth calculation and display
  - Calculate bandwidth from request/response body sizes
  - Display real-time bandwidth usage in UI
  - Add bandwidth graph or chart (optional)
  - Show total bytes sent/received
  - _Requirements: 3.4_

- [x] 17.1 Write property test for bandwidth calculation
  - **Property 8: Bandwidth calculation accuracy**
  - **Validates: Requirements 3.4**

- [x] 18. Implement Rule Editor component
  - Create RuleEditor component for creating/editing rules
  - Add form fields: name, URL pattern, pattern type (glob/regex)
  - Add action selector (modify headers, redirect, block, mock, delay)
  - Implement action-specific configuration forms
  - Add rule validation before save
  - Implement save and cancel handlers
  - Add rule enable/disable toggle
  - _Requirements: 2.1, 5.1, 5.5_

- [x] 19. Implement Rule List component
  - Create RuleList component to display all rules
  - Show rule name, URL pattern, enabled state, and actions
  - Add edit and delete buttons for each rule
  - Implement rule toggle (enable/disable)
  - Add "Create New Rule" button
  - _Requirements: 2.1, 5.5_

- [x] 20. Implement WebSocket connection viewer
  - Create WebSocketList component to display WebSocket connections
  - Show connection URL, status, and message count
  - Implement connection selection
  - Create WebSocketDetail component to show message history
  - Display messages with direction (sent/received), content, and timestamp
  - Add message filtering and search
  - _Requirements: 7.3, 7.4_

- [x] 20.1 Write property test for WebSocket connection state display
  - **Property 21: WebSocket connection state display**
  - **Validates: Requirements 7.3**

- [x] 20.2 Write property test for WebSocket message history
  - **Property 22: WebSocket message history**
  - **Validates: Requirements 7.4**

- [ ] 21. Implement Export functionality
  - Create ExportManager utility class
  - Implement JSON export format
  - Implement HAR (HTTP Archive) export format
  - Add export button to UI
  - Implement filtered export (respect active filters)
  - Trigger browser download with generated file
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 21.1 Write property test for export completeness
  - **Property 30: Export completeness**
  - **Validates: Requirements 10.1, 10.2**

- [ ] 21.2 Write property test for filtered export
  - **Property 31: Filtered export accuracy**
  - **Validates: Requirements 10.3**

- [ ] 21.3 Write property test for export format support
  - **Property 32: Export format support**
  - **Validates: Requirements 10.4**

- [ ] 22. Implement error handling and notifications
  - Create error notification component
  - Add error boundary for React components
  - Implement error logging to extension console
  - Display user-friendly error messages for storage failures
  - Add error recovery mechanisms
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 22.1 Write property test for error logging
  - **Property 29: Error logging completeness**
  - **Validates: Requirements 9.5**

- [ ] 23. Implement settings and configuration
  - Create Settings component
  - Add retention period configuration
  - Add storage quota display
  - Add clear history button
  - Add max stored requests configuration
  - Add enable/disable extension toggle
  - Persist settings in chrome.storage.sync
  - _Requirements: 8.4, 8.5_

- [ ] 24. Add extension icons and branding
  - Create extension icons (16x16, 48x48, 128x128)
  - Add toolbar icon
  - Design extension popup UI
  - Add loading states and animations
  - Implement responsive design for different screen sizes
  - _Requirements: All_

- [ ] 25. Implement Chrome extension manifest
  - Create manifest.json with Manifest V3 format
  - Declare required permissions (webRequest, webRequestBlocking, declarativeNetRequest, storage, tabs, <all_urls>)
  - Configure background service worker
  - Configure content scripts injection
  - Set up extension popup
  - Add content security policy
  - _Requirements: All_

- [ ] 26. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Build and package extension
  - Create production build script
  - Minify and optimize code
  - Generate source maps
  - Create extension .zip file
  - Test installation in Chrome
  - Verify all functionality works in production build
  - _Requirements: All_

- [ ] 28. Write integration tests
  - Set up Puppeteer with Chrome extension support
  - Test extension installation
  - Test request capture in real browser
  - Test rule creation and application
  - Test WebSocket monitoring
  - Test export functionality
  - Test error scenarios
