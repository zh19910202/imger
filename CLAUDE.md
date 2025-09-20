# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Migration and Refactoring Principles

### 🚨 Critical Migration Rules

#### 1. Logic Preservation Principle
**NEVER modify business logic during code migration**
- Migrated code must be 100% identical to original code
- Function parameters, return values, and behavior must remain exactly the same
- All error handling, data processing, and edge cases must be preserved
- Business logic optimization should ONLY happen AFTER migration is complete

#### 2. API Interface Consistency
**Maintain exact API compatibility**
- Function signatures must remain identical
- Return value formats must stay the same
- Error message formats and types must be preserved
- Global variable access patterns must not change

#### 3. Migration-Only Changes
**Only these changes are allowed during migration:**
- Moving code from one file to another
- Adding module imports/exports
- Creating compatibility wrapper functions
- Adding necessary debugging/logging for migration verification

#### 4. Forbidden During Migration
**These changes are STRICTLY FORBIDDEN during migration:**
- Changing function return value formats
- "Improving" error handling or data processing
- Optimizing algorithms or performance
- Modifying business logic or validation rules
- Changing API response handling
- Adding new features or capabilities

#### 5. Migration Verification
**Each migration must preserve exact behavior:**
- Test with same inputs, expect same outputs
- Verify error cases produce identical results
- Confirm side effects and state changes match
- Validate timing and async behavior consistency

#### 6. Post-Migration Optimization
**After migration is complete and verified:**
- Then consider optimizations and improvements
- Document any proposed logic changes
- Test improvements separately from migration
- Maintain backward compatibility

### Example: Wrong vs Right Migration

❌ **Wrong - Modified during migration:**
```javascript
// Old code
const result = await response.text();
return result;

// New code (WRONG - changed return format)
const data = await response.json();
return { success: true, data: data.data, message: data.msg };
```

✅ **Right - Exact code preservation:**
```javascript
// Old code
const result = await response.text();
return result;

// New code (CORRECT - identical logic)
const result = await response.text();
return result;
```

### Migration Checklist
- [ ] Code logic 100% identical
- [ ] Function signatures unchanged
- [ ] Return formats preserved
- [ ] Error handling identical
- [ ] Dependencies satisfied
- [ ] Behavior verification passed

**Remember: Migration = Move, Don't Modify**

---

## Code Cleanup Principles

### 🚨 Critical Cleanup Rules

#### 1. Reference Check Principle
**NEVER delete code that is currently being referenced**
- Before deleting any function, variable, or code block, verify it's not being used
- Use grep/search tools to find all references to the code
- Check for dynamic references (string-based function calls, eval, etc.)
- Functions currently being called must NOT be removed

#### 2. Safe Cleanup Targets
**Only these types of code can be safely removed:**
- Commented-out code blocks (`// function oldFunc() { ... }`)
- Duplicate function definitions (keep the one being used)
- Dead code that has no references
- Outdated comments and documentation
- Excessive whitespace and empty lines
- Debug console.log statements that are no longer needed

#### 3. Function Usage Verification
**Steps to verify a function can be deleted:**
1. Search for all function calls: `grep -r "functionName(" .`
2. Check for dynamic calls: `grep -r "functionName" .`
3. Verify the function is not exported or assigned to global objects
4. Confirm the function is not used in event handlers or callbacks
5. Only delete if absolutely no references are found

#### 4. Cleanup Verification Process
**After each cleanup step:**
- Run syntax check: `node -c filename.js`
- Test core functionality to ensure nothing is broken
- Commit changes incrementally to allow easy rollback
- Document what was removed and why

#### 5. Cleanup Priority Order
**Clean in this order (safest to riskiest):**
1. Comments and commented-out code
2. Excessive whitespace and formatting
3. Duplicate function definitions (keep the referenced one)
4. Unused imports and requires
5. Dead code with no references
6. Consolidation of similar functions (only if safe)

### Example: Reference Check Process

❌ **Wrong - Delete without checking:**
```javascript
// Found function: generateFileName()
// Delete immediately because it looks unused
```

✅ **Right - Verify first:**
```bash
# Check for references
grep -r "generateFileName" .
# Found in: modal.js:45, utils.js:12, main.js:234
# Result: DO NOT DELETE - function is being used
```

### Cleanup Checklist
- [ ] Searched for all function references
- [ ] Checked for dynamic/string-based calls
- [ ] Verified function is not in global scope
- [ ] Confirmed no event handler usage
- [ ] Tested functionality after removal
- [ ] Committed changes incrementally

**Remember: When in doubt, don't delete it**

---

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