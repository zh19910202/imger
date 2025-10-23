# Project Overview

## Project Name
Auxis - 标注平台助手扩展

## Description
Auxis is a Chrome extension designed for Tencent's QLabel annotation platform, providing keyboard shortcuts and AI image processing capabilities.

## Tech Stack
- **Primary Language**: JavaScript
- **Platform**: Chrome Extension
- **Native Host**: Python (native_host.py)
- **Build Tool**: Node.js based build system
- **External Services**:
  - RunningHub API for AI image processing
  - Cardkey validation server for license verification

## Key Features
1. **Keyboard Shortcuts**:
   - D key: Quick image download
   - Space key: Click "Skip" button
   - S key: Click "Submit and Continue" button
   - A key: Click "Upload Image" button
   - F key: Click "View History" link
   - X key: Click "Mark Invalid" button (with auto-confirmation)
   - F1 key: Batch mark invalid
   - W key: Smart image comparison
   - Z key: Toggle debug mode
   - T key: Test device fingerprint reading and cardkey validation

2. **AI Image Processing**:
   - R key: AI image processing via RunningHub
   - Automatic image dimension checking (must be multiples of 8)
   - Task status polling and result display
   - Support for viewing large images, downloading, and applying results

3. **Smart Comparison**:
   - Automatic detection of original and uploaded images
   - Multiple comparison modes (side-by-side, sliding, blinking)
   - Dimension information display and comparison analysis

4. **Cardkey Validation**:
   - Device fingerprint reading via Native Host
   - Remote cardkey validation
   - 24-hour result caching
   - Fallback to expired cache on network errors

## Project Structure
```
auxis/
├── src/
│   ├── appen-data-collector.js     # Data collection functionality
│   ├── background.js               # Extension background script
│   ├── cardkey-validator.js        # Cardkey validation logic
│   ├── content.js                  # Page content script
│   ├── native_host.py              # Native Host program
│   ├── popup.html                  # Extension popup interface
│   └── popup.js                    # Extension popup script
├── openspec/                       # OpenSpec documentation
├── build/                          # Build tools and configuration
├── config/                         # Configuration files
├── docs/                           # Documentation
├── tests/                          # Test files
└── assets/                         # Static assets
```

## Development Conventions
- Two-space indentation
- Trailing semicolons
- Single quotes in JavaScript
- Prefer `const` and `let`; avoid `var`
- camelCase for functions and variables
- SCREAMING_SNAKE_CASE for immutable configuration
- PascalCase only for classes or React-style components

## Build and Test Commands
- `npm install`: Install dependencies
- `npm run build`: Production build
- `npm run build:test`: Debug build with source maps
- `npm run dist`: Clean and fresh production build

## Security Considerations
- Cardkey values must never be committed to version control
- Use `.env.local` for secrets
- Native messaging and cardkey validation are security-sensitive areas