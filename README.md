# Watcher - Proxy Server Extension

A Chrome browser extension for comprehensive network traffic monitoring, modification, and analysis.

## Features

- 🔍 Real-time HTTP/HTTPS request interception and logging
- �️ eDynamic traffic modification with custom rules
- �  WebSocket connection monitoring
- 🎯 Advanced filtering and search capabilities
- 💾 Traffic data persistence and export (JSON/HAR formats)
- 🎨 React-based user interface

## Tech Stack

- **Manifest V3** Chrome Extension
- **TypeScript** for type safety
- **React** for UI components
- **Vite** for fast bundling
- **Jest** + **fast-check** for testing

## Development

### Prerequisites

- Node.js 18+ and npm
- Chrome browser

### Installation

```bash
# Install dependencies
npm install

# Run development build with watch mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build
```

### Loading the Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Project Structure

```
proxy-server-extension/
├── src/
│   ├── background/       # Background service worker
│   ├── content/          # Content scripts for WebSocket monitoring
│   ├── popup/            # React UI components
│   └── shared/           # Shared types and utilities
├── public/
│   ├── manifest.json     # Extension manifest
│   └── icons/            # Extension icons
└── dist/                 # Build output
```

## Testing

The project uses Jest for unit testing and fast-check for property-based testing. All correctness properties from the design document are implemented as property-based tests with 100+ iterations each.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## License

MIT
