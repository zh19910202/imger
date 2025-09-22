# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AnnotateFlow Assistant (Auxis)** is a Chrome extension (Manifest V3) designed for the Tencent QLabel annotation platform. The extension provides fast image downloading capabilities, keyboard shortcuts for annotation workflows, and AI-powered image processing through RunningHub integration.

## Architecture

### Core Components
- **manifest.json**: Extension configuration with permissions for downloads, contextMenus, activeTab, storage, notifications, tabs, nativeMessaging, and webRequest
- **background.js**: Service worker handling context menus, download operations, and native messaging for auto-opening files
- **content.js**: Main content script (~8000+ lines) injected into qlabel.tencent.com pages, handling:
  - Keyboard shortcuts and UI interactions
  - Image downloading and processing
  - RunningHub AI integration with task management
  - Modal dialogs and state management
- **resource-extractor.js**: Content script for resource extraction
- **popup.js + popup.html**: Extension popup interface for user settings
- **native_host.py**: Python-based native messaging host for PS-Chrome integration

### Key Architecture Patterns
- **State Management**: Extensive use of global variables and caching system for RunningHub results
- **Event-Driven**: Heavy reliance on event delegation for dynamic content handling
- **Modal System**: Complex modal management for image comparison and AI processing workflows
- **Task Polling**: Asynchronous polling system for RunningHub task status with cancellation support

## Core Functionality

### Image Download System
- **R key**: AI image processing via RunningHub integration with modal workflow
- **D key + hover**: Primary download method - hover over image and press D
- **Double-click**: Alternative download method
- **Right-click menu**: Context menu download option
- **X key**: Mark image as invalid with auto-confirmation
- **F1**: Batch mark invalid operations

### Keyboard Shortcuts
- **Space**: Click "Skip" button on annotation page
- **S**: Click "Submit" button with optional sound effect
- **A**: Click "Upload Image" button
- **F**: Click "View History" link
- **R**: RunningHub AI image processing (dimension check and generation)

### RunningHub AI Integration
- **Task Management**: Create, poll, and cancel AI processing tasks
- **Result Caching**: Persistent caching of AI results across page navigation
- **State Recovery**: Automatic restoration of task state when modal is reopened
- **Progress Tracking**: Real-time status updates with polling mechanism
- **Error Handling**: Comprehensive error handling with retry logic

### Native Messaging & PS Integration
- **Dual Communication**: PS Plugin ↔ HTTP Server ↔ Native Host ↔ Chrome Extension
- **Data Support**: Text and Base64 image transmission up to 50MB
- **Auto-open**: Automatic file opening via native host integration

## Development Commands

```bash
# No build process for Chrome extension
npm run build    # Echoes "No build process needed"
npm run test     # Echoes "No tests specified"
npm run lint     # Echoes "No linter configured"

# Native host testing
python3 test_ps_integration.py

# Health check for PS integration
curl http://localhost:8888/api/health
```

## Development Workflow

### Extension Development
1. Load unpacked extension in Chrome developer mode pointing to project root
2. Extension activates on `https://qlabel.tencent.com/*` (also supports localhost and file:// for testing)
3. Use Chrome DevTools Console to monitor debug output via `debugLog()` function
4. Test keyboard shortcuts and modal interactions directly on QLabel pages

### Git Workflow Guidelines
- **Local Testing First**: Make changes locally and thoroughly test before committing
- **Descriptive Commit Messages**: Use clear, concise commit messages following conventional commits format
- **Atomic Commits**: Each commit should represent a single logical change
- **Branch Management**: Work on feature branches and merge to main after testing
- **No WIP Commits**: Avoid committing work-in-progress code to keep history clean

### RunningHub Configuration
- Configuration stored in `runninghub-config.json` with webapp and node mapping
- API key stored in localStorage as `runninghub_api_key`
- Tasks use polling mechanism with 3-second intervals and 3.5-minute timeout
- Results cached with `cachedRunningHubResults` for cross-session persistence

### Native Host Setup
1. Install Python dependencies for `native_host.py`
2. Configure native messaging host manifest for Chrome
3. Start HTTP server on localhost:8888 for PS integration
4. See `NATIVE_HOST_SETUP.md` for detailed setup instructions

## Key Technical Details

### Content Script State Management
- **Global Variables**: Extensive use of module-level variables for state persistence
- **Modal System**: Complex modal lifecycle management with cleanup and restoration
- **Cache Management**: RunningHub results cached with timestamp and URL validation
- **Event Delegation**: Dynamic content handling with Chinese text support for button detection

### Parallel Original Image Detection Optimization
The parallel original image detection system has been optimized with the following improvements:

1. **DOM Loading Wait**: Waits for complete DOM loading before executing image detection
2. **Existing Results Priority**: Prioritizes using existing COS-intercepted or network-monitored original images
3. **Retry Mechanism**: Implements up to 3 retry attempts on failure to improve success rate
4. **Timeout Adjustment**: Increased timeout values for each detection method to allow sufficient execution time
5. **Enhanced Notifications**: Provides clearer feedback during the detection process

These optimizations address the previous issue where "all parallel methods failed" and significantly improve the success rate of original image detection.

### RunningHub Integration Patterns
```javascript
// Task creation and polling pattern
const taskResponse = await createWorkflowTask(apiKey, comment, imageFileName);
const poll = await pollRunningHubTaskStatus(apiKey, taskId, onTick);
if (poll.final === 'SUCCESS') {
    const outputs = await fetchRunningHubTaskOutputs(apiKey, taskId);
    renderRunningHubResultsInModal(outputs);
    cacheRunningHubResults(taskId, outputs, taskInfo);
}
```

### Error Handling Strategy
- **Graceful Degradation**: Features fail silently when dependencies unavailable
- **User Feedback**: Notification system with timeout-based messages
- **State Recovery**: Automatic cleanup and restoration of interrupted operations
- **Debug Logging**: Comprehensive debug system with `debugLog()` function

### Chrome Extension APIs Usage
- **Downloads API**: File downloading with progress tracking
- **Storage API**: Settings persistence and synchronization
- **ContextMenus API**: Right-click integration
- **Tabs API**: Cross-tab communication
- **Native Messaging**: PS plugin integration via Python host
- **WebRequest**: Resource interception and modification

## Configuration Files

### Key Configuration
- `runninghub-config.json`: AI workflow configuration with webapp IDs and node mappings
- `manifest.json`: Extension permissions and content script injection rules
- Native host manifest: Platform-specific configuration for Chrome-Python communication

### Important Settings
- **Target Platform**: Specifically designed for `https://qlabel.tencent.com/*`
- **Internationalization**: Supports Chinese interface elements and text matching
- **Performance**: Optimized for large image processing and AI task management