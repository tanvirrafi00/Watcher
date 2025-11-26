# 🚀 Load the Proxy Server Extension

## Quick Start

### 1. Load Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `dist` folder from this project:
   ```
   /Users/rafi_exabyting/Documents/Proxy server/dist
   ```
5. The extension will load! 🎉

### 2. Open the Extension

- Click the extension icon in your Chrome toolbar (puzzle piece icon)
- Find "Proxy Server Extension" and click it
- The popup will open showing the network monitor

### 3. See It In Action

1. With the extension popup open, navigate to any website (e.g., `https://example.com`)
2. Watch as network requests appear in real-time!
3. Click on any request to see detailed information
4. Use filters to search and filter requests

## 🎨 Features Available Now

### Request List
- ✅ Real-time request monitoring
- ✅ Method, Status, URL, Domain, Timing display
- ✅ Color-coded status badges (green=success, red=error, etc.)
- ✅ Modified request indicators
- ✅ Virtualized list for performance

### Request Details
- ✅ **Headers Tab**: View request & response headers
- ✅ **Body Tab**: View formatted JSON/text bodies
- ✅ **Timing Tab**: See duration, timestamps, initiator
- ✅ Copy buttons for easy sharing

### Filters
- ✅ Search by URL, method, or status
- ✅ Filter by HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ Filter by status codes (200, 404, 500, etc.)
- ✅ Clear all filters button

## 🔄 Development Mode

The dev server is running in watch mode:
- Any code changes will automatically rebuild
- Refresh the extension or reload the popup to see changes
- Check the terminal for build status

## 🐛 Troubleshooting

### Extension doesn't load
- Make sure you selected the `dist` folder, not the project root
- Check that all files are present in `dist/`
- Look for errors in `chrome://extensions/`

### No requests showing
- Make sure you're navigating to websites after opening the popup
- Check the browser console for errors (F12)
- Verify the extension has permissions

### Popup is blank
- Check the console in the popup (right-click popup → Inspect)
- Make sure the build completed successfully
- Try reloading the extension

## 📝 Next Steps

The core backend and UI are complete! You can now:
- Monitor network traffic in real-time
- View detailed request/response information
- Filter and search through requests
- See which requests were modified by rules

Future enhancements could include:
- Rule editor UI
- WebSocket connection viewer
- Export functionality
- Settings panel
