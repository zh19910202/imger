# Fix Undefined ERROR Constant Design

## Overview
This document outlines the design for fixing the undefined `ERROR` constant issue in the logging system.

## Problem Analysis
The codebase contains several instances where `ERROR` is used directly in log function calls instead of the properly defined `LOG_LEVEL.ERROR` constant. This causes ReferenceError exceptions at runtime:

```
Uncaught (in promise) ReferenceError: ERROR is not defined
    at getSpecifiedElementId (appen-data-collector.js:3591:17)
    at appen-data-collector.js:607:40
```

## Current State
The logging system properly defines log levels:
```javascript
const LOG_LEVEL = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};
```

But some code incorrectly uses `ERROR` directly:
```javascript
log(ERROR, '[Appen Data Collector] 获取指定路径 div 元素 id 失败:', error);
```

## Solution
Replace all instances of undefined `ERROR` with `LOG_LEVEL.ERROR`:

```javascript
log(LOG_LEVEL.ERROR, '[Appen Data Collector] 获取指定路径 div 元素 id 失败:', error);
```

## Implementation Approach
1. Search for all instances of `log(ERROR` in the codebase
2. Replace with `log(LOG_LEVEL.ERROR`
3. Verify no other undefined constants are used
4. Test error logging functionality

## Risk Assessment
- Low risk: Simple constant replacement
- No functional changes, only fixes broken code
- Maintains existing behavior

## Testing Strategy
- Verify ReferenceError is resolved
- Test error logging still works correctly
- Check console output for proper error messages