# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **AnnotateFlow Assistant**, a Chrome extension (Manifest V3) designed for the Tencent QLabel annotation platform. The extension provides fast image downloading capabilities and keyboard shortcuts for annotation workflows.

## Architecture

The extension follows the standard Chrome Extension Manifest V3 architecture:

- **manifest.json**: Extension configuration with permissions for downloads, contextMenus, activeTab, storage, notifications, tabs, and nativeMessaging
- **background.js**: Service worker handling context menus, download operations, and native messaging for auto-opening files
- **content.js**: Content script injected into qlabel.tencent.com pages, handling keyboard shortcuts, image hovering/downloading, and UI interactions
- **popup.js + popup.html**: Extension popup interface for user settings (auto-open toggle, sound effects toggle)

## Core Functionality

### Image Download System
- **D key + hover**: Primary download method - hover over image and press D
- **Double-click**: Alternative download method
- **Right-click menu**: Context menu download option
- Downloads preserve original format and dimensions
- Optional auto-open using native messaging host

### Keyboard Shortcuts
- **D**: Download hovered image with visual feedback
- **Space**: Click "Skip" button on annotation page
- **S**: Click "Submit" button with optional sound effect
- **A**: Click "Upload Image" button  
- **F**: Click "View History" link

### Settings System
- Chrome storage API for persistent settings
- Auto-open images toggle (requires native host setup)
- Sound effects toggle for S key submissions
- Settings sync across browser instances

## Development Commands

Since this is a Chrome extension, there are no build processes:

```bash
# No build step required
npm run build  # Echoes "No build process needed"

# No tests configured
npm run test   # Echoes "No tests specified"
```

## Installation & Development

1. Load unpacked extension in Chrome developer mode
2. Point to project root directory
3. Extension runs only on `https://qlabel.tencent.com/*`
4. For auto-open functionality, see `NATIVE_HOST_SETUP.md` for native messaging host setup

## File Structure

- `manifest.json` - Extension configuration
- `background.js` - Service worker for downloads and native messaging
- `content.js` - Main functionality for keyboard shortcuts and image handling
- `popup.js/html` - Settings interface
- `notification.mp3` - Optional sound effect file (user-provided)
- `SOUND_SETUP.md` - Instructions for adding sound effects
- Various setup guides in markdown files

## Key Technical Details

### Native Messaging
- Uses `com.annotateflow.assistant` host for auto-opening downloaded files
- Fallback gracefully when native host unavailable
- Connection management with retry logic

### Content Script Integration
- Event delegation for dynamic content
- Image detection and hover state management
- Button finding logic using text content matching (supports Chinese text)
- Visual feedback system for download operations

### Chrome APIs Used
- Downloads API for file downloading
- Storage API for settings persistence  
- ContextMenus API for right-click integration
- Tabs API for cross-tab communication
- Native Messaging for system integration

## Target Platform

Specifically designed for Tencent QLabel annotation platform:
- Only activates on `https://qlabel.tencent.com/*`
- Chinese interface support
- Annotation workflow optimized shortcuts